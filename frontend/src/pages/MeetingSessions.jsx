import React, { useState, useEffect, useMemo } from 'react';
import {
    FaCalendarAlt,
    FaLock,
    FaUnlock,
    FaUsers,
    FaMoneyBillWave,
    FaCheckCircle,
    FaTimesCircle,
    FaClock,
    FaFileAlt,
    FaFilePdf,
    FaPlus,
    FaSearch,
    FaMapMarkerAlt,
    FaListUl,
    FaClipboardList,
    FaEdit,
    FaUserCheck,
    FaUserTimes,
    FaArrowLeft,
    FaCoins,
    FaShieldAlt,
    FaExclamationTriangle,
    FaBox,
    FaPlay,
    FaBolt,
    FaCheckDouble,
    FaArrowRight,
    FaLeaf,
    FaGraduationCap
} from 'react-icons/fa';
import { FaHandHoldingDollar } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import { useTransactions } from '../context/TransactionContext';
import { useAuth } from '../context/AuthContext';
import MeetingLedger from '../components/MeetingLedger';
import SmartTransactionPanel from '../components/SmartTransactionPanel';
import NotificationService from '../services/NotificationService';
import { api } from '../services/api';
import offlineManager from '../services/OfflineManager';
import SearchableGroupSelector from '../components/SearchableGroupSelector';

/**
 * TransactionInput Component for grid-based entry
 */
const TransactionInput = ({ value, onChange, disabled, rowIndex, colIndex, totalRows, totalCols, placeholder = "0" }) => {
    const handleKeyDown = (e) => {
        const { key } = e;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) {
            e.preventDefault();

            let nextRow = rowIndex;
            let nextCol = colIndex;

            if (key === 'ArrowUp') nextRow = Math.max(0, rowIndex - 1);
            if (key === 'ArrowDown' || key === 'Enter') {
                if (colIndex === totalCols - 1 || key === 'Enter') {
                    if (rowIndex < totalRows - 1) {
                        nextRow = rowIndex + 1;
                        nextCol = 0;
                    }
                } else {
                    nextRow = Math.min(totalRows - 1, rowIndex + 1);
                }
            }
            if (key === 'ArrowLeft') nextCol = Math.max(0, colIndex - 1);
            if (key === 'ArrowRight') nextCol = Math.min(totalCols - 1, colIndex + 1);

            const nextInput = document.querySelector(`input[data-cockpit-row="${nextRow}"][data-cockpit-col="${nextCol}"]`);
            if (nextInput) {
                nextInput.focus();
                nextInput.select();
            }
        }
    };

    return (
        <input
            type="number"
            min="0"
            step="10"
            value={value === 0 ? '' : value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={(e) => e.target.select()}
            disabled={disabled}
            data-cockpit-row={rowIndex}
            data-cockpit-col={colIndex}
            className={`w-full px-2 py-1.5 text-right border-2 rounded-lg focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-bold transition-all text-xs ${disabled ? 'bg-gray-50 opacity-40 cursor-not-allowed border-gray-100' : 'bg-white border-slate-100 text-slate-700'
                }`}
            placeholder={placeholder}
        />
    );
};

