import React, { useState, useEffect } from 'react';
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
    FaSearch
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useTransactions } from '../context/TransactionContext';
import MeetingLedger from '../components/MeetingLedger';
import NotificationService from '../services/NotificationService';

import { api } from '../services/api';

const MeetingSessions = () => {
    const [meetings, setMeetings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [showOpenModal, setShowOpenModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState(null);
    const [closingNotes, setClosingNotes] = useState('');
    const [showLedger, setShowLedger] = useState(false);

    // New meeting form
    const [newMeeting, setNewMeeting] = useState({
        group_id: '',
        meeting_date: new Date().toISOString().split('T')[0],
        venue: ''
    });

    // Search state for new meeting modal
    const [groupSearchQuery, setGroupSearchQuery] = useState('');

    const { groups } = useTransactions();

    // Mock current user (Replace with Auth context in future)
    const currentUser = {
        id: 1,
        name: 'John Kamau',
        role: 'Officer'
    };

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

    // Filter meetings
    const filteredMeetings = meetings.filter(meeting => {
        if (filterStatus === 'ALL') return true;
        return meeting.status === filterStatus;
    });

    // Get active meeting for a group
    const getActiveMeeting = (groupId) => {
        return meetings.find(m => m.group_id === groupId && m.status === 'ACTIVE');
    };

    // Open new meeting
    const handleOpenMeeting = async () => {
        if (!newMeeting.group_id) {
            toast.error('Please select a group');
            return;
        }

        // Check if group already has an active meeting
        const activeMeeting = getActiveMeeting(parseInt(newMeeting.group_id));
        if (activeMeeting) {
            toast.error(`Group already has an active meeting: ${activeMeeting.session_number}`);
            return;
        }

        try {
            // Create new meeting (would be API call)
            const newMeetingSession = {
                id: meetings.length + 1,
                session_number: `MTG-202501-GRP-${String(meetings.length + 1).padStart(3, '0')}`,
                group_id: parseInt(newMeeting.group_id),
                group_name: groups.find(g => g.id === parseInt(newMeeting.group_id))?.name,
                meeting_date: newMeeting.meeting_date,
                start_time: new Date().toISOString(),
                end_time: null,
                status: 'ACTIVE',
                venue: newMeeting.venue,
                total_collected: 0,
                total_loans_disbursed: 0,
                members_present: 0,
                members_absent: 0,
                attendance_percentage: 0,
                opened_by_name: currentUser.name,
                opened_at: new Date().toISOString(),
                hours_open: 0
            };

            setMeetings([newMeetingSession, ...meetings]);
            setShowOpenModal(false);
            setNewMeeting({
                group_id: '',
                meeting_date: new Date().toISOString().split('T')[0],
                venue: ''
            });

            // Send SMS Notification
            await NotificationService.sendSMS(
                'ALL_MEMBERS',
                `Meeting Started: ${newMeetingSession.group_name} at ${newMeetingSession.venue || 'Usual Venue'}. Attendance marked.`,
                { meetingId: newMeetingSession.id }
            );

            toast.success(`Meeting ${newMeetingSession.session_number} opened successfully!`);
        } catch (error) {
            console.error('Open meeting error:', error);
            toast.error('Failed to open meeting');
        }
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
                    <p className="text-lg font-black text-blue-800 mt-1">KES {stats.totalCollected.toLocaleString()}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex flex-wrap gap-2">
                    {['ALL', 'ACTIVE', 'LOCKED', 'CANCELLED'].map(status => (
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
                                            KES {meeting.total_collected.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="font-bold text-gray-900">
                                                    {meeting.members_present}/{meeting.members_present + meeting.members_absent}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    {meeting.attendance_percentage.toFixed(0)}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {meeting.status === 'ACTIVE' ? (
                                                <span className="text-green-600 font-bold flex items-center gap-1">
                                                    <FaClock />
                                                    {meeting.hours_open.toFixed(1)}h
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
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <FaFileAlt size={18} />
                                                </button>
                                                {meeting.status === 'ACTIVE' && (
                                                    <>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedMeeting(meeting);
                                                                setShowLedger(true);
                                                            }}
                                                            className="px-3 py-1 bg-green-50 text-safaricom-green rounded-lg text-xs font-black border border-green-100 hover:bg-green-100 transition-all flex items-center gap-1"
                                                            title="Analyze Session Cash"
                                                        >
                                                            <FaMoneyBillWave /> Manage Cash
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

            {/* Open Meeting Modal */}
            {showOpenModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
                        <div className="p-6">
                            <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <FaUnlock className="text-green-600" />
                                Open New Meeting
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Group <span className="text-red-600">*</span>
                                    </label>
                                    {/* SEARCHABLE GROUP SELECT */}
                                    <div className="relative">
                                        <div className="relative">
                                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Search & Select Group..."
                                                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green font-bold text-gray-700"
                                                value={groupSearchQuery}
                                                onChange={(e) => {
                                                    setGroupSearchQuery(e.target.value);
                                                    setNewMeeting(prev => ({ ...prev, group_id: '' })); // Reset selection on search
                                                }}
                                            />
                                        </div>

                                        {/* Filtered List */}
                                        <div className="mt-2 max-h-48 overflow-y-auto border border-gray-100 rounded-lg shadow-inner bg-gray-50/50">
                                            {groups
                                                .filter(g => (g.group_name || g.name || '').toLowerCase().includes(groupSearchQuery.toLowerCase()))
                                                .map(group => {
                                                    const groupName = group.group_name || group.name || 'Unknown Group';
                                                    const isActive = getActiveMeeting(group.id);
                                                    return (
                                                        <button
                                                            key={group.id}
                                                            onClick={() => {
                                                                if (!isActive) {
                                                                    setNewMeeting({ ...newMeeting, group_id: group.id.toString() });
                                                                    setGroupSearchQuery(groupName); // Set input to name
                                                                }
                                                            }}
                                                            disabled={!!isActive}
                                                            className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-white transition-colors border-b border-gray-100 last:border-0 ${String(newMeeting.group_id) === String(group.id) ? 'bg-green-50 text-safaricom-green ring-1 ring-safaricom-green' : 'text-gray-700'
                                                                } ${isActive ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}`}
                                                        >
                                                            <span className="font-bold flex items-center gap-2">
                                                                {groupName}
                                                                {String(newMeeting.group_id) === String(group.id) && <FaCheckCircle />}
                                                            </span>
                                                            {isActive ? (
                                                                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                                                                    ACTIVE
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-gray-400">Select</span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            {groups.filter(g => (g.group_name || g.name || '').toLowerCase().includes(groupSearchQuery.toLowerCase())).length === 0 && (
                                                <div className="px-3 py-4 text-center text-xs text-gray-400">
                                                    No groups found
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Meeting Date <span className="text-red-600">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={newMeeting.meeting_date}
                                        onChange={(e) => setNewMeeting({ ...newMeeting, meeting_date: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Venue</label>
                                    <input
                                        type="text"
                                        value={newMeeting.venue}
                                        onChange={(e) => setNewMeeting({ ...newMeeting, venue: e.target.value })}
                                        placeholder="e.g., Community Hall"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green"
                                    />
                                </div>

                                <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r-lg">
                                    <p className="text-xs text-blue-700">
                                        <span className="font-bold">ℹ️ Note:</span> Once opened, this meeting will allow transactions.
                                        Close and lock the meeting when done to prevent further changes.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowOpenModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleOpenMeeting}
                                    className="flex-1 px-4 py-2 bg-safaricom-green text-white rounded-lg hover:bg-safaricom-dark transition-colors font-bold"
                                >
                                    Open Meeting
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
                                        <span className="font-bold">Total Collected:</span> KES {selectedMeeting.total_collected.toLocaleString()}
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
        </div>
    );
};

export default MeetingSessions;
