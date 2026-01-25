import React, { useState, useEffect } from 'react';
import {
    FaUsers, FaPlus, FaMagnifyingGlass, FaPenToSquare, FaTrash,
    FaSpinner, FaCalendarDays, FaLocationDot, FaCircleCheck
} from 'react-icons/fa6';
import { toast } from 'react-toastify';
import api from '../services/api';

const GroupsManagement = () => {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
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
                                <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                                    <button className="text-gray-300 hover:text-red-500 transition-colors">
                                        <FaTrash />
                                    </button>
                                </div>
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
                                                <button className="text-[10px] font-black text-safaricom-green uppercase tracking-widest hover:underline">
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
                                    <button className="flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-safaricom-green transition-colors">
                                        <FaPenToSquare /> Manage
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
        </div>
    );
};

export default GroupsManagement;
