import React, { useState, useEffect } from 'react';
import {
    FaUsers, FaPlus, FaSearch, FaEdit, FaTrash,
    FaSpinner, FaCalendarAlt, FaMapMarkerAlt, FaCheckCircle
} from 'react-icons/fa';
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
        location: ''
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
                group_name: newGroup.group_name,
                meeting_day: newGroup.meeting_day,
                meeting_frequency: newGroup.meeting_frequency,
                location: newGroup.location || null,
                chairperson: newGroup.chairperson,
                secretary: newGroup.secretary,
                treasurer: newGroup.treasurer,
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
                secretary: '',
                treasurer: ''
            });
            fetchGroups();
        } catch (error) {
            console.error(error);
            toast.error("Failed to create group");
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
                    <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
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
                    <div className="col-span-full py-12 text-center text-gray-500 font-bold">
                        <FaSpinner className="animate-spin inline mr-2" /> Loading Groups...
                    </div>
                ) : filteredGroups.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-gray-400 font-bold">
                        No groups found. Click "Register New Group" to create one.
                    </div>
                ) : (
                    filteredGroups.map((group) => (
                        <div
                            key={group.id}
                            className="bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-100 hover:border-safaricom-green/30 transition-all hover:shadow-md"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-black text-gray-800">{group.group_name}</h3>
                                    <p className="text-xs text-gray-400 font-bold uppercase">
                                        Since {new Date(group.created_at || group.registration_date).toLocaleDateString()}
                                    </p>
                                </div>
                                <span className="p-2 bg-green-50 text-green-600 rounded-lg">
                                    <FaCheckCircle />
                                </span>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm">
                                    <FaCalendarAlt className="text-gray-400" />
                                    <span className="font-bold text-gray-600">Meeting Day:</span>
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${getMeetingDayBadge(group.meeting_day)}`}>
                                        {group.meeting_day}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 text-sm">
                                    <FaCalendarAlt className="text-gray-400" />
                                    <span className="font-bold text-gray-600">Frequency:</span>
                                    <span className="text-gray-700">{group.meeting_frequency}</span>
                                </div>

                                {group.location && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <FaMapMarkerAlt className="text-gray-400" />
                                        <span className="font-bold text-gray-600">Location:</span>
                                        <span className="text-gray-700">{group.location}</span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                                <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-bold text-sm">
                                    <FaEdit /> Edit
                                </button>
                                <button className="flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-bold text-sm">
                                    <FaTrash />
                                </button>
                            </div>
                        </div>
                    ))
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
                                <div className="grid grid-cols-1 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Chairperson Name</label>
                                        <input
                                            type="text"
                                            value={newGroup.chairperson || ''}
                                            onChange={(e) => setNewGroup({ ...newGroup, chairperson: e.target.value })}
                                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-safaricom-green text-sm"
                                            placeholder="Enter full name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Secretary Name</label>
                                        <input
                                            type="text"
                                            value={newGroup.secretary || ''}
                                            onChange={(e) => setNewGroup({ ...newGroup, secretary: e.target.value })}
                                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-safaricom-green text-sm"
                                            placeholder="Enter full name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Treasurer Name</label>
                                        <input
                                            type="text"
                                            value={newGroup.treasurer || ''}
                                            onChange={(e) => setNewGroup({ ...newGroup, treasurer: e.target.value })}
                                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-safaricom-green text-sm"
                                            placeholder="Enter full name"
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
