import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    FaUserPlus, FaSearch, FaHistory, FaUser, FaInfoCircle,
    FaFileInvoice, FaMoneyBillWave, FaClock, FaSpinner,
    FaChartLine, FaExclamationTriangle, FaCheckCircle
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../services/api';

const Members = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [members, setMembers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newMember, setNewMember] = useState({
        name: '',
        phone: '',
        groupId: '',
        opening_balance_savings: 0
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [membersData, groupsData] = await Promise.all([
                api.getMembers(),
                api.getGroups()
            ]);

            if (membersData) setMembers(membersData);
            if (groupsData) setGroups(groupsData);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load members data");
        } finally {
            setLoading(false);
        }
    };

    // Calculate Net Position for each member
    const membersWithNetPosition = useMemo(() => {
        return members.map(member => ({
            ...member,
            savings: member.current_savings || 0,
            activeLoans: member.active_loan_balance || 0,
            netPosition: (member.current_savings || 0) - (member.active_loan_balance || 0)
        }));
    }, [members]);

    // Filter members
    const filteredMembers = membersWithNetPosition.filter(member => {
        const matchesSearch =
            member.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            member.phone?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesGroup = selectedGroup ? member.group_id?.toString() === selectedGroup : true;
        return matchesSearch && matchesGroup;
    });

    // Group Statistics
    const groupStats = useMemo(() => {
        if (!selectedGroup) return null;

        const groupMembers = filteredMembers;
        return {
            totalMembers: groupMembers.length,
            totalSavings: groupMembers.reduce((sum, m) => sum + m.savings, 0),
            totalLoans: groupMembers.reduce((sum, m) => sum + m.activeLoans, 0),
            netPosition: groupMembers.reduce((sum, m) => sum + m.netPosition, 0)
        };
    }, [filteredMembers, selectedGroup]);

    const handleAddMember = async (e) => {
        e.preventDefault();
        if (!newMember.name || !newMember.phone || !newMember.groupId) {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            const payload = {
                full_name: newMember.name,
                phone: newMember.phone,
                group_id: parseInt(newMember.groupId),
                opening_balance_savings: parseFloat(newMember.opening_balance_savings || 0)
            };

            await api.createMember(payload);
            toast.success(`✅ ${newMember.name} added successfully!`);
            setShowAddModal(false);
            setNewMember({ name: '', phone: '', groupId: '', opening_balance_savings: 0 });
            fetchData(); // Refresh list
        } catch (error) {
            console.error(error);
            toast.error("Failed to add member");
        }
    };

    const getStatusBadge = (netPosition) => {
        if (netPosition > 5000) {
            return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold flex items-center gap-1">
                <FaCheckCircle /> Healthy
            </span>;
        } else if (netPosition >= 0) {
            return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold flex items-center gap-1">
                <FaInfoCircle /> Stable
            </span>;
        } else {
            return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold flex items-center gap-1">
                <FaExclamationTriangle /> At Risk
            </span>;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                        <FaUser className="text-safaricom-green" /> Members Directory
                    </h2>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                        {filteredMembers.length} Active Members
                    </p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 bg-safaricom-green text-white px-5 py-2 rounded-xl font-bold hover:bg-green-700 transition-colors shadow-md"
                >
                    <FaUserPlus /> Register New Member
                </button>
            </div>

            {/* Group Statistics Panel */}
            {groupStats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gradient-to-r from-safaricom-green to-green-700 p-6 rounded-2xl text-white">
                    <div className="text-center">
                        <div className="text-xs font-bold uppercase opacity-80">Total Members</div>
                        <div className="text-3xl font-black">{groupStats.totalMembers}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs font-bold uppercase opacity-80">Total Savings</div>
                        <div className="text-3xl font-black">KES {groupStats.totalSavings.toLocaleString()}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs font-bold uppercase opacity-80">Active Loans</div>
                        <div className="text-3xl font-black">KES {groupStats.totalLoans.toLocaleString()}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs font-bold uppercase opacity-80">Net Position</div>
                        <div className={`text-3xl font-black ${groupStats.netPosition >= 0 ? 'text-white' : 'text-red-200'}`}>
                            KES {groupStats.netPosition.toLocaleString()}
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-1 w-full relative">
                    <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name or phone..."
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-safaricom-green/50 font-bold text-gray-600"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className="bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-600 focus:outline-none focus:border-safaricom-green/50 min-w-[200px]"
                >
                    <option value="">All Groups</option>
                    {groups.map(group => (
                        <option key={group.id} value={group.id}>{group.group_name}</option>
                    ))}
                </select>
            </div>

            {/* Members Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Member</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Group</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider text-right">Savings</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider text-right">Active Loans</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider text-right">Net Position</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500 font-bold">
                                        <FaSpinner className="animate-spin inline mr-2" /> Loading Members...
                                    </td>
                                </tr>
                            ) : filteredMembers.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-gray-400 font-bold">
                                        No members found. Click "Register New Member" to add one.
                                    </td>
                                </tr>
                            ) : (
                                filteredMembers.map((member) => (
                                    <tr key={member.id} className="hover:bg-blue-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-800">{member.full_name}</div>
                                            <div className="text-xs text-gray-500">{member.phone}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-gray-600">
                                            {member.groups?.group_name || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-bold text-green-600">
                                            KES {member.savings.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-bold text-orange-600">
                                            KES {member.activeLoans.toLocaleString()}
                                        </td>
                                        <td className={`px-6 py-4 text-right font-mono font-black text-lg ${member.netPosition >= 0 ? 'text-safaricom-green' : 'text-red-600'}`}>
                                            KES {member.netPosition.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(member.netPosition)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <Link
                                                    to={`/member-ledger/${member.id}`}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="View Ledger"
                                                >
                                                    <FaHistory />
                                                </Link>
                                                <button
                                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                    title="View Statement"
                                                >
                                                    <FaFileInvoice />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Member Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                                <FaUserPlus className="text-safaricom-green" /> Register New Member
                            </h3>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="text-gray-400 hover:text-red-500 text-xl"
                            >
                                ×
                            </button>
                        </div>
                        <form onSubmit={handleAddMember} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Full Name *</label>
                                <input
                                    type="text"
                                    value={newMember.name}
                                    onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-safaricom-green/50 font-bold"
                                    placeholder="John Doe"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Phone Number *</label>
                                <input
                                    type="tel"
                                    value={newMember.phone}
                                    onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-safaricom-green/50 font-bold"
                                    placeholder="0712345678"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Group *</label>
                                <select
                                    value={newMember.groupId}
                                    onChange={(e) => setNewMember({ ...newMember, groupId: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-safaricom-green/50 font-bold"
                                    required
                                >
                                    <option value="">Select Group</option>
                                    {groups.map(group => (
                                        <option key={group.id} value={group.id}>{group.group_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Opening Savings Balance</label>
                                <input
                                    type="number"
                                    value={newMember.opening_balance_savings}
                                    onChange={(e) => setNewMember({ ...newMember, opening_balance_savings: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-safaricom-green/50 font-bold"
                                    placeholder="0"
                                    min="0"
                                />
                                <p className="text-xs text-gray-400 mt-1">Leave as 0 for new members</p>
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
                                    Register Member
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Members;
