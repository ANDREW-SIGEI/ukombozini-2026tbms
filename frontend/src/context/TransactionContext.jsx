import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-toastify';

const TransactionContext = createContext();

const API_URL = 'http://localhost:5000/api';

export const useTransactions = () => {
    const context = useContext(TransactionContext);
    if (!context) {
        throw new Error('useTransactions must be used within a TransactionProvider');
    }
    return context;
};

export const TransactionProvider = ({ children }) => {
    const [transactions, setTransactions] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [activeSession, setActiveSession] = useState(null);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);

    // Initial Data Fetch
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [groupsRes, sessionsRes] = await Promise.all([
                    fetch(`${API_URL}/groups`),
                    fetch(`${API_URL}/sessions`)
                ]);

                if (groupsRes.ok) setGroups(await groupsRes.json());
                if (sessionsRes.ok) {
                    const fetchedSessions = await sessionsRes.json();
                    setSessions(fetchedSessions);

                    // Restore Active Session
                    const active = fetchedSessions.find(s => s.status === 'ACTIVE');
                    if (active) setActiveSession(active);
                }
            } catch (error) {
                console.error("Failed to fetch initial data", error);
                toast.error("Connection Error: Could not load system data.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Load transactions for reports (Lazy load or on demand? For now, fetch all needed for cached views)
    // Optimization: We could fetch this only when viewing reports.
    useEffect(() => {
        // Fetch global transactions (or specific range)
        fetch(`${API_URL}/transactions`)
            .then(res => res.json())
            .then(data => setTransactions(data))
            .catch(err => console.error("Transactions fetch failed", err));
    }, [sessions]); // Refresh when sessions change

    /**
     * Start a new Group Meeting
     */
    const startSession = async (group, officer) => {
        if (activeSession) {
            toast.warn("There is already an active meeting session.");
            return activeSession;
        }

        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // 2 Hours default

        const payload = {
            groupId: group.id,
            officerId: officer.id,
            date: new Date().toISOString().split('T')[0],
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString()
        };

        try {
            const res = await fetch(`${API_URL}/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Failed to start session');

            const newSession = await res.json();
            setActiveSession(newSession);
            setSessions(prev => [newSession, ...prev]);
            toast.success(`Meeting Started for ${group.name}. 2 Hours Remaining.`);
            return newSession;
        } catch (error) {
            toast.error(error.message);
        }
    };

    /**
     * Close Meeting (Submit for Approval)
     */
    const closeSession = async (totals, transactions, balances) => {
        if (!activeSession) return;

        try {
            const res = await fetch(`${API_URL}/sessions/${activeSession.id}/close`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ totals })
            });

            if (!res.ok) throw new Error('Failed to close session');

            // Update local state
            const updatedSession = { ...activeSession, status: 'PENDING_APPROVAL', totals };
            setSessions(prev => prev.map(s => s.id === activeSession.id ? updatedSession : s));
            setActiveSession(null);

            toast.info("Meeting Closed. Submitted for Supervisor Approval.");
            return updatedSession;
        } catch (error) {
            toast.error(error.message);
        }
    };

    /**
     * Extend Active Meeting
     */
    const extendSession = (minutes, reason) => {
        if (!activeSession) return;
        // Backend extension logic not fully implemented in this MVP snippet, 
        // effectively treating as a frontend state change for now or could patch backend.
        // For now, we simulate success on frontend to not break flow.
        const currentEnd = new Date(activeSession.endTime);
        const newEnd = new Date(currentEnd.getTime() + minutes * 60 * 1000);

        setActiveSession(prev => ({
            ...prev,
            endTime: newEnd.toISOString()
        }));
        toast.success(`Meeting extended by ${minutes} minutes. (Local override)`);
    };

    /**
     * Register a New Group
     */
    const addGroup = async (groupData) => {
        try {
            const res = await fetch(`${API_URL}/groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(groupData)
            });

            if (!res.ok) throw new Error('Failed to register group');

            const newGroup = await res.json();
            setGroups(prev => [...prev, newGroup]);
            toast.success(`Group "${groupData.name}" registered successfully!`);
            return newGroup;
        } catch (error) {
            toast.error(error.message);
        }
    };

    /**
     * Post a new meeting session (Approve/Finalize)
     */
    const postSession = async (sessionMetadata, newTransactions) => {
        try {
            const res = await fetch(`${API_URL}/sessions/${sessionMetadata.id}/post`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transactions: newTransactions })
            });

            if (!res.ok) throw new Error('Failed to post session');

            const result = await res.json();

            // Update local state
            setSessions(prev => prev.map(s => s.id === sessionMetadata.id ? { ...s, status: 'POSTED' } : s));

            // Refetch transactions to ensure global list is up-to-date
            fetch(`${API_URL}/transactions`)
                .then(r => r.json())
                .then(data => setTransactions(data));

            toast.success(`Session Posted! ${result.transactionCount} transactions recorded.`);
            return true;
        } catch (error) {
            toast.error(error.message);
            return false;
        }
    };

    /**
     * Reverse Session
     */
    const reverseSession = async (sessionId, reason, adminUser) => {
        // Not fully implemented on backend yet (requires UPDATE queries).
        // For MVP, we'll just toast.
        toast.warn("Reversal Logic moved to backend - Not yet hooked up.");
        return false;
    };

    // Filter Helper
    const getGroupTransactions = (groupId, month, year) => {
        return transactions.filter(t => {
            // Need to match session date (which is not directly on t, so we rely on backend having joined it)
            // The backend /transactions endpoint returns `sessionDate`.
            if (!t.sessionDate) return false;
            const d = new Date(t.sessionDate);
            // Also need to check if session is posted? Backend /transactions includes all? 
            // In SQL query, we only joined transactions. Session status check might be needed.
            // For now, assume backend returns what we see.
            return t.sessionId && d.getMonth() === month && d.getFullYear() === year;
            // Note: Simplification. Ideally pass params to backend.
        });
    };

    const resetData = () => {
        toast.info("Cannot reset persistent database from client.");
    };

    const value = {
        transactions,
        sessions,
        activeSession,
        groups,
        loading,

        postSession,
        getGroupTransactions,
        reverseSession,
        resetData,

        startSession,
        closeSession,
        extendSession,
        addGroup
    };

    return <TransactionContext.Provider value={value}>{children}</TransactionContext.Provider>;
};
