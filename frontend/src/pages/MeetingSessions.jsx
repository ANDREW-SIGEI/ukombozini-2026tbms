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
    FaPlay
} from 'react-icons/fa';
import { FaHandHoldingDollar } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import { useTransactions } from '../context/TransactionContext';
import { useAuth } from '../context/AuthContext';
import MeetingLedger from '../components/MeetingLedger';
import SmartTransactionPanel from '../components/SmartTransactionPanel';
import NotificationService from '../services/NotificationService';

import { api } from '../services/api';

const MeetingSessions = () => {
    const [meetings, setMeetings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [showOpenModal, setShowOpenModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState(null);
    const [closingNotes, setClosingNotes] = useState('');
    const [showLedger, setShowLedger] = useState(false);

    // Meeting Cockpit State
    const [showCockpit, setShowCockpit] = useState(false);
    const [cockpitSession, setCockpitSession] = useState(null);
    const [sessionMembers, setSessionMembers] = useState([]);
    const [memberTransactions, setMemberTransactions] = useState({});
    const [memberAttendance, setMemberAttendance] = useState({});
    const [selectedMember, setSelectedMember] = useState(null);
    const [showTransactionPanel, setShowTransactionPanel] = useState(false);
    const [cockpitLoading, setCockpitLoading] = useState(false);
    const [memberSearchTerm, setMemberSearchTerm] = useState('');

    // Group Actions State
    const [showGroupLoanModal, setShowGroupLoanModal] = useState(false);
    const [groupLoanType, setGroupLoanType] = useState(null); // 'STL' or 'LTL'
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

    // Search state for new meeting modal
    const [groupSearchQuery, setGroupSearchQuery] = useState('');

    const { groups } = useTransactions();
    const { user } = useAuth();

    // Current user from auth context
    const currentUser = {
        id: user?.id || 1,
        name: user?.name || 'System',
        role: user?.role || 'Officer'
    };

    // Matrix Security: Check if user has elevated privileges
    const isElevatedRole = useMemo(() => {
        const role = (user?.role || '').toLowerCase();
        return role.includes('admin') || role.includes('director') || role.includes('auditor') || role === 'super_user';
    }, [user?.role]);

    // Matrix Security: Get officer's assigned group IDs
    const assignedGroupIds = useMemo(() => {
        if (isElevatedRole) return null; // null means all access
        return user?.assigned_group_ids || user?.groupIds || [];
    }, [user, isElevatedRole]);

    // Matrix-filtered groups for new meeting modal
    const matrixFilteredGroups = useMemo(() => {
        if (isElevatedRole || !assignedGroupIds) return groups;
        return groups.filter(g => assignedGroupIds.includes(g.id));
    }, [groups, assignedGroupIds, isElevatedRole]);

    // Open Meeting Cockpit for an active session
    const openCockpit = async (meeting) => {
        setCockpitLoading(true);
        setShowCockpit(true);
        setCockpitSession(meeting);

        try {
            // Fetch group members
            const members = await api.getMembersByGroup(meeting.group_id);
            setSessionMembers(members || []);

            // Initialize attendance (all present by default)
            const initialAttendance = {};
            (members || []).forEach(m => {
                initialAttendance[m.id] = true; // Present by default
            });
            setMemberAttendance(initialAttendance);

            // Fetch session transactions to show member statuses
            try {
                const txData = await api.getSessionTransactions(meeting.id);
                // Group transactions by member
                const txByMember = {};
                (txData || []).forEach(tx => {
                    if (!txByMember[tx.member_id]) {
                        txByMember[tx.member_id] = { savings: 0, welfare: 0, stl_repay: 0, ltl_repay: 0, penalty: 0, product_repay: 0 };
                    }
                    // Categorize by type
                    const type = tx.type?.toLowerCase() || '';
                    if (type === 'savings' || type === 'contribution') txByMember[tx.member_id].savings += tx.amount;
                    else if (type === 'welfare') txByMember[tx.member_id].welfare += tx.amount;
                    else if (type === 'loanrepayment' && tx.loan_type === 'STL') txByMember[tx.member_id].stl_repay += tx.amount;
                    else if (type === 'loanrepayment' && tx.loan_type === 'LTL') txByMember[tx.member_id].ltl_repay += tx.amount;
                    else if (type === 'penalty') txByMember[tx.member_id].penalty += tx.amount;
                    else if (type === 'productfinancing' || type === 'product_repay') txByMember[tx.member_id].product_repay += tx.amount;
                });
                setMemberTransactions(txByMember);
            } catch (err) {
                console.log('No session transactions yet');
                setMemberTransactions({});
            }
        } catch (error) {
            console.error('Failed to load cockpit data:', error);
            toast.error('Failed to load session members');
        } finally {
            setCockpitLoading(false);
        }
    };

    // Close cockpit and go back to list
    const closeCockpit = () => {
        setShowCockpit(false);
        setCockpitSession(null);
        setSessionMembers([]);
        setMemberTransactions({});
        setSelectedMember(null);
        setMemberSearchTerm('');
    };

    // Handle group loan repayment to Ukombozini
    const handleGroupLoanRepayment = async () => {
        if (!groupLoanAmount || parseFloat(groupLoanAmount) <= 0) {
            toast.error('Please enter a valid repayment amount');
            return;
        }

        setProcessingGroupLoan(true);
        try {
            const payload = {
                groupId: cockpitSession.group_id,
                sessionId: cockpitSession.id,
                transaction_type: 'GROUP_LOAN_REPAYMENT',
                amount: parseFloat(groupLoanAmount),
                loanType: groupLoanType, // 'STL' or 'LTL'
                description: groupLoanNotes || `Group ${groupLoanType} Repayment to Ukombozini`,
                memberId: 0 // Using 0 for group-level actions
            };

            const res = await api.postTransaction(payload);

            if (res?.success) {
                toast.success(`${groupLoanType} Repayment of KES ${parseFloat(groupLoanAmount).toLocaleString()} recorded!`);

                // Reset and close
                setShowGroupLoanModal(false);
                setGroupLoanAmount('');
                setGroupLoanNotes('');
                setGroupLoanType(null);

                // Refresh cockpit data
                openCockpit(cockpitSession);
            }
        } catch (error) {
            console.error('Group loan repayment error:', error);
            const msg = error.response?.data?.error || 'Failed to record group repayment';
            toast.error(msg);
        } finally {
            setProcessingGroupLoan(false);
        }
    };

    // Handle member click - open transaction panel
    const handleMemberClick = (member) => {
        setSelectedMember(member);
        setShowTransactionPanel(true);
    };

    // Toggle attendance
    const toggleAttendance = (memberId) => {
        setMemberAttendance(prev => ({
            ...prev,
            [memberId]: !prev[memberId]
        }));
    };


    // Filtered members for cockpit search
    const filteredSessionMembers = useMemo(() => {
        if (!memberSearchTerm.trim()) return sessionMembers;
        return sessionMembers.filter(m =>
            m.name.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
            m.phone?.includes(memberSearchTerm)
        );
    }, [sessionMembers, memberSearchTerm]);

    // Calculate session totals
    const sessionTotals = useMemo(() => {
        let savings = 0, welfare = 0, stl = 0, ltl = 0, penalty = 0, product = 0;
        Object.values(memberTransactions).forEach(tx => {
            savings += tx.savings || 0;
            welfare += tx.welfare || 0;
            stl += tx.stl_repay || 0;
            ltl += tx.ltl_repay || 0;
            penalty += tx.penalty || 0;
            product += tx.product_repay || 0;
        });
        return { savings, welfare, stl, ltl, penalty, product, total: savings + welfare + stl + ltl + penalty + product };
    }, [memberTransactions]);

    // Fetch meetings on mount
    useEffect(() => {
        loadMeetings();
    }, []);

    const loadMeetings = async () => {
        setIsLoading(true);
        try {
            const data = await api.getMeetingSessions();
            setMeetings(data);
        } catch (error) {
            toast.error("Failed to load meetings");
        } finally {
            setIsLoading(false);
        }
    };

    // Filter meetings by status AND matrix (officer-group assignment)
    const filteredMeetings = useMemo(() => {
        let filtered = meetings;

        // Matrix filtering: Field Officers only see their assigned groups
        if (!isElevatedRole && assignedGroupIds && assignedGroupIds.length > 0) {
            filtered = filtered.filter(m => assignedGroupIds.includes(m.group_id));
        }

        // Status filtering
        if (filterStatus !== 'ALL') {
            filtered = filtered.filter(m => m.status === filterStatus);
        }

        // Search filtering
        if (searchTerm.trim()) {
            const query = searchTerm.toLowerCase();
            filtered = filtered.filter(m =>
                (m.session_number || '').toLowerCase().includes(query) ||
                (m.group_name || '').toLowerCase().includes(query)
            );
        }

        return filtered;
    }, [meetings, filterStatus, isElevatedRole, assignedGroupIds, searchTerm]);

    // Get active meeting for a group
    const getActiveMeeting = (groupId) => {
        return meetings.find(m => m.group_id === groupId && m.status === 'ACTIVE');
    };

    // Save current meeting (Create or Update)
    const handleSaveMeeting = async () => {
        if (!newMeeting.group_id) {
            toast.error('Please select a group');
            return;
        }

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
                // Check if group already has an active meeting
                const activeMeeting = getActiveMeeting(parseInt(newMeeting.group_id));
                if (activeMeeting) {
                    toast.error(`Group already has an active meeting: ${activeMeeting.session_number}`);
                    return;
                }

                await api.createMeeting({
                    groupId: parseInt(newMeeting.group_id),
                    officerId: currentUser.id,
                    date: newMeeting.meeting_date,
                    startTime: new Date().toISOString(),
                    venue: newMeeting.venue,
                    agenda: newMeeting.agenda,
                    meeting_type: newMeeting.meeting_type,
                    expected_attendance: newMeeting.expected_attendance
                });

                // Send SMS Notification
                await NotificationService.sendSMS(
                    'ALL_MEMBERS',
                    `New Meeting Scheduled: ${groups.find(g => g.id === parseInt(newMeeting.group_id))?.name} on ${newMeeting.meeting_date} at ${newMeeting.venue || 'Usual Venue'}.`,
                    { date: newMeeting.meeting_date }
                );

                toast.success(`Meeting opened successfully!`);
            }

            loadMeetings();
            setShowOpenModal(false);
            resetForm();
        } catch (error) {
            console.error('Save meeting error:', error);
            toast.error(isEditing ? 'Failed to update meeting' : 'Failed to open meeting');
        }
    };

    const resetForm = () => {
        setNewMeeting({
            group_id: '',
            meeting_date: new Date().toISOString().split('T')[0],
            venue: '',
            agenda: '',
            meeting_type: 'Routine',
            expected_attendance: ''
        });
        setIsEditing(false);
        setEditId(null);
        setGroupSearchQuery('');
    };

    const handleEditMeeting = (meeting) => {
        setEditId(meeting.id);
        setIsEditing(true);
        setNewMeeting({
            group_id: meeting.groupId || meeting.group_id,
            meeting_date: meeting.date || meeting.meeting_date,
            venue: meeting.venue || '',
            agenda: meeting.agenda || '',
            meeting_type: meeting.meeting_type || 'Routine',
            expected_attendance: meeting.expected_attendance || ''
        });
        setGroupSearchQuery(meeting.group_name || '');
        setShowOpenModal(true);
    };

    const handleScheduleNext = (meeting) => {
        const nextDate = new Date(meeting.date || meeting.meeting_date);
        nextDate.setMonth(nextDate.getMonth() + 1);

        setIsEditing(false);
        setEditId(null);
        setNewMeeting({
            group_id: meeting.groupId || meeting.group_id,
            meeting_date: nextDate.toISOString().split('T')[0],
            venue: meeting.venue || '',
            agenda: meeting.agenda || '',
            meeting_type: meeting.meeting_type || 'Routine',
            expected_attendance: meeting.expected_attendance || ''
        });
        setGroupSearchQuery(meeting.group_name || '');
        setShowOpenModal(true);
    };

    // Close meeting
    const handleCloseMeeting = async () => {
        if (!closingNotes.trim()) {
            toast.error('Please add closing notes');
            return;
        }

        try {
            // Close meeting (would be API call)
            setMeetings(prev => prev.map(m =>
                m.id === selectedMeeting.id
                    ? {
                        ...m,
                        status: 'LOCKED',
                        end_time: new Date().toISOString(),
                        closed_by_name: currentUser.name,
                        closed_at: new Date().toISOString(),
                        closing_notes: closingNotes,
                        meeting_duration_hours: ((new Date() - new Date(m.start_time)) / 1000 / 3600).toFixed(2)
                    }
                    : m
            ));

            toast.success(`Meeting ${selectedMeeting.session_number} closed and locked!`);
            setShowCloseModal(false);
            setClosingNotes('');
            setSelectedMeeting(null);
        } catch (error) {
            console.error('Close meeting error:', error);
            toast.error('Failed to close meeting');
        }
    };

    // Get status color
    const getStatusColor = (status) => {
        switch (status) {
            case 'ACTIVE':
                return 'bg-green-100 text-green-700 border-green-200';
            case 'LOCKED':
                return 'bg-gray-100 text-gray-700 border-gray-200';
            case 'SCHEDULED':
                return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'CANCELLED':
                return 'bg-red-100 text-red-700 border-red-200';
            default:
                return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    // Statistics
    const stats = {
        totalMeetings: meetings.length,
        activeMeetings: meetings.filter(m => m.status === 'ACTIVE').length,
        lockedMeetings: meetings.filter(m => m.status === 'LOCKED').length,
        totalCollected: meetings.filter(m => m.status === 'LOCKED').reduce((sum, m) => sum + m.total_collected, 0)
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Meeting Sessions Control</h2>
                    <p className="text-sm text-gray-500 mt-1">Meeting-based posting & transaction locking</p>
                </div>
                <button
                    onClick={() => setShowOpenModal(true)}
                    className="flex items-center px-6 py-3 bg-safaricom-green text-white rounded-lg hover:bg-safaricom-dark transition-colors shadow-sm font-bold"
                >
                    <FaPlus className="mr-2" /> Open New Meeting
                </button>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-xs text-gray-500 uppercase font-bold">Total Meetings</p>
                    <p className="text-2xl font-black text-gray-800 mt-1">{stats.totalMeetings}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-xl shadow-sm border border-green-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-green-700 uppercase font-bold">Active Now</p>
                            <p className="text-2xl font-black text-green-800 mt-1">{stats.activeMeetings}</p>
                        </div>
                        <FaUnlock className="text-3xl text-green-400" />
                    </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-700 uppercase font-bold">Locked</p>
                            <p className="text-2xl font-black text-gray-800 mt-1">{stats.lockedMeetings}</p>
                        </div>
                        <FaLock className="text-3xl text-gray-400" />
                    </div>
                </div>
                <div className="bg-blue-50 p-4 rounded-xl shadow-sm border border-blue-100">
                    <p className="text-xs text-blue-700 uppercase font-bold">Total Collected</p>
                    <p className="text-lg font-black text-blue-800 mt-1">KES {(stats.totalCollected || 0).toLocaleString()}</p>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex flex-wrap gap-2">
                        {['ALL', 'ACTIVE', 'SCHEDULED', 'LOCKED', 'CANCELLED'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${filterStatus === status
                                    ? 'bg-safaricom-green text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>

                    {/* NEW SEARCH BAR PILL */}
                    <div className="relative w-full md:w-64">
                        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search session or group..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-full focus:ring-4 focus:ring-safaricom-green/10 focus:border-safaricom-green font-bold text-sm transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Meetings Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Session #</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Group</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Collected</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Attendance</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Duration</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredMeetings.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="px-6 py-10 text-center text-gray-500">
                                        No meetings found.
                                    </td>
                                </tr>
                            ) : (
                                filteredMeetings.map(meeting => (
                                    <tr key={meeting.id} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="px-6 py-4 font-mono font-bold text-gray-900">{meeting.session_number}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <FaUsers className="text-gray-400" />
                                                <span className="font-medium text-gray-900">{meeting.group_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {new Date(meeting.meeting_date).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border flex items-center gap-1 w-fit ${getStatusColor(meeting.status)}`}>
                                                {meeting.status === 'ACTIVE' ? <FaUnlock /> : <FaLock />}
                                                {meeting.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-bold text-gray-900">
                                            KES {(meeting.total_collected || 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="font-bold text-gray-900">
                                                    {meeting.members_present}/{meeting.members_present + meeting.members_absent}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    {(meeting.attendance_percentage || 0).toFixed(0)}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {meeting.status === 'ACTIVE' ? (
                                                <span className="text-green-600 font-bold flex items-center gap-1">
                                                    <FaClock />
                                                    {(meeting.hours_open || 0).toFixed(1)}h
                                                </span>
                                            ) : (
                                                <span className="text-gray-600">
                                                    {meeting.meeting_duration_hours}h
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() => api.downloadMeetingMinutes(meeting.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Download Minutes (PDF)"
                                                >
                                                    <FaFilePdf size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleScheduleNext(meeting)}
                                                    className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                                    title="Schedule Next (Clone)"
                                                >
                                                    <FaCalendarAlt size={18} />
                                                </button>
                                                {meeting.status !== 'LOCKED' && (
                                                    <button
                                                        onClick={() => handleEditMeeting(meeting)}
                                                        className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                                        title="Reschedule / Edit"
                                                    >
                                                        <FaEdit size={18} />
                                                    </button>
                                                )}
                                                <button
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <FaFileAlt size={18} />
                                                </button>
                                                {meeting.status === 'ACTIVE' && (
                                                    <>
                                                        <button
                                                            onClick={() => openCockpit(meeting)}
                                                            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-lg text-xs font-black shadow-lg hover:from-blue-700 hover:to-indigo-800 transition-all flex items-center gap-2"
                                                            title="Enter Meeting Cockpit"
                                                        >
                                                            <FaPlay /> ENTER COCKPIT
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedMeeting(meeting);
                                                                setShowLedger(true);
                                                            }}
                                                            className="px-3 py-1 bg-green-50 text-safaricom-green rounded-lg text-xs font-black border border-green-100 hover:bg-green-100 transition-all flex items-center gap-1"
                                                            title="Analyze Session Cash"
                                                        >
                                                            <FaMoneyBillWave /> Ledger
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedMeeting(meeting);
                                                                setShowCloseModal(true);
                                                            }}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Emergency Lock"
                                                        >
                                                            <FaLock />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Meeting Ledger Modal */}
            {showLedger && selectedMeeting && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
                    <MeetingLedger
                        sessionId={selectedMeeting.id}
                        onClose={() => {
                            setShowLedger(false);
                            // Refresh meetings list after closing
                            setTimeout(() => window.location.reload(), 1500);
                        }}
                    />
                    <button
                        onClick={() => setShowLedger(false)}
                        className="absolute top-8 right-8 text-white/50 hover:text-white text-4xl font-light"
                    >
                        &times;
                    </button>
                </div>
            )}

            {/* Warning Banner for Active Meetings */}
            {stats.activeMeetings > 0 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r-lg">
                    <div className="flex items-start gap-3">
                        <FaClock className="text-yellow-600 mt-0.5 flex-shrink-0 text-xl" />
                        <div className="text-sm">
                            <p className="font-bold text-yellow-900 mb-1">⚠️ {stats.activeMeetings} Active Meeting(s)</p>
                            <p className="text-yellow-700">
                                Transactions can only be posted during active meetings. Remember to close and lock meetings when done.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Premium Meeting Scheduler Modal */}
            {showOpenModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full overflow-hidden border border-white/20 animate-in zoom-in duration-300">
                        {/* Modal Header */}
                        <div className={`p-8 text-white flex justify-between items-center ${isEditing ? 'bg-gradient-to-r from-orange-500 to-red-600' : 'bg-gradient-to-r from-safaricom-green to-emerald-700'}`}>
                            <div>
                                <h3 className="text-3xl font-black flex items-center gap-3">
                                    {isEditing ? <FaEdit /> : <FaCalendarAlt />}
                                    {isEditing ? 'Reschedule Meeting' : 'Schedule Next Meeting'}
                                </h3>
                                <p className="text-white/80 font-bold text-sm uppercase tracking-widest mt-1">
                                    {isEditing ? 'Modifying existing session parameters' : 'Plan and notify members for the upcoming session'}
                                </p>
                            </div>
                            <button
                                onClick={() => { setShowOpenModal(false); resetForm(); }}
                                className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-2xl transition-all"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="p-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Column 1: Core Logistics */}
                                <div className="space-y-6">
                                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <FaUsers className="text-safaricom-green" /> Group Selection
                                        </h4>
                                        <div className="relative">
                                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Search Group..."
                                                className="w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-safaricom-green/10 focus:border-safaricom-green font-bold text-gray-700"
                                                value={groupSearchQuery}
                                                onChange={(e) => {
                                                    setGroupSearchQuery(e.target.value);
                                                    if (!isEditing) setNewMeeting(prev => ({ ...prev, group_id: '' }));
                                                }}
                                                disabled={isEditing}
                                            />
                                            {!isEditing && groupSearchQuery && !newMeeting.group_id && (
                                                <div className="absolute z-10 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-40 overflow-y-auto">
                                                    {matrixFilteredGroups
                                                        .filter(g => (g.group_name || g.name || '').toLowerCase().includes(groupSearchQuery.toLowerCase()))
                                                        .map(group => (
                                                            <button
                                                                key={group.id}
                                                                onClick={() => {
                                                                    setNewMeeting({ ...newMeeting, group_id: group.id.toString() });
                                                                    setGroupSearchQuery(group.group_name || group.name);
                                                                }}
                                                                className="w-full text-left px-4 py-3 text-sm hover:bg-green-50 font-bold text-gray-700 border-b border-gray-50 last:border-0"
                                                            >
                                                                {group.group_name || group.name}
                                                            </button>
                                                        ))}
                                                    {matrixFilteredGroups.filter(g => (g.group_name || g.name || '').toLowerCase().includes(groupSearchQuery.toLowerCase())).length === 0 && (
                                                        <div className="px-4 py-6 text-center text-gray-400 text-sm">
                                                            <p className="font-bold">No assigned groups found</p>
                                                            <p className="text-xs mt-1">Contact admin to assign groups</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-6">
                                        <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                                            <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <FaClock /> Date & Time
                                            </h4>
                                            <input
                                                type="date"
                                                value={newMeeting.meeting_date}
                                                onChange={(e) => setNewMeeting({ ...newMeeting, meeting_date: e.target.value })}
                                                className="w-full px-4 py-2.5 bg-white border border-blue-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-gray-700"
                                            />
                                        </div>
                                        <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100">
                                            <h4 className="text-xs font-black text-purple-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <FaMapMarkerAlt /> Meeting Venue
                                            </h4>
                                            <input
                                                type="text"
                                                value={newMeeting.venue}
                                                onChange={(e) => setNewMeeting({ ...newMeeting, venue: e.target.value })}
                                                placeholder="e.g., Kajiado Community Hall"
                                                className="w-full px-4 py-2.5 bg-white border border-purple-200 rounded-xl focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 font-bold text-gray-700"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Column 2: Agenda & Information */}
                                <div className="space-y-6">
                                    <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                                        <h4 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <FaListUl /> Strategic Agenda
                                        </h4>
                                        <textarea
                                            value={newMeeting.agenda}
                                            onChange={(e) => setNewMeeting({ ...newMeeting, agenda: e.target.value })}
                                            placeholder="1. Welfare Contributions&#10;2. Loan Appraisals&#10;3. Market Updates..."
                                            className="w-full px-4 py-3 bg-white border border-emerald-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-bold text-gray-700 min-h-[120px]"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Type</label>
                                            <select
                                                className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700"
                                                value={newMeeting.meeting_type}
                                                onChange={(e) => setNewMeeting({ ...newMeeting, meeting_type: e.target.value })}
                                            >
                                                <option>Routine</option>
                                                <option>Annual AGM</option>
                                                <option>Emergency</option>
                                                <option>Special</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Target Pop.</label>
                                            <input
                                                type="number"
                                                placeholder="Members"
                                                className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700"
                                                value={newMeeting.expected_attendance}
                                                onChange={(e) => setNewMeeting({ ...newMeeting, expected_attendance: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="flex gap-4 mt-10">
                                <button
                                    onClick={() => { setShowOpenModal(false); resetForm(); }}
                                    className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black hover:bg-gray-200 transition-all uppercase tracking-widest text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveMeeting}
                                    className={`flex-[2] py-4 rounded-2xl font-black text-white shadow-xl transition-all uppercase tracking-widest text-xs active:scale-95 flex items-center justify-center gap-2 ${isEditing ? 'bg-orange-600 hover:bg-orange-700' : 'bg-safaricom-green hover:bg-safaricom-dark'
                                        }`}
                                >
                                    {isEditing ? <><FaClock /> Update & Notify</> : <><FaCheckCircle /> Schedule & Notify</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Close Meeting Modal */}
            {showCloseModal && selectedMeeting && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
                        <div className="p-6">
                            <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <FaLock className="text-red-600" />
                                Close & Lock Meeting
                            </h3>

                            <div className="space-y-4">
                                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded-r-lg">
                                    <p className="text-sm font-bold text-yellow-900 mb-1">⚠️ Warning</p>
                                    <p className="text-xs text-yellow-700">
                                        Closing this meeting will permanently lock all transactions.
                                        No further edits will be possible.
                                    </p>
                                </div>

                                <div>
                                    <p className="text-sm text-gray-600 mb-2">
                                        <span className="font-bold">Session:</span> {selectedMeeting.session_number}
                                    </p>
                                    <p className="text-sm text-gray-600 mb-2">
                                        <span className="font-bold">Total Collected:</span> KES {(selectedMeeting.total_collected || 0).toLocaleString()}
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Closing Notes <span className="text-red-600">*</span>
                                    </label>
                                    <textarea
                                        value={closingNotes}
                                        onChange={(e) => setClosingNotes(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green"
                                        rows="4"
                                        placeholder="e.g., All transactions verified. Meeting closed at 4:30 PM."
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        setShowCloseModal(false);
                                        setClosingNotes('');
                                        setSelectedMeeting(null);
                                    }}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCloseMeeting}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-bold"
                                >
                                    Close & Lock
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MEETING COCKPIT - Full Screen Member Checklist */}
            {showCockpit && cockpitSession && (
                <div className="fixed inset-0 z-[70] bg-white flex flex-col">
                    {/* Cockpit Header */}
                    <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 text-white p-6 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <button
                                    onClick={closeCockpit}
                                    className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                                >
                                    <FaArrowLeft className="text-xl" />
                                </button>
                                <div>
                                    <h1 className="text-3xl font-black flex items-center gap-3">
                                        <FaUsers className="text-yellow-400" />
                                        {cockpitSession.group_name}
                                    </h1>
                                    <p className="text-blue-200 text-sm font-bold mt-1">
                                        Session #{cockpitSession.session_number} • {new Date(cockpitSession.meeting_date).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="bg-green-500/20 px-6 py-3 rounded-2xl border border-green-400/30">
                                    <p className="text-[10px] font-black text-green-300 uppercase">Session Total</p>
                                    <p className="text-2xl font-black text-green-400">KES {sessionTotals.total.toLocaleString()}</p>
                                </div>
                                <div className="bg-white/10 px-6 py-3 rounded-2xl">
                                    <p className="text-[10px] font-black text-white/60 uppercase">Members</p>
                                    <p className="text-2xl font-black">
                                        {Object.values(memberAttendance).filter(Boolean).length}/{sessionMembers.length}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Category Totals Bar */}
                    <div className="bg-slate-800 px-6 py-3 flex items-center gap-6 shrink-0 overflow-x-auto">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                            <FaCoins className="text-blue-400" /> Savings: <span className="text-blue-400">KES {sessionTotals.savings.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                            <FaShieldAlt className="text-teal-400" /> Welfare: <span className="text-teal-400">KES {sessionTotals.welfare.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                            <FaHandHoldingDollar className="text-orange-400" /> STL Repay: <span className="text-orange-400">KES {sessionTotals.stl.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                            <FaHandHoldingDollar className="text-amber-400" /> LTL Repay: <span className="text-amber-400">KES {sessionTotals.ltl.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                            <FaExclamationTriangle className="text-red-400" /> Penalties: <span className="text-red-400">KES {sessionTotals.penalty.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                            <FaBox className="text-purple-400" /> Product: <span className="text-purple-400">KES {sessionTotals.product.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Member Search */}
                    <div className="bg-slate-100 px-6 py-4 shrink-0 border-b border-slate-200">
                        <div className="relative max-w-md">
                            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={memberSearchTerm}
                                onChange={(e) => setMemberSearchTerm(e.target.value)}
                                placeholder="Search member by name or phone..."
                                className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-slate-200 bg-white font-bold text-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                            />
                        </div>
                    </div>

                    {/* Member Checklist Table */}
                    <div className="flex-1 overflow-y-auto">
                        {cockpitLoading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                    <p className="font-bold text-slate-500">Loading members...</p>
                                </div>
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead className="bg-slate-50 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase w-16">✓</th>
                                        <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase">Member</th>
                                        <th className="px-6 py-4 text-center text-xs font-black text-blue-600 uppercase">Savings</th>
                                        <th className="px-6 py-4 text-center text-xs font-black text-teal-600 uppercase">Welfare</th>
                                        <th className="px-6 py-4 text-center text-xs font-black text-orange-600 uppercase">STL</th>
                                        <th className="px-6 py-4 text-center text-xs font-black text-amber-600 uppercase">LTL</th>
                                        <th className="px-6 py-4 text-center text-xs font-black text-red-600 uppercase">Penalty</th>
                                        <th className="px-6 py-4 text-center text-xs font-black text-purple-600 uppercase">Product</th>
                                        <th className="px-6 py-4 text-center text-xs font-black text-slate-500 uppercase">Status</th>
                                        <th className="px-6 py-4 text-center text-xs font-black text-slate-500 uppercase">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredSessionMembers.map(member => {
                                        const tx = memberTransactions[member.id] || {};
                                        const hasAnyTx = (tx.savings || 0) + (tx.welfare || 0) + (tx.stl_repay || 0) + (tx.ltl_repay || 0) + (tx.penalty || 0) + (tx.product_repay || 0) > 0;
                                        const isPresent = memberAttendance[member.id];

                                        return (
                                            <tr
                                                key={member.id}
                                                className={`hover:bg-blue-50/50 transition-colors ${!isPresent ? 'bg-red-50/30 opacity-60' : ''}`}
                                            >
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={() => toggleAttendance(member.id)}
                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isPresent
                                                            ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                                            : 'bg-red-100 text-red-600 hover:bg-red-200'
                                                            }`}
                                                    >
                                                        {isPresent ? <FaUserCheck /> : <FaUserTimes />}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black">
                                                            {member.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-slate-900">{member.name}</p>
                                                            <p className="text-xs text-slate-400 font-mono">{member.phone}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`font-mono font-bold ${tx.savings ? 'text-blue-600' : 'text-slate-300'}`}>
                                                        {tx.savings ? `KES ${tx.savings.toLocaleString()}` : '—'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`font-mono font-bold ${tx.welfare ? 'text-teal-600' : 'text-slate-300'}`}>
                                                        {tx.welfare ? `KES ${tx.welfare.toLocaleString()}` : '—'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`font-mono font-bold ${tx.stl_repay ? 'text-orange-600' : 'text-slate-300'}`}>
                                                        {tx.stl_repay ? `KES ${tx.stl_repay.toLocaleString()}` : '—'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`font-mono font-bold ${tx.ltl_repay ? 'text-amber-600' : 'text-slate-300'}`}>
                                                        {tx.ltl_repay ? `KES ${tx.ltl_repay.toLocaleString()}` : '—'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`font-mono font-bold ${tx.penalty ? 'text-red-600' : 'text-slate-300'}`}>
                                                        {tx.penalty ? `KES ${tx.penalty.toLocaleString()}` : '—'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`font-mono font-bold ${tx.product_repay ? 'text-purple-600' : 'text-slate-300'}`}>
                                                        {tx.product_repay ? `KES ${tx.product_repay.toLocaleString()}` : '—'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {!isPresent ? (
                                                        <span className="px-3 py-1 rounded-full text-[10px] font-black bg-red-100 text-red-600 border border-red-200">
                                                            ABSENT
                                                        </span>
                                                    ) : hasAnyTx ? (
                                                        <span className="px-3 py-1 rounded-full text-[10px] font-black bg-green-100 text-green-600 border border-green-200">
                                                            ✓ DONE
                                                        </span>
                                                    ) : (
                                                        <span className="px-3 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-600 border border-amber-200">
                                                            PENDING
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <button
                                                        onClick={() => handleMemberClick(member)}
                                                        disabled={!isPresent}
                                                        className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${isPresent
                                                            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl'
                                                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                            }`}
                                                    >
                                                        + ADD
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* GROUP ACTIONS PANEL */}
                    <div className="bg-gradient-to-r from-indigo-900 to-purple-900 px-6 py-4 shrink-0">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-white font-black text-sm flex items-center gap-2">
                                    <FaUsers className="text-yellow-400" /> GROUP ACTIONS
                                </h3>
                                <p className="text-indigo-300 text-xs font-bold">Group-level loan repayments to Ukombozini</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => {
                                        setGroupLoanType('STL');
                                        setShowGroupLoanModal(true);
                                    }}
                                    className="px-6 py-3 bg-orange-500 text-white rounded-xl font-black text-sm hover:bg-orange-600 transition-all flex items-center gap-2 shadow-lg"
                                >
                                    <FaHandHoldingDollar /> Repay Ukombozini STL
                                </button>
                                <button
                                    onClick={() => {
                                        setGroupLoanType('LTL');
                                        setShowGroupLoanModal(true);
                                    }}
                                    className="px-6 py-3 bg-amber-500 text-white rounded-xl font-black text-sm hover:bg-amber-600 transition-all flex items-center gap-2 shadow-lg"
                                >
                                    <FaHandHoldingDollar /> Repay Ukombozini LTL
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Cockpit Footer Actions */}
                    <div className="bg-slate-800 p-4 flex items-center justify-between shrink-0">
                        <div className="text-slate-400 text-sm font-bold">
                            <span className="text-green-400">{Object.values(memberAttendance).filter(Boolean).length}</span> Present •
                            <span className="text-red-400 ml-1">{Object.values(memberAttendance).filter(v => !v).length}</span> Absent •
                            <span className="text-blue-400 ml-1">{Object.keys(memberTransactions).length}</span> Contributed
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => {
                                    setSelectedMeeting(cockpitSession);
                                    setShowLedger(true);
                                }}
                                className="px-6 py-3 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-all flex items-center gap-2"
                            >
                                <FaMoneyBillWave /> View Ledger
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedMeeting(cockpitSession);
                                    setShowCloseModal(true);
                                }}
                                className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all flex items-center gap-2"
                            >
                                <FaLock /> Close Session
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Smart Transaction Panel for Cockpit */}
            {showTransactionPanel && selectedMember && (
                <SmartTransactionPanel
                    member={selectedMember}
                    isOpen={showTransactionPanel}
                    onClose={() => {
                        setShowTransactionPanel(false);
                        setSelectedMember(null);
                    }}
                    onRefresh={() => {
                        // Reload cockpit data after transaction
                        if (cockpitSession) {
                            openCockpit(cockpitSession);
                        }
                    }}
                />
            )}

            {/* Group Loan Repayment Modal */}
            {showGroupLoanModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-6">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className={`p-6 ${groupLoanType === 'STL' ? 'bg-gradient-to-r from-orange-500 to-orange-600' : 'bg-gradient-to-r from-amber-500 to-amber-600'}`}>
                            <h3 className="text-xl font-black text-white flex items-center gap-2">
                                <FaHandHoldingDollar /> Repay Ukombozini {groupLoanType}
                            </h3>
                            <p className="text-white/80 text-sm font-bold mt-1">
                                Group: {cockpitSession?.group_name} • Session #{cockpitSession?.session_number}
                            </p>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Repayment Amount (KES)
                                </label>
                                <input
                                    type="number"
                                    value={groupLoanAmount}
                                    onChange={(e) => setGroupLoanAmount(e.target.value)}
                                    placeholder="Enter amount"
                                    className="w-full mt-2 p-4 text-xl font-black text-center border-2 border-slate-200 rounded-xl focus:border-orange-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Notes (Optional)
                                </label>
                                <textarea
                                    value={groupLoanNotes}
                                    onChange={(e) => setGroupLoanNotes(e.target.value)}
                                    placeholder="e.g., Monthly installment #3"
                                    rows={2}
                                    className="w-full mt-2 p-3 border-2 border-slate-200 rounded-xl focus:border-orange-500 focus:outline-none font-bold text-slate-600"
                                />
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <p className="text-xs text-slate-500 font-bold">
                                    This will record a {groupLoanType === 'STL' ? 'Short-Term' : 'Long-Term'} loan repayment
                                    from the group's collected cash to Ukombozini central.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 p-6 bg-slate-50 border-t border-slate-200">
                            <button
                                onClick={() => {
                                    setShowGroupLoanModal(false);
                                    setGroupLoanAmount('');
                                    setGroupLoanNotes('');
                                    setGroupLoanType(null);
                                }}
                                disabled={processingGroupLoan}
                                className="flex-1 py-3 px-6 bg-slate-200 text-slate-700 rounded-xl font-black hover:bg-slate-300 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleGroupLoanRepayment}
                                disabled={processingGroupLoan || !groupLoanAmount}
                                className={`flex-1 py-3 px-6 text-white rounded-xl font-black transition-all flex items-center justify-center gap-2 ${groupLoanType === 'STL' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-amber-500 hover:bg-amber-600'} disabled:opacity-50`}
                            >
                                {processingGroupLoan ? 'Processing...' : `Confirm ${groupLoanType} Repayment`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MeetingSessions;