const MeetingSessions = () => {
    const [meetings, setMeetings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [showAllSessions, setShowAllSessions] = useState(false);

    const [showOpenModal, setShowOpenModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState(null);
    const [closingNotes, setClosingNotes] = useState('');
    const [showLedger, setShowLedger] = useState(false);

    // Cockpit State
    const [showCockpit, setShowCockpit] = useState(false);
    const [cockpitSession, setCockpitSession] = useState(null);
    const [sessionMembers, setSessionMembers] = useState([]);
    const [memberTransactions, setMemberTransactions] = useState([]); // Array of objects for grid
    const [memberAttendance, setMemberAttendance] = useState({});
    const [cockpitLoading, setCockpitLoading] = useState(false);
    const [memberSearchTerm, setMemberSearchTerm] = useState('');
    const [isStandardMode, setIsStandardMode] = useState(true);
    const [groupExposure, setGroupExposure] = useState(null);
    const [loansDue, setLoansDue] = useState({});
    const [riskMetrics, setRiskMetrics] = useState({});

    // Group Actions State
    const [showGroupLoanModal, setShowGroupLoanModal] = useState(false);
    const [groupLoanType, setGroupLoanType] = useState(null);
    const [groupLoanAmount, setGroupLoanAmount] = useState('');
    const [groupLoanNotes, setGroupLoanNotes] = useState('');
    const [processingGroupLoan, setProcessingGroupLoan] = useState(false);

    // New meeting form
    const [newMeeting, setNewMeeting] = useState({
        group_id: '',
        meeting_date: new Date().toISOString().split('T')[0],
        venue: '',
        agenda: '',
        meeting_type: 'Routine',
        expected_attendance: ''
    });

    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);

    const { groups } = useTransactions();
    const { user, isAuditor } = useAuth();

    const isElevatedRole = useMemo(() => {
        const role = (user?.role || '').toLowerCase();
        return role.includes('admin') || role.includes('director') || role.includes('auditor') || role === 'super_user';
    }, [user?.role]);

    const assignedGroupIds = useMemo(() => {
        if (isElevatedRole) return null;
        return user?.assigned_group_ids || user?.groupIds || [];
    }, [user, isElevatedRole]);

    const matrixFilteredGroups = useMemo(() => {
        if (isElevatedRole || !assignedGroupIds) return groups;
        return groups.filter(g => assignedGroupIds.includes(g.id));
    }, [groups, assignedGroupIds, isElevatedRole]);

    useEffect(() => {
        loadMeetings();
    }, []);

    const loadMeetings = async () => {
        setIsLoading(true);
        try {
            const data = await api.getMeetingSessions();

            // [NEW] Merge pending offline transactions for immediate accumulation visibility in list
            const pendingTxs = await offlineManager.getPendingTransactions();
            const enrichedMeetings = (data || []).map(m => {
                const sessionPending = pendingTxs.filter(tx =>
                    (tx.data?.meetingId === m.id || tx.data?.sessionId === m.id || tx.meetingId === m.id || tx.sessionId === m.id)
                );

                if (sessionPending.length > 0) {
                    const pendingTotal = sessionPending.reduce((sum, tx) => {
                        const amount = tx.data?.amount || tx.amount || 0;
                        return sum + parseFloat(amount);
                    }, 0);

                    return {
                        ...m,
                        total_collected: (parseFloat(m.total_collected) || 0) + pendingTotal
                    };
                }
                return m;
            });

            setMeetings(enrichedMeetings);
        } catch (error) {
            toast.error("Failed to load meetings");
        } finally {
            setIsLoading(false);
        }
    };

    const openCockpit = async (meeting) => {
        setCockpitLoading(true);
        setShowCockpit(true);
        setCockpitSession(meeting);

        try {
            const [members, attendance, dueSummary, exposure, sessionTxs] = await Promise.all([
                api.getMembersByGroup(meeting.group_id),
                api.getAttendance(meeting.id).catch(() => []),
                api.getLoansDueSummary(meeting.group_id).catch(() => []),
                api.getGroupExposure(meeting.group_id).catch(() => null),
                api.getSessionTransactions(meeting.id).catch(() => [])
            ]);

            setSessionMembers(members || []);
            setGroupExposure(exposure);
            setRiskMetrics(exposure?.memberMetrics || {});

            const attendanceMap = {};
            (attendance || []).forEach(a => { attendanceMap[a.member_id] = a.status; });
            (members || []).forEach(m => { if (!attendanceMap[m.id]) attendanceMap[m.id] = 'PRESENT'; });
            setMemberAttendance(attendanceMap);

            const dueMap = {};
            (dueSummary || []).forEach(d => { dueMap[d.member_id] = d; });
            setLoansDue(dueMap);

            // Fetch group settings for defaults
            const groupDetails = await api.getGroupById(meeting.group_id).catch(() => null);

            // Map existing transactions to member rows
            const txByMember = {};
            (sessionTxs || []).forEach(tx => {
                if (!txByMember[tx.member_id]) {
                    txByMember[tx.member_id] = { savings: 0, welfare: 0, stl_repay: 0, ltl_repay: 0, penalty: 0, product_repay: 0, agri: 0, edu: 0 };
                }
                const type = tx.type?.toLowerCase() || tx.transaction_type?.toLowerCase() || '';
                if (type === 'savings' || type === 'contribution') txByMember[tx.member_id].savings += tx.amount;
                else if (type === 'welfare') txByMember[tx.member_id].welfare += tx.amount;
                else if (type === 'loan_repayment' && tx.loan_type === 'STL') txByMember[tx.member_id].stl_repay += tx.amount;
                else if (type === 'loan_repayment' && tx.loan_type === 'LTL') txByMember[tx.member_id].ltl_repay += tx.amount;
                else if (type === 'penalty') txByMember[tx.member_id].penalty += tx.amount;
                else if (type === 'product_financing_repayment') txByMember[tx.member_id].product_repay += tx.amount;
                else if (type === 'project_savings' && tx.project_type === 'AGRICULTURE') txByMember[tx.member_id].agri += tx.amount;
                else if (type === 'project_savings' && tx.project_type === 'EDUCATION') txByMember[tx.member_id].edu += tx.amount;
            });

            // [NEW] Merge pending offline transactions for immediate accumulation visibility
            const pendingTxs = await offlineManager.getPendingTransactions();
            pendingTxs.filter(tx => (tx.data?.sessionId === meeting.id || tx.data?.meetingId === meeting.id)).forEach(tx => {
                const data = tx.data;
                const mId = data.memberId;
                if (!txByMember[mId]) {
                    txByMember[mId] = { savings: 0, welfare: 0, stl_repay: 0, ltl_repay: 0, penalty: 0, product_repay: 0, agri: 0, edu: 0 };
                }
                const type = data.transaction_type?.toLowerCase() || tx.type?.toLowerCase() || '';
                if (type === 'savings' || type === 'contribution' || type === 'contributions') txByMember[mId].savings += data.amount;
                else if (type === 'welfare') txByMember[mId].welfare += data.amount;
                else if (type === 'loan_repayment' && data.loanType === 'STL') txByMember[mId].stl_repay += data.amount;
                else if (type === 'loan_repayment' && data.loanType === 'LTL') txByMember[mId].ltl_repay += data.amount;
                else if (type === 'penalty') txByMember[mId].penalty += data.amount;
                else if (type === 'product_financing_repayment') txByMember[mId].product_repay += data.amount;
                else if (type === 'project_savings' && data.project_type === 'AGRICULTURE') txByMember[mId].agri += data.amount;
                else if (type === 'project_savings' && data.project_type === 'EDUCATION') txByMember[mId].edu += data.amount;
            });

            // Initialize Grid
            const gridData = (members || []).map(m => ({
                id: m.id,
                name: m.name || m.full_name || m.fullName,
                phone: m.phone,
                attendance: attendanceMap[m.id] || 'PRESENT',
                savings: txByMember[m.id]?.savings || (isStandardMode ? (groupDetails?.default_savings || 500) : 0),
                welfare: txByMember[m.id]?.welfare || (isStandardMode ? (groupDetails?.default_welfare || 100) : 0),
                stl_repay: txByMember[m.id]?.stl_repay || 0,
                ltl_repay: txByMember[m.id]?.ltl_repay || 0,
                penalty: txByMember[m.id]?.penalty || 0,
                product_repay: txByMember[m.id]?.product_repay || 0,
                agri: txByMember[m.id]?.agri || 0,
                edu: txByMember[m.id]?.edu || 0,
                committed: !!txByMember[m.id] // Mark as done if transactions exist
            }));

            setMemberTransactions(gridData);
        } catch (error) {
            console.error('Failed to load cockpit data:', error);
            toast.error('Failed to load session data');
        } finally {
            setCockpitLoading(false);
        }
    };

    const updateGridValue = (memberId, field, value) => {
        setMemberTransactions(prev => prev.map(m =>
            m.id === memberId ? { ...m, [field]: value } : m
        ));
    };

    const toggleAttendance = async (memberId) => {
        const current = memberTransactions.find(m => m.id === memberId)?.attendance || 'PRESENT';
        const order = ['PRESENT', 'LATE', 'ABSENT'];
        const next = order[(order.indexOf(current) + 1) % order.length];

        try {
            await api.recordAttendance(cockpitSession.id, memberId, next);
            setMemberTransactions(prev => prev.map(m =>
                m.id === memberId ? { ...m, attendance: next } : m
            ));
            toast.success(`Marked as ${next}`, { autoClose: 1000 });
        } catch (err) {
            toast.error("Failed to update attendance");
        }
    };

    const handleCommitMember = async (member) => {
        if (isAuditor) return toast.warning("🛡️ Auditor Mode: Commit blocked.");

        const total = parseFloat(member.savings || 0) +
            parseFloat(member.welfare || 0) +
            parseFloat(member.stl_repay || 0) +
            parseFloat(member.ltl_repay || 0) +
            parseFloat(member.penalty || 0) +
            parseFloat(member.product_repay || 0) +
            parseFloat(member.agri || 0) +
            parseFloat(member.edu || 0);

        if (total === 0 && member.attendance === 'PRESENT') {
            return toast.warning(`No amounts entered for ${member.name}`);
        }

        toast.info(`💾 Committing entries for ${member.name}...`);

        try {
            const promises = [];

            if (parseFloat(member.savings) > 0) promises.push(api.postContribution({
                memberId: member.id,
                meetingId: cockpitSession.id,
                groupId: cockpitSession.group_id,
                type: 'CONTRIBUTION',
                amount: parseFloat(member.savings),
                savings_amount: parseFloat(member.savings)
            }));

            if (parseFloat(member.welfare) > 0) promises.push(api.postContribution({
                memberId: member.id,
                meetingId: cockpitSession.id,
                groupId: cockpitSession.group_id,
                type: 'WELFARE',
                amount: parseFloat(member.welfare),
                welfare: parseFloat(member.welfare)
            }));

            if (parseFloat(member.stl_repay) > 0) promises.push(api.postTransaction({
                memberId: member.id,
                sessionId: cockpitSession.id,
                groupId: cockpitSession.group_id,
                transaction_type: 'LOAN_REPAYMENT',
                amount: parseFloat(member.stl_repay),
                loanType: 'STL'
            }));

            if (parseFloat(member.ltl_repay) > 0) promises.push(api.postTransaction({
                memberId: member.id,
                sessionId: cockpitSession.id,
                groupId: cockpitSession.group_id,
                transaction_type: 'LOAN_REPAYMENT',
                amount: parseFloat(member.ltl_repay),
                loanType: 'LTL'
            }));

            if (parseFloat(member.penalty) > 0) promises.push(api.postTransaction({
                memberId: member.id,
                sessionId: cockpitSession.id,
                groupId: cockpitSession.group_id,
                transaction_type: 'PENALTY',
                amount: parseFloat(member.penalty)
            }));

            if (parseFloat(member.product_repay) > 0) promises.push(api.postTransaction({
                memberId: member.id,
                sessionId: cockpitSession.id,
                groupId: cockpitSession.group_id,
                transaction_type: 'PRODUCT_FINANCING_REPAYMENT',
                amount: parseFloat(member.product_repay)
            }));

            if (parseFloat(member.agri) > 0) promises.push(api.postTransaction({
                memberId: member.id,
                sessionId: cockpitSession.id,
                groupId: cockpitSession.group_id,
                transaction_type: 'PROJECT_SAVINGS',
                project_type: 'AGRICULTURE',
                amount: parseFloat(member.agri)
            }));

            if (parseFloat(member.edu) > 0) promises.push(api.postTransaction({
                memberId: member.id,
                sessionId: cockpitSession.id,
                groupId: cockpitSession.group_id,
                transaction_type: 'PROJECT_SAVINGS',
                project_type: 'EDUCATION',
                amount: parseFloat(member.edu)
            }));

            await Promise.all(promises);
            updateGridValue(member.id, 'committed', true);
            toast.success(`✓ Entries for ${member.name} persisted!`);
        } catch (error) {
            toast.error(`Failed to commit ${member.name}`);
        }
    };

    const handleCommitAll = async () => {
        const pending = memberTransactions.filter(m => !m.committed && m.attendance !== 'ABSENT');
        if (pending.length === 0) return toast.info("All present members are already committed.");

        for (const member of pending) {
            await handleCommitMember(member);
        }
        toast.success("✅ Bulk commit completed!");
    };

    const cockpitTotals = useMemo(() => {
        return memberTransactions.reduce((acc, current) => {
            if (current.attendance === 'ABSENT') return acc;
            acc.savings += parseFloat(current.savings || 0);
            acc.welfare += parseFloat(current.welfare || 0);
            acc.stl += parseFloat(current.stl_repay || 0);
            acc.ltl += parseFloat(current.ltl_repay || 0);
            acc.penalty += parseFloat(current.penalty || 0);
            acc.product += parseFloat(current.product_repay || 0);
            acc.agri += parseFloat(current.agri || 0);
            acc.edu += parseFloat(current.edu || 0);
            acc.total = acc.savings + acc.welfare + acc.stl + acc.ltl + acc.penalty + acc.product + acc.agri + acc.edu;
            return acc;
        }, { savings: 0, welfare: 0, stl: 0, ltl: 0, penalty: 0, product: 0, agri: 0, edu: 0, total: 0 });
    }, [memberTransactions]);

    const filteredGridRows = useMemo(() => {
        return memberTransactions.filter(m =>
            m.name?.toLowerCase().includes(memberSearchTerm.toLowerCase()) || m.phone?.includes(memberSearchTerm)
        );
    }, [memberTransactions, memberSearchTerm]);

    const handleSaveMeeting = async () => {
        if (!newMeeting.group_id) return toast.error('Please select a group');
        try {
            if (isEditing) {
                await api.updateMeeting(editId, {
                    date: newMeeting.meeting_date,
                    venue: newMeeting.venue,
                    agenda: newMeeting.agenda,
                    meeting_type: newMeeting.meeting_type,
                    expected_attendance: newMeeting.expected_attendance
                });
                toast.success("Meeting rescheduled successfully!");
            } else {
                await api.createMeeting({
                    groupId: parseInt(newMeeting.group_id),
                    officerId: user.id,
                    date: newMeeting.meeting_date,
                    venue: newMeeting.venue,
                    agenda: newMeeting.agenda,
                    meeting_type: newMeeting.meeting_type,
                    expected_attendance: newMeeting.expected_attendance
                });
                toast.success("New meeting session opened!");
            }
            setShowOpenModal(false);
            loadMeetings();
        } catch (error) {
            toast.error("Failed to save meeting session");
        }
    };

    const handleCloseMeeting = async () => {
        if (!closingNotes) return toast.error("Closing notes are required");
        try {
            await api.closeMeeting(selectedMeeting.id, { notes: closingNotes });
            toast.success("Meeting session closed and locked!");
            setShowCloseModal(false);
            setClosingNotes('');
            loadMeetings();
            if (showCockpit) setShowCockpit(false);
        } catch (error) {
            toast.error("Failed to close meeting");
        }
    };

    const handleGroupLoanRepayment = async () => {
        if (!groupLoanAmount) return toast.error("Amount required");
        setProcessingGroupLoan(true);
        try {
            await api.postTransaction({
                groupId: cockpitSession.group_id,
                sessionId: cockpitSession.id,
                transaction_type: 'GROUP_LOAN_REPAYMENT',
                amount: parseFloat(groupLoanAmount),
                loanType: groupLoanType,
                description: groupLoanNotes
            });
            toast.success(`${groupLoanType} Repayment recorded!`);
            setShowGroupLoanModal(false);
            openCockpit(cockpitSession);
        } catch (error) {
            toast.error("Failed to record group repayment");
        } finally {
            setProcessingGroupLoan(false);
        }
    };

    const filteredMeetings = useMemo(() => {
        let filtered = meetings;
        if (!isElevatedRole && assignedGroupIds) {
            filtered = filtered.filter(m => assignedGroupIds.includes(m.group_id));
        }
        if (filterStatus !== 'ALL') filtered = filtered.filter(m => m.status === filterStatus);

        // Hide stale sessions (older than 30 days) if not requested to show all
        if (!showAllSessions) {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            filtered = filtered.filter(m => new Date(m.date) >= thirtyDaysAgo || m.status === 'ACTIVE');
        }

        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            filtered = filtered.filter(m => m.group_name?.toLowerCase().includes(q) || m.session_number?.toLowerCase().includes(q));
        }
        return filtered;
    }, [meetings, filterStatus, searchTerm, isElevatedRole, assignedGroupIds, showAllSessions]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-gray-400 font-bold uppercase text-[10px]">Loading Sessions...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 tracking-tight">Meeting Management</h2>
                    <p className="text-sm text-gray-500 font-medium">Coordinate and track official group sessions.</p>
                </div>
                <button
                    onClick={() => {
                        setIsEditing(false);
                        setNewMeeting({
                            group_id: '',
                            meeting_date: new Date().toISOString().split('T')[0],
                            venue: '',
                            agenda: '',
                            meeting_type: 'Routine',
                            expected_attendance: ''
                        });
                        setShowOpenModal(true);
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2"
                >
                    <FaPlus /> Start New Session
                </button>
            </div>

            {/* List & Filtering */}
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-8 border-b border-gray-50 flex flex-col lg:flex-row justify-between items-center gap-6">
                    <div className="flex gap-2 items-center">
                        <button
                            onClick={() => setShowAllSessions(!showAllSessions)}
                            className={`mr-4 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showAllSessions ? 'bg-blue-100 text-blue-600' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                                }`}
                        >
                            {showAllSessions ? 'Showing All' : 'Showing Recent'}
                        </button>
                        {['ALL', 'ACTIVE', 'CLOSED'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterStatus === status ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                                    }`}
                            >
                                {status === 'CLOSED' ? 'Completed' : status}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full max-w-md">
                        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by group or session..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-transparent rounded-2xl font-bold focus:border-blue-500 focus:bg-white focus:outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Session #</th>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Group</th>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Date / Type</th>
                                <th className="px-8 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Funds</th>
                                <th className="px-8 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                <th className="px-8 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredMeetings.map(m => (
                                <tr key={m.id} className="hover:bg-gray-50/30 transition-colors group">
                                    <td className="px-8 py-5">
                                        <div className="font-black text-blue-600 font-mono">{m.session_number}</div>
                                        <div className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">{m.officer_name}</div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="font-black text-gray-800">{m.group_name}</div>
                                        <div className="text-[9px] font-bold text-gray-400 uppercase mt-0.5 flex items-center gap-1">
                                            <FaMapMarkerAlt size={8} /> {m.venue || 'No Venue'}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="font-bold text-gray-700">{new Date(m.meeting_date).toLocaleDateString()}</div>
                                        <div className="text-[9px] font-black text-blue-400 uppercase tracking-tighter mt-0.5">{m.meeting_type}</div>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <div className="font-black text-slate-800">KES {(m.total_collected || 0).toLocaleString()}</div>
                                        <div className="text-[9px] font-bold text-green-500 uppercase">Success Rate: {m.expected_attendance ? Math.round(((m.actual_attendance || 0) / m.expected_attendance) * 100) : 0}%</div>
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${m.status === 'ACTIVE' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
                                            }`}>
                                            {m.status}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        {m.status === 'ACTIVE' ? (
                                            <button
                                                onClick={() => openCockpit(m)}
                                                className="px-6 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95 flex items-center gap-2 ml-auto"
                                            >
                                                <FaPlay /> Cockpit
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => { setSelectedMeeting(m); setShowLedger(true); }}
                                                className="px-6 py-2 bg-gray-50 border border-gray-200 text-gray-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all ml-auto"
                                            >
                                                View Journal
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* COCKPIT GRID OVERLAY */}
            {showCockpit && cockpitSession && (
                <div className="fixed inset-0 z-[70] bg-slate-50 flex flex-col">
                    {/* Header */}
                    <div className="bg-slate-900 text-white p-6 shrink-0 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-6 w-full md:w-auto">
                            <button onClick={() => setShowCockpit(false)} className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all">
                                <FaArrowLeft />
                            </button>
                            <div>
                                <h1 className="text-2xl font-black tracking-tight">{cockpitSession.group_name}</h1>
                                <p className="text-blue-400 text-xs font-bold uppercase tracking-widest">Session {cockpitSession.session_number} • Bulk Entry Grid</p>
                            </div>
                        </div>

                        <div className="flex gap-4 w-full md:w-auto overflow-x-auto">
                            <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl">
                                <p className="text-[10px] font-bold text-white/40 uppercase">Session Liquidity</p>
                                <p className="text-xl font-black text-green-400">KES {cockpitTotals.total.toLocaleString()}</p>
                            </div>
                            <button
                                onClick={() => setIsStandardMode(!isStandardMode)}
                                className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shrink-0 ${isStandardMode ? 'bg-safaricom-green text-white shadow-lg shadow-green-900/20' : 'bg-white/10 text-white'
                                    }`}
                            >
                                <FaBolt /> {isStandardMode ? 'Standard' : 'Manual'}
                            </button>
                            <button
                                onClick={() => setShowCloseModal(true)}
                                className="px-6 py-3 bg-red-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-red-900/20 hover:bg-red-700 transition-all flex items-center gap-2 shrink-0"
                            >
                                <FaLock /> Finish & Close
                            </button>
                        </div>
                    </div>

                    {/* Dashboard Strip */}
                    <div className="bg-slate-800 px-6 py-3 flex items-center gap-8 shrink-0 overflow-x-auto no-scrollbar border-b border-slate-700">
                        <div className="flex items-center gap-2 text-[11px] font-black text-slate-400"><FaCoins className="text-blue-400" /> SLP: <span className="text-white">KES {cockpitTotals.savings.toLocaleString()}</span></div>
                        <div className="flex items-center gap-2 text-[11px] font-black text-slate-400"><FaShieldAlt className="text-teal-400" /> WLF: <span className="text-white">KES {cockpitTotals.welfare.toLocaleString()}</span></div>
                        <div className="flex items-center gap-2 text-[11px] font-black text-slate-400"><FaHandHoldingDollar className="text-orange-400" /> STL: <span className="text-white">KES {cockpitTotals.stl.toLocaleString()}</span></div>
                        <div className="flex items-center gap-2 text-[11px] font-black text-slate-400"><FaHandHoldingDollar className="text-amber-400" /> LTL: <span className="text-white">KES {cockpitTotals.ltl.toLocaleString()}</span></div>
                        <div className="flex items-center gap-2 text-[11px] font-black text-slate-400"><FaLeaf className="text-green-400" /> AGRI: <span className="text-white">KES {cockpitTotals.agri.toLocaleString()}</span></div>
                        <div className="flex items-center gap-2 text-[11px] font-black text-slate-400"><FaGraduationCap className="text-blue-300" /> EDU: <span className="text-white">KES {cockpitTotals.edu.toLocaleString()}</span></div>
                        <div className="flex items-center gap-2 text-[11px] font-black text-slate-400"><FaExclamationTriangle className="text-red-400" /> FINE: <span className="text-white">KES {cockpitTotals.penalty.toLocaleString()}</span></div>
                        <div className="flex items-center gap-2 text-[11px] font-black text-slate-400"><FaBox className="text-purple-400" /> ASSET: <span className="text-white">KES {cockpitTotals.product.toLocaleString()}</span></div>
                    </div>

                    {/* Grid Controls */}
                    <div className="p-6 shrink-0 bg-white border-b flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="relative w-full max-w-md">
                            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search member in grid..."
                                value={memberSearchTerm}
                                onChange={(e) => setMemberSearchTerm(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-transparent rounded-2xl font-bold focus:border-blue-500 focus:bg-white focus:outline-none transition-all"
                            />
                        </div>
                        <div className="flex gap-3 w-full md:w-auto">
                            <button onClick={handleCommitAll} className="flex-1 md:flex-none px-6 py-3 bg-blue-100 text-blue-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-200 transition-all flex items-center justify-center gap-2">
                                <FaCheckDouble /> Commit All Present
                            </button>
                            <button
                                onClick={() => setShowGroupLoanModal(true)}
                                className="flex-1 md:flex-none px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-100"
                            >
                                <FaUsers /> Group Repayment
                            </button>
                        </div>
                    </div>

                    {/* Main Grid */}
                    <div className="flex-1 overflow-auto p-6">
                        {cockpitLoading ? (
                            <div className="h-full flex flex-col items-center justify-center space-y-4">
                                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                <p className="text-slate-400 font-bold uppercase text-[10px]">Assembling Grid...</p>
                            </div>
                        ) : (
                            <table className="w-full border-separate border-spacing-0">
                                <thead className="sticky top-0 z-20 bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-4 text-center text-[10px] font-black text-slate-400 uppercase w-16 border-b border-slate-200">#</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase border-b border-slate-200 min-w-[200px]">Member / Risk</th>
                                        <th className="px-3 py-4 text-right text-[10px] font-black text-blue-500 uppercase border-b border-slate-200 w-28">SLP</th>
                                        <th className="px-3 py-4 text-right text-[10px] font-black text-teal-600 uppercase border-b border-slate-200 w-28">WLF</th>
                                        <th className="px-3 py-4 text-right text-[10px] font-black text-orange-600 uppercase border-b border-slate-200 w-28">STL</th>
                                        <th className="px-3 py-4 text-right text-[10px] font-black text-amber-600 uppercase border-b border-slate-200 w-28">LTL</th>
                                        <th className="px-3 py-4 text-right text-[10px] font-black text-green-600 uppercase border-b border-slate-200 w-28">AGRI</th>
                                        <th className="px-3 py-4 text-right text-[10px] font-black text-blue-400 uppercase border-b border-slate-200 w-28">EDU</th>
                                        <th className="px-3 py-4 text-right text-[10px] font-black text-red-600 uppercase border-b border-slate-200 w-24">FINE</th>
                                        <th className="px-3 py-4 text-right text-[10px] font-black text-purple-600 uppercase border-b border-slate-200 w-24">ASSET</th>
                                        <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase border-b border-slate-200 w-20">Commit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {filteredGridRows.map((m, idx) => {
                                        const isAbsent = m.attendance === 'ABSENT';
                                        const risk = riskMetrics[m.id] || { score: 0, status: 'Healthy' };
                                        const total = (parseFloat(m.savings || 0) + parseFloat(m.welfare || 0) + parseFloat(m.stl_repay || 0) + parseFloat(m.ltl_repay || 0) + parseFloat(m.penalty || 0) + parseFloat(m.product_repay || 0) + parseFloat(m.agri || 0) + parseFloat(m.edu || 0));

                                        return (
                                            <tr key={m.id} className={`group transition-all ${isAbsent ? 'bg-slate-50/50 opacity-40' : 'hover:bg-blue-50/20'}`}>
                                                <td className="px-4 py-4 text-center">
                                                    <button
                                                        onClick={() => toggleAttendance(m.id)}
                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs transition-all ${m.attendance === 'PRESENT' ? 'bg-green-100 text-green-600' :
                                                            m.attendance === 'LATE' ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'
                                                            }`}
                                                    >
                                                        {m.attendance.charAt(0)}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-black text-slate-800 text-sm">{m.name}</div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter ${risk.status === 'At Risk' ? 'bg-red-100 text-red-600' :
                                                            risk.status === 'Stable' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
                                                            }`}>
                                                            {risk.score}% Risk
                                                        </span>
                                                        <span className="text-[8px] font-bold text-slate-400 font-mono italic tracking-tighter">KES {(risk.netPosition || 0).toLocaleString()} NP</span>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-4">
                                                    <TransactionInput
                                                        value={m.savings} onChange={(v) => updateGridValue(m.id, 'savings', v)}
                                                        disabled={isAbsent || m.committed}
                                                        rowIndex={idx} colIndex={0} totalRows={filteredGridRows.length} totalCols={8}
                                                    />
                                                </td>
                                                <td className="px-2 py-4">
                                                    <TransactionInput
                                                        value={m.welfare} onChange={(v) => updateGridValue(m.id, 'welfare', v)}
                                                        disabled={isAbsent || m.committed}
                                                        rowIndex={idx} colIndex={1} totalRows={filteredGridRows.length} totalCols={8}
                                                    />
                                                </td>
                                                <td className="px-2 py-4 relative">
                                                    <TransactionInput
                                                        value={m.stl_repay} onChange={(v) => updateGridValue(m.id, 'stl_repay', v)}
                                                        disabled={isAbsent || m.committed}
                                                        rowIndex={idx} colIndex={2} totalRows={filteredGridRows.length} totalCols={8}
                                                    />
                                                    {loansDue[m.id]?.expected_installment && (
                                                        <div className="absolute top-1 right-2 w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" title={`Due: ${loansDue[m.id].expected_installment}`} />
                                                    )}
                                                </td>
                                                <td className="px-2 py-4">
                                                    <TransactionInput
                                                        value={m.ltl_repay} onChange={(v) => updateGridValue(m.id, 'ltl_repay', v)}
                                                        disabled={isAbsent || m.committed}
                                                        rowIndex={idx} colIndex={3} totalRows={filteredGridRows.length} totalCols={8}
                                                    />
                                                </td>
                                                <td className="px-2 py-4">
                                                    <TransactionInput
                                                        value={m.agri} onChange={(v) => updateGridValue(m.id, 'agri', v)}
                                                        disabled={isAbsent || m.committed}
                                                        rowIndex={idx} colIndex={4} totalRows={filteredGridRows.length} totalCols={8}
                                                    />
                                                </td>
                                                <td className="px-2 py-4">
                                                    <TransactionInput
                                                        value={m.edu} onChange={(v) => updateGridValue(m.id, 'edu', v)}
                                                        disabled={isAbsent || m.committed}
                                                        rowIndex={idx} colIndex={5} totalRows={filteredGridRows.length} totalCols={8}
                                                    />
                                                </td>
                                                <td className="px-2 py-4">
                                                    <TransactionInput
                                                        value={m.penalty} onChange={(v) => updateGridValue(m.id, 'penalty', v)}
                                                        disabled={isAbsent || m.committed}
                                                        rowIndex={idx} colIndex={6} totalRows={filteredGridRows.length} totalCols={8}
                                                    />
                                                </td>
                                                <td className="px-2 py-4 text-purple-600">
                                                    <TransactionInput
                                                        value={m.product_repay} onChange={(v) => updateGridValue(m.id, 'product_repay', v)}
                                                        disabled={isAbsent || m.committed}
                                                        rowIndex={idx} colIndex={7} totalRows={filteredGridRows.length} totalCols={8}
                                                    />
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {m.committed ? (
                                                        <span className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-green-100">
                                                            <FaCheckCircle />
                                                        </span>
                                                    ) : (
                                                        <button
                                                            disabled={isAbsent || total === 0}
                                                            onClick={() => handleCommitMember(m)}
                                                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center mx-auto transition-all ${total > 0 ? 'border-blue-500 text-blue-500 hover:bg-blue-600 hover:text-white' : 'border-slate-100 text-slate-100'
                                                                }`}
                                                        >
                                                            <FaPlus />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Existing Modals Adapted for Harmony */}
            {showOpenModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-300">
                        <div className="p-8 bg-slate-900 flex justify-between items-center text-white">
                            <div>
                                <h3 className="text-2xl font-black tracking-tight">Open Meeting Session</h3>
                                <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mt-1">Initiating group lifecycle event</p>
                            </div>
                            <button onClick={() => setShowOpenModal(false)} className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full transition-all flex items-center justify-center"><FaTimesCircle /></button>
                        </div>
                        <div className="p-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <SearchableGroupSelector label="Group" groups={matrixFilteredGroups} selectedGroupId={newMeeting.group_id} onSelect={(id) => setNewMeeting({ ...newMeeting, group_id: id })} />
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Meeting Date</label>
                                        <input type="date" value={newMeeting.meeting_date} onChange={(e) => setNewMeeting({ ...newMeeting, meeting_date: e.target.value })} className="w-full mt-2 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500 outline-none" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Type</label>
                                            <select className="w-full mt-2 p-4 bg-slate-50 rounded-2xl font-bold" value={newMeeting.meeting_type} onChange={e => setNewMeeting({ ...newMeeting, meeting_type: e.target.value })}>
                                                <option>Routine</option><option>AGM</option><option>Special</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Target Pax</label>
                                            <input type="number" placeholder="Exp." value={newMeeting.expected_attendance} onChange={e => setNewMeeting({ ...newMeeting, expected_attendance: e.target.value })} className="w-full mt-2 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button onClick={handleSaveMeeting} className="w-full mt-10 py-5 bg-blue-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest shadow-2xl shadow-blue-200 hover:bg-black transition-all">
                                Open Session Now
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Close Session Modal */}
            {showCloseModal && cockpitSession && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <div className="bg-white rounded-[3rem] shadow-2xl max-w-md w-full p-10 text-center">
                        <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <FaLock size={40} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-2">Seal Session #{cockpitSession.session_number}</h3>
                        <p className="text-slate-500 font-medium mb-8">This will lock all entries and generate official receipts and reports.</p>
                        <textarea
                            value={closingNotes}
                            onChange={(e) => setClosingNotes(e.target.value)}
                            placeholder="Final session observations..."
                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold mb-6 min-h-[100px] outline-none focus:border-red-500"
                        />
                        <div className="flex gap-4">
                            <button onClick={() => setShowCloseModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase">Cancel</button>
                            <button onClick={handleCloseMeeting} className="flex-2 py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-red-700">Audit & Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Group Repayment Modal */}
            {showGroupLoanModal && cockpitSession && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black">Group Repayment</h3>
                                <p className="text-xs text-blue-400 font-bold uppercase tracking-widest mt-1">Direct to Central Fund (Ukombozini)</p>
                            </div>
                            <FaHandHoldingDollar size={32} className="text-blue-500" />
                        </div>
                        <div className="p-10 space-y-6">
                            <div className="flex gap-3">
                                <button onClick={() => setGroupLoanType('STL')} className={`flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border-2 transition-all ${groupLoanType === 'STL' ? 'bg-orange-600 border-orange-600 text-white' : 'border-slate-100 text-slate-400'}`}>STL Repayment</button>
                                <button onClick={() => setGroupLoanType('LTL')} className={`flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border-2 transition-all ${groupLoanType === 'LTL' ? 'bg-amber-600 border-amber-600 text-white' : 'border-slate-100 text-slate-400'}`}>LTL Repayment</button>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Repayment Amount (KES)</label>
                                <input type="number" value={groupLoanAmount} onChange={e => setGroupLoanAmount(e.target.value)} placeholder="0.00" className="w-full mt-2 p-6 text-3xl font-black text-center bg-slate-50 border-2 border-slate-100 rounded-3xl focus:border-blue-500 outline-none" />
                            </div>
                            <button disabled={!groupLoanType || !groupLoanAmount} onClick={handleGroupLoanRepayment} className="w-full py-5 bg-black text-white rounded-3xl font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-blue-600 transition-all disabled:opacity-30">
                                Post Group Repayment
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Ledger Overlay */}
            {showLedger && selectedMeeting && (
                <div className="fixed inset-0 z-[100] bg-white overflow-auto flex flex-col">
                    <div className="bg-slate-900 p-6 flex justify-between items-center text-white shrink-0">
                        <div>
                            <h3 className="text-xl font-black">Session Ledger View</h3>
                            <p className="text-xs text-blue-400 font-bold uppercase tracking-widest">{selectedMeeting.group_name} • {selectedMeeting.session_number}</p>
                        </div>
                        <button onClick={() => setShowLedger(false)} className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center font-black">X</button>
                    </div>
                    <div className="p-10 flex-1">
                        <MeetingLedger meetingId={selectedMeeting.id} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default MeetingSessions;
