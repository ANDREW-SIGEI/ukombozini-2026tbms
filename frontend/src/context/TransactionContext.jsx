import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { api } from '../services/api';

const TransactionContext = createContext();

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
        let mounted = true;

        const fetchData = async () => {
            try {
                // Fetch Groups
                const groupsData = await api.getGroups().catch(err => {
                    if (err.name === 'AbortError') return [];
                    throw err;
                });
                if (mounted) setGroups(groupsData || []);

                // Fetch Sessions
                const fetchedSessions = await api.getMeetingSessions().catch(err => {
                    if (err.name === 'AbortError') return [];
                    throw err;
                });

                if (mounted) {
                    setSessions(fetchedSessions || []);
                    // Restore Active Session
                    const active = fetchedSessions?.find(s => s.status === 'ACTIVE' || s.status === 'OPEN');
                    if (active) setActiveSession(active);
                }

            } catch (error) {
                if (error.name !== 'AbortError' && mounted) {
                    console.error("Failed to fetch initial data", error);
                    // toast.error("Connection Error: Could not load system data."); // Suppress generic toast on load
                }
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchData();

        return () => {
            mounted = false;
        };
    }, []);

    // Load transactions
    useEffect(() => {
        let mounted = true;
        const loadTransactions = async () => {
            if (sessions.length > 0) {
                const data = await api.getTransactions(null, { timeout: 20000 }).catch(err => {
                    if (err.name === 'AbortError') return [];
                    console.error("Failed to load transactions:", err);
                    throw err;
                });
                if (mounted) setTransactions(data || []);
            }
        };
        loadTransactions();
        return () => { mounted = false; };
    }, [sessions]);

    /**
     * Start a new Group Meeting
     */
    const startSession = async (group, officer) => {
        if (activeSession) {
            toast.warn("There is already an active meeting session.");
            return activeSession;
        }

        // Calculate next session number for this group
        const groupSessions = sessions.filter(s => s.group_id === group.id);
        const nextSessionNumber = groupSessions.length + 1;

        const payload = {
            groupId: group.id,
            officerId: officer.id,
            sessionNumber: nextSessionNumber,
            date: new Date().toISOString().split('T')[0],
            status: 'OPEN'
        };

        try {
            const newSessionRaw = await api.createMeeting(payload);

            if (newSessionRaw) {
                // Transform to match UI expectation if necessary, or just use raw if standard
                // api.getMeetingSessions returns transformed. api.createMeeting returns raw DB row.
                // Let's standardise activeSession to DB row + extras?
                // For consistency, let's just use what we get, but notice getMeetingSessions maps snak_case to camelCase partially?
                // Checking api.getMeetingSessions: it maps id, session_number, group_id...
                // Checking api.createMeeting: returns raw DB columns (id, session_number, group_id...)
                // UI seems to use mixed. Let's stick to DB columns where possible or map.
                // TransactionContext previously used: id, status, totals... local camelCase?
                // Let's assume the UI handles what it gets.

                const newSession = {
                    ...newSessionRaw,
                    groupName: group.group_name || group.name,
                    startTime: new Date().toISOString(), // Proxy
                    endTime: new Date(Date.now() + 2 * 3600 * 1000).toISOString()
                };

                setActiveSession(newSession);
                setSessions(prev => [newSession, ...prev]);
                toast.success(`Meeting Started for ${group.group_name || group.name}.`);
                return newSession;
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    /**
     * Close Meeting (Submit for Approval / Lock)
     */
    const closeSession = async (totals, transactions, balances) => {
        if (!activeSession) return;

        try {
            // api.closeMeeting updates status to CLOSED
            const updatedSession = await api.closeMeeting(activeSession.id, {
                totalContributions: totals.totalContributions || totals.savings, // Adapt keys as needed
                totalLoanDisbursements: totals.totalLoanDisbursements || totals.loans,
                totalRepayments: totals.totalRepayments || totals.repayments
            });

            if (updatedSession) {
                // Update local state
                setSessions(prev => prev.map(s => s.id === activeSession.id ? updatedSession : s));
                setActiveSession(null);

                toast.info("Meeting Closed & Synced to Database.");
                return updatedSession;
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    /**
     * Extend Active Meeting
     */
    const extendSession = (minutes, reason) => {
        if (!activeSession) return;

        // Purely local visual update for now
        const currentEnd = new Date(activeSession.endTime || Date.now());
        const newEnd = new Date(currentEnd.getTime() + minutes * 60 * 1000);

        setActiveSession(prev => ({
            ...prev,
            endTime: newEnd.toISOString()
        }));
        toast.success(`Meeting extended by ${minutes} minutes. (Local override)`);
    };

    /**
     * Register a New Group (Supabase)
     */
    const addGroup = async (groupData) => {
        try {
            const data = await api.createGroup(groupData);
            if (data) {
                setGroups(prev => [...prev, data]);
                toast.success(`Group "${data.group_name}" registered successfully!`);
                return data;
            }
        } catch (error) {
            console.error(error);
            toast.error(error.message);
        }
    };

    /**
     * Post a new meeting session (Approve/Finalize)
     * Includes Table Banking Allocation Matrix data
     */
    const postSession = async (sessionMetadata, newTransactions, allocationData = {}, disbursedLoans = []) => {
        try {
            // 1. Commit Allocation Matrix (if provided)
            if (Object.keys(allocationData).length > 0) {
                await api.commitAllocation(sessionMetadata.id, allocationData);
            }

            // 2. Process Disbursed Loans (if any)
            if (disbursedLoans.length > 0) {
                for (const loan of disbursedLoans) {
                    try {
                        // A. Create Loan Application
                        const appResult = await api.postLoanApplication({
                            memberId: loan.memberId,
                            groupId: sessionMetadata.groupId,
                            loanType: loan.loanType,
                            amount: loan.amount,
                            duration: loan.duration,
                            purpose: loan.purpose,
                            monthly_installment: loan.monthlyRepayment,
                            principal_portion: loan.principal_portion,
                            interest_portion: loan.interest_portion,
                            shares_contribution: loan.shares_contribution || 0,
                            officerId: sessionMetadata.officerId,
                            guarantor1_id: loan.guarantor1_id,
                            guarantor2_id: loan.guarantor2_id
                        });

                        // B. If auto-approved, trigger disbursement flow
                        if (loan.approvalStatus === 'Auto-Approved' && appResult.id) {
                            await api.updateLoanApplicationStatus(appResult.id, 'APPROVED', 'Automatically approved during meeting session');
                        }
                    } catch (loanError) {
                        console.error("Failed to process loan for member:", loan.memberId, loanError);
                        toast.error(`Loan issuance failed for ${loan.memberName}: ${loanError.message}`);
                        // We continue with other transactions even if one loan fails, or should we abort? 
                        // For now, let's just log and continue.
                    }
                }
            }

            // 3. Call API to post session and transactions
            const result = await api.postMeeting(sessionMetadata.id, {
                metadata: sessionMetadata,
                transactions: newTransactions
            });

            if (result && result.success) {
                toast.success(`Session Posted successfully!`);

                // Refetch sessions and transactions to update local state
                const fetchedSessions = await api.getMeetingSessions();
                setSessions(fetchedSessions || []);

                const data = await api.getTransactions();
                setTransactions(data || []);

                return true;
            }
            return false;
        } catch (error) {
            toast.error(error.message || "Failed to post session");
            return false;
        }
    };

    /**
     * Reverse Session
     */
    const reverseSession = async (sessionId, reason, adminUser) => {
        toast.warn("Reversal Logic: Please reverse individual transactions in the Transaction Log.");
        return false;
    };

    // Filter Helper
    const getGroupTransactions = (groupId, month, year) => {
        return transactions.filter(t => {
            // Check based on created_at
            if (!t.created_at) return false;
            const d = new Date(t.created_at);
            return (!groupId || t.group_id === groupId) &&
                (month === undefined || d.getMonth() === month) &&
                (year === undefined || d.getFullYear() === year);
        });
    };

    const resetData = () => {
        toast.info("Database is persistent. Cannot reset from client.");
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
