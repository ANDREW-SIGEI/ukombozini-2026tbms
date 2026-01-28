import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaUsers, FaPlus, FaMagnifyingGlass, FaPenToSquare, FaTrash,
    FaSpinner, FaCalendarDays, FaLocationDot, FaCircleCheck, FaBook
} from 'react-icons/fa6';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const GroupsManagement = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [groupMembers, setGroupMembers] = useState([]);
    const [isUpdating, setIsUpdating] = useState(false);

    const [newGroup, setNewGroup] = useState({
        group_name: '',
        meeting_day: 'Monday',
        meeting_frequency: 'WEEKLY',
        location: '',
        chairperson: '',
        chairperson_phone: '',
        secretary: '',
        secretary_phone: '',
        treasurer: '',
        treasurer_phone: '',
        minMonthlySaving: 500,
        loanMultiplier: 3,
        dividendPolicy: 0.75,
        financial_year: new Date().getFullYear()
    });

    const [editGroup, setEditGroup] = useState({
        id: '',
        group_name: '',
        meeting_day: '',
        meeting_frequency: '',
        location: '',
        chairperson: '',
        secretary: '',
        treasurer: '',
        chairperson_id: '',
        secretary_id: '',
        treasurer_id: '',
        minMonthlySaving: 0,
        loanMultiplier: 0,
        dividendPolicy: 0,
        financial_year: 0,
        status: ''
    });

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        setLoading(true);
        try {
            const data = await api.getGroups();
            if (data) {
                setGroups(data);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load groups");
        } finally {
            setLoading(false);
        }
    };

    const handleAddGroup = async (e) => {
        e.preventDefault();

        if (!newGroup.group_name) {
            toast.error('Please provide a group name');
            return;
        }

        try {
            await api.createGroup({
                ...newGroup,
                registration_date: new Date().toISOString().split('T')[0]
            });

            toast.success(`✅ ${newGroup.group_name} registered successfully!`);
            setShowAddModal(false);
            setNewGroup({
                group_name: '',
                meeting_day: 'Monday',
                meeting_frequency: 'WEEKLY',
                location: '',
                chairperson: '',
                chairperson_phone: '',
                secretary: '',
                secretary_phone: '',
                treasurer: '',
                treasurer_phone: '',
                minMonthlySaving: 500,
                loanMultiplier: 3,
                dividendPolicy: 0.75,
                financial_year: new Date().getFullYear()
            });
            fetchGroups();
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to create group");
        }
    };

    const openEditModal = async (group, focusGovernance = false) => {
        setSelectedGroup(group);
        setEditGroup({
            id: group.id,
            group_name: group.group_name || '',
            meeting_day: group.meeting_day || 'Monday',
            meeting_frequency: group.meeting_frequency || 'WEEKLY',
            location: group.location || '',
            chairperson: group.chairperson || '',
            secretary: group.secretary || '',
            treasurer: group.treasurer || '',
            chairperson_id: group.chairperson_id || '',
            secretary_id: group.secretary_id || '',
            treasurer_id: group.treasurer_id || '',
            minMonthlySaving: group.minMonthlySaving || 500,
            loanMultiplier: group.loanMultiplier || 3,
            dividendPolicy: group.dividendPolicy || 0.75,
            financial_year: group.financial_year || new Date().getFullYear(),
            status: group.status || 'active'
        });
        setShowEditModal(true);

        // Fetch members for this group to populate leader dropdowns
        try {
            const members = await api.getMembersByGroup(group.id);
            setGroupMembers(members);
        } catch (error) {
            console.error("Error fetching group members:", error);
        }
    };

    const handleUpdateGroup = async (e) => {
        e.preventDefault();
        setIsUpdating(true);
        try {
            await api.updateGroup(editGroup.id, editGroup);
            toast.success("✅ Group settings updated!");
            setShowEditModal(false);
            fetchGroups();
        } catch (error) {
            console.error(error);
            toast.error("Failed to update group.");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDeleteGroup = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) return;

        try {
            await api.deleteGroup(id);
            toast.success("Group deleted successfully");
            fetchGroups();
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to delete group");
        }
    };

    const filteredGroups = groups.filter(group =>
        group.group_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getMeetingDayBadge = (day) => {
        const colors = {
            'Monday': 'bg-blue-100 text-blue-800',
            'Tuesday': 'bg-green-100 text-green-800',
            'Wednesday': 'bg-yellow-100 text-yellow-800',
            'Thursday': 'bg-purple-100 text-purple-800',
            'Friday': 'bg-red-100 text-red-800',
            'Saturday': 'bg-indigo-100 text-indigo-800',
            'Sunday': 'bg-pink-100 text-pink-800'
        };
        return colors[day] || 'bg-gray-100 text-gray-800';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                        <FaUsers className="text-safaricom-green" /> Groups Management
                    </h2>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                        {filteredGroups.length} Active Groups
                    </p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 bg-safaricom-green text-white px-5 py-2 rounded-xl font-bold hover:bg-green-700 transition-colors shadow-md"
                >
                    <FaPlus /> Register New Group
                </button>
            </div>

            {/* Search */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="relative">
                    <FaMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search groups by name..."
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-safaricom-green/50 font-bold text-gray-600"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Groups Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-20 flex flex-col items-center text-gray-400">
                        <FaSpinner className="animate-spin text-4xl mb-4 text-safaricom-green" />
                        <p className="font-bold tracking-widest uppercase text-xs">Loading Directory...</p>
                    </div>
                ) : filteredGroups.length === 0 ? (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
                        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                            <FaUsers className="text-4xl text-gray-300" />
                        </div>
                        <h3 className="text-xl font-black text-gray-800 mb-2">No Groups Found</h3>
                        <p className="text-gray-500 max-w-md mx-auto mb-8">Get started by registering a new table banking group to managing savings and loans.</p>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="bg-safaricom-green text-white px-8 py-3 rounded-xl font-bold hover:bg-green-700 transition-colors shadow-lg"
                        >
                            Register First Group
                        </button>
                    </div>
                ) : (
                    filteredGroups.map((group) => {
                        const hasOfficials = group.chairperson || group.secretary || group.treasurer;
                        const initials = group.group_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

                        return (
                            <div
                                key={group.id}
                                className="group relative bg-white rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-safaricom-green/30 transition-all duration-300 overflow-hidden"
                            >
                                {user?.role === 'admin' && (
                                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                        <button
                                            onClick={() => handleDeleteGroup(group.id, group.group_name)}
                                            className="bg-white/90 p-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm"
                                            title="Delete Group"
                                        >
                                            <FaTrash size={14} />
                                        </button>
                                    </div>
                                )}
                                <div className="p-6">
                                    <div className="flex items-start gap-4 mb-6">
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-safaricom-green to-green-800 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-green-200 shrink-0">
                                            {initials}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-gray-800 leading-tight mb-1 line-clamp-2">{group.group_name}</h3>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                                Since {new Date(group.created_at || group.registration_date).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 mb-6">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${getMeetingDayBadge(group.meeting_day)}`}>
                                            {group.meeting_day}s
                                        </span>
                                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-gray-100 text-gray-600 border border-gray-200">
                                            {group.meeting_frequency}
                                        </span>
                                        {group.location && (
                                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-1">
                                                <FaLocationDot size={8} /> {group.location}
                                            </span>
                                        )}
                                    </div>

                                    <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100 space-y-3">
                                        {hasOfficials ? (
                                            <>
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]"><FaUsers className="inline mr-1" /> Governance</span>
                                                    <span className="text-green-600 font-black text-[10px] uppercase bg-green-100 px-2 py-0.5 rounded-full">Active</span>
                                                </div>
                                                <div className="space-y-2 pt-1">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold">C</div>
                                                        <span className="text-sm font-bold text-gray-700 truncate">{group.chairperson_name || group.chairperson || '—'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">S</div>
                                                        <span className="text-sm font-bold text-gray-700 truncate">{group.secretary_name || group.secretary || '—'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[10px] font-bold">T</div>
                                                        <span className="text-sm font-bold text-gray-700 truncate">{group.treasurer_name || group.treasurer || '—'}</span>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center py-2">
                                                <div className="w-10 h-10 mx-auto bg-gray-200 rounded-full flex items-center justify-center text-gray-400 mb-2">
                                                    <FaUsers />
                                                </div>
                                                <p className="text-xs font-bold text-gray-500 mb-2">No officials assigned yet.</p>
                                                <button
                                                    onClick={() => openEditModal(group, true)}
                                                    className="text-[10px] font-black text-safaricom-green uppercase tracking-widest hover:underline"
                                                >
                                                    + Assign Leaders
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                                    <div className="flex -space-x-2">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="w-8 h-8 rounded-full bg-white border-2 border-white shadow-sm flex items-center justify-center text-[10px] font-bold text-gray-400">
                                                <FaUsers />
                                            </div>
                                        ))}
                                        <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[9px] font-black text-gray-500">
                                            +45
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => openEditModal(group)}
                                        className="flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-safaricom-green transition-colors"
                                    >
                                        <FaPenToSquare /> Manage
                                    </button>
                                </div>
                                <div className="px-6 pb-4 flex justify-between">
                                    <button
                                        onClick={() => navigate(`/groups/${group.id}/ledger`)}
                                        className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 py-2 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-colors"
                                    >
                                        <FaBook /> View Ledger
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Add Group Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                                <FaPlus className="text-safaricom-green" /> Register New Group
                            </h3>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="text-gray-400 hover:text-red-500 text-xl"
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleAddGroup} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                    Group Name *
                                </label>
                                <input
                                    type="text"
                                    value={newGroup.group_name}
                                    onChange={(e) => setNewGroup({ ...newGroup, group_name: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-safaricom-green/50 font-bold"
                                    placeholder="e.g., Ukombozi Group A"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                    Meeting Day *
                                </label>
                                <select
                                    value={newGroup.meeting_day}
                                    onChange={(e) => setNewGroup({ ...newGroup, meeting_day: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-safaricom-green/50 font-bold"
                                    required
                                >
                                    <option value="Monday">Monday</option>
                                    <option value="Tuesday">Tuesday</option>
                                    <option value="Wednesday">Wednesday</option>
                                    <option value="Thursday">Thursday</option>
                                    <option value="Friday">Friday</option>
                                    <option value="Saturday">Saturday</option>
                                    <option value="Sunday">Sunday</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                    Meeting Frequency *
                                </label>
                                <select
                                    value={newGroup.meeting_frequency}
                                    onChange={(e) => setNewGroup({ ...newGroup, meeting_frequency: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-safaricom-green/50 font-bold"
                                    required
                                >
                                    <option value="WEEKLY">Weekly</option>
                                    <option value="BIWEEKLY">Bi-Weekly</option>
                                    <option value="MONTHLY">Monthly</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                    Location (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={newGroup.location}
                                    onChange={(e) => setNewGroup({ ...newGroup, location: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-safaricom-green/50 font-bold"
                                    placeholder="e.g., Community Hall, Nairobi"
                                />
                            </div>

                            {/* Group Officials */}
                            <div className="pt-4 border-t border-gray-100">
                                <h4 className="text-sm font-black text-gray-800 mb-3 flex items-center gap-2">
                                    <FaUsers className="text-safaricom-green" /> Group Officials (Governance)
                                </h4>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Chairperson Name *</label>
                                            <input
                                                type="text"
                                                value={newGroup.chairperson || ''}
                                                onChange={(e) => setNewGroup({ ...newGroup, chairperson: e.target.value })}
                                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-safaricom-green text-sm font-bold"
                                                placeholder="Full Name"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Chair Phone *</label>
                                            <input
                                                type="tel"
                                                value={newGroup.chairperson_phone || ''}
                                                onChange={(e) => setNewGroup({ ...newGroup, chairperson_phone: e.target.value })}
                                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-safaricom-green text-sm font-bold"
                                                placeholder="07..."
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Secretary Name *</label>
                                            <input
                                                type="text"
                                                value={newGroup.secretary || ''}
                                                onChange={(e) => setNewGroup({ ...newGroup, secretary: e.target.value })}
                                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-safaricom-green text-sm font-bold"
                                                placeholder="Full Name"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Sec Phone *</label>
                                            <input
                                                type="tel"
                                                value={newGroup.secretary_phone || ''}
                                                onChange={(e) => setNewGroup({ ...newGroup, secretary_phone: e.target.value })}
                                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-safaricom-green text-sm font-bold"
                                                placeholder="07..."
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Treasurer Name *</label>
                                            <input
                                                type="text"
                                                value={newGroup.treasurer || ''}
                                                onChange={(e) => setNewGroup({ ...newGroup, treasurer: e.target.value })}
                                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-safaricom-green text-sm font-bold"
                                                placeholder="Full Name"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Treas Phone *</label>
                                            <input
                                                type="tel"
                                                value={newGroup.treasurer_phone || ''}
                                                onChange={(e) => setNewGroup({ ...newGroup, treasurer_phone: e.target.value })}
                                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-safaricom-green text-sm font-bold"
                                                placeholder="07..."
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Institutional Policies */}
                            <div className="pt-4 border-t border-gray-100">
                                <h4 className="text-sm font-black text-gray-800 mb-3 flex items-center gap-2">
                                    <FaCircleCheck className="text-safaricom-green" /> Financial Policies
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Min Monthly Saving</label>
                                        <input
                                            type="number"
                                            value={newGroup.minMonthlySaving}
                                            onChange={(e) => setNewGroup({ ...newGroup, minMonthlySaving: e.target.value })}
                                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-safaricom-green text-sm font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Loan Multiplier</label>
                                        <input
                                            type="number"
                                            value={newGroup.loanMultiplier}
                                            onChange={(e) => setNewGroup({ ...newGroup, loanMultiplier: e.target.value })}
                                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-safaricom-green text-sm font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Div Policy (75% = 0.75)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={newGroup.dividendPolicy}
                                            onChange={(e) => setNewGroup({ ...newGroup, dividendPolicy: e.target.value })}
                                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-safaricom-green text-sm font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Financial Year</label>
                                        <input
                                            type="number"
                                            value={newGroup.financial_year}
                                            onChange={(e) => setNewGroup({ ...newGroup, financial_year: e.target.value })}
                                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-safaricom-green text-sm font-bold"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-safaricom-green text-white rounded-xl font-bold hover:bg-green-700 transition-colors shadow-md"
                                >
                                    Register Group
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-3xl">
                            <div>
                                <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                                    <FaPenToSquare className="text-safaricom-green" /> Manage Group
                                </h3>
                                <p className="text-xs font-bold text-safaricom-green uppercase tracking-wider mt-1">{editGroup.group_name}</p>
                            </div>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="w-10 h-10 rounded-full bg-white text-gray-400 hover:text-red-500 flex items-center justify-center shadow-sm transition-colors"
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleUpdateGroup} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                            {/* Basic Info */}
                            <section className="space-y-4">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <span className="w-8 h-[1px] bg-gray-200"></span> Basic Information
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 ml-1">Group Name</label>
                                        <input
                                            type="text"
                                            value={editGroup.group_name}
                                            onChange={(e) => setEditGroup({ ...editGroup, group_name: e.target.value })}
                                            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-safaricom-green/50 outline-none font-bold"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 ml-1">Location</label>
                                        <input
                                            type="text"
                                            value={editGroup.location}
                                            onChange={(e) => setEditGroup({ ...editGroup, location: e.target.value })}
                                            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-safaricom-green/50 outline-none font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 ml-1">Meeting Day</label>
                                        <select
                                            value={editGroup.meeting_day}
                                            onChange={(e) => setEditGroup({ ...editGroup, meeting_day: e.target.value })}
                                            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-safaricom-green/50 outline-none font-bold"
                                        >
                                            <option value="Monday">Monday</option>
                                            <option value="Tuesday">Tuesday</option>
                                            <option value="Wednesday">Wednesday</option>
                                            <option value="Thursday">Thursday</option>
                                            <option value="Friday">Friday</option>
                                            <option value="Saturday">Saturday</option>
                                            <option value="Sunday">Sunday</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 ml-1">Frequency</label>
                                        <select
                                            value={editGroup.meeting_frequency}
                                            onChange={(e) => setEditGroup({ ...editGroup, meeting_frequency: e.target.value })}
                                            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-safaricom-green/50 outline-none font-bold"
                                        >
                                            <option value="WEEKLY">Weekly</option>
                                            <option value="BIWEEKLY">Bi-Weekly</option>
                                            <option value="MONTHLY">Monthly</option>
                                        </select>
                                    </div>
                                </div>
                            </section>

                            {/* Governance */}
                            <section className="space-y-4">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <span className="w-8 h-[1px] bg-gray-200"></span> Governance / Officials
                                </h4>
                                <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-blue-600 uppercase mb-2 ml-1 flex items-center justify-between">
                                            <span>Chairperson</span>
                                            {editGroup.chairperson_id && <span className="text-[8px] bg-blue-600 text-white px-1.5 py-0.5 rounded">Linked Member</span>}
                                        </label>
                                        <select
                                            value={editGroup.chairperson_id}
                                            onChange={(e) => {
                                                const member = groupMembers.find(m => m.id.toString() === e.target.value);
                                                setEditGroup({
                                                    ...editGroup,
                                                    chairperson_id: e.target.value,
                                                    chairperson: member ? member.name : ''
                                                });
                                            }}
                                            className="w-full px-4 py-3 bg-white border-2 border-blue-100 rounded-xl focus:border-blue-500 outline-none font-bold"
                                        >
                                            <option value="">Select from members...</option>
                                            {groupMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-blue-600 uppercase mb-2 ml-1">Secretary</label>
                                        <select
                                            value={editGroup.secretary_id}
                                            onChange={(e) => {
                                                const member = groupMembers.find(m => m.id.toString() === e.target.value);
                                                setEditGroup({
                                                    ...editGroup,
                                                    secretary_id: e.target.value,
                                                    secretary: member ? member.name : ''
                                                });
                                            }}
                                            className="w-full px-4 py-3 bg-white border-2 border-blue-100 rounded-xl focus:border-blue-500 outline-none font-bold"
                                        >
                                            <option value="">Select from members...</option>
                                            {groupMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-blue-600 uppercase mb-2 ml-1">Treasurer</label>
                                        <select
                                            value={editGroup.treasurer_id}
                                            onChange={(e) => {
                                                const member = groupMembers.find(m => m.id.toString() === e.target.value);
                                                setEditGroup({
                                                    ...editGroup,
                                                    treasurer_id: e.target.value,
                                                    treasurer: member ? member.name : ''
                                                });
                                            }}
                                            className="w-full px-4 py-3 bg-white border-2 border-blue-100 rounded-xl focus:border-blue-500 outline-none font-bold"
                                        >
                                            <option value="">Select from members...</option>
                                            {groupMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                    </div>

                                    {groupMembers.length === 0 && (
                                        <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg">
                                            <p className="text-[10px] font-bold text-orange-700 leading-tight">
                                                ⚠️ No members found in this group. You must add members in the <b>Members</b> directory before you can assign them as officials.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section className="space-y-4 pb-4">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <span className="w-8 h-[1px] bg-gray-200"></span> Financial Policies
                                </h4>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <label className="block text-[9px] font-black text-gray-400 uppercase mb-2">Min Monthly Saving</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">KES</span>
                                            <input
                                                type="number"
                                                value={editGroup.minMonthlySaving}
                                                onChange={(e) => setEditGroup({ ...editGroup, minMonthlySaving: e.target.value })}
                                                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl font-black text-sm outline-none focus:border-safaricom-green"
                                            />
                                        </div>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <label className="block text-[9px] font-black text-gray-400 uppercase mb-2">Loan Multiplier</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">×</span>
                                            <input
                                                type="number"
                                                value={editGroup.loanMultiplier}
                                                onChange={(e) => setEditGroup({ ...editGroup, loanMultiplier: e.target.value })}
                                                className="w-full pl-6 pr-4 py-2 bg-white border border-gray-200 rounded-xl font-black text-sm outline-none focus:border-safaricom-green"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </form>

                        {/* Footer */}
                        <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-3xl">
                            <button
                                type="submit"
                                onClick={handleUpdateGroup}
                                disabled={isUpdating}
                                className="w-full py-4 bg-safaricom-green text-white rounded-2xl font-black shadow-lg shadow-green-200 hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                {isUpdating ? <FaSpinner className="animate-spin" /> : <FaCircleCheck />}
                                {isUpdating ? "SAVING CHANGES..." : "CONFIRM & SAVE UPDATES"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupsManagement;
