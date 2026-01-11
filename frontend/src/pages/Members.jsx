import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { mockMembers, mockGroups } from '../data/mockData';
import { FaUserPlus, FaSearch, FaEllipsisV, FaUser, FaHistory, FaHandHoldingUsd, FaBan, FaCheckCircle, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import LoanIssuanceModal from '../components/LoanIssuanceModal';

const Members = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showLoanModal, setShowLoanModal] = useState(false);
    const [selectedMemberForLoan, setSelectedMemberForLoan] = useState(null);
    const [members, setMembers] = useState(mockMembers);
    const [newMember, setNewMember] = useState({ name: '', phone: '', groupId: '' });

    // Filter members
    const filteredMembers = members.filter(member => {
        const matchesSearch =
            member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            member.phone.includes(searchTerm);
        const matchesGroup = selectedGroup ? member.groupId.toString() === selectedGroup : true;
        return matchesSearch && matchesGroup;
    });

    // Helper to get group name
    const getGroupName = (groupId) => {
        const group = mockGroups.find(g => g.id === parseInt(groupId));
        return group ? group.name : 'Unknown Group';
    };

    const handleAddMember = (e) => {
        e.preventDefault();
        if (!newMember.name || !newMember.phone || !newMember.groupId) {
            toast.error('Please fill in all fields');
            return;
        }

        const newMemberObj = {
            id: members.length + 1,
            ...newMember,
            groupId: parseInt(newMember.groupId),
            status: 'Active',
            balance: 0
        };

        setMembers([...members, newMemberObj]);
        setShowModal(false);
        setNewMember({ name: '', phone: '', groupId: '' });
        toast.success('Member added successfully!');
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Member Ledger Directory</h2>
                    <p className="text-sm text-gray-500">Live directory tracking balances and status</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center bg-safaricom-green hover:bg-safaricom-dark text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-green-900/20 transition-all active:scale-95"
                >
                    <FaUserPlus className="mr-2" />
                    New Member
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name or phone number..."
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-full md:w-64">
                    <select
                        className="w-full border border-gray-200 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green transition-all appearance-none bg-no-repeat bg-[right_1rem_center]"
                        value={selectedGroup}
                        onChange={(e) => setSelectedGroup(e.target.value)}
                    >
                        <option value="">All Groups</option>
                        {mockGroups.map(group => (
                            <option key={group.id} value={group.id}>{group.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Member Details</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Group</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Balance (KES)</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredMembers.map((member) => (
                                <tr key={member.id} className={`hover:bg-gray-50/50 transition-colors group ${member.status === 'Inactive' ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-lg shadow-inner ${member.status === 'Active' ? 'bg-safaricom-green/10 text-safaricom-green' : 'bg-gray-100 text-gray-400'}`}>
                                                {member.name.charAt(0)}
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-bold text-gray-900 group-hover:text-safaricom-dark">{member.name}</div>
                                                <div className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">{member.phone}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-600 font-medium">{getGroupName(member.groupId)}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-bold text-gray-900">
                                            {member.balance.toLocaleString()}
                                            <span className="ml-1 text-[10px] text-gray-400 font-normal">System Calculated</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2.5 py-1 inline-flex text-[10px] leading-5 font-bold rounded-lg ${member.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {member.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="flex justify-end gap-2">
                                            <Link
                                                to={`/members/${member.id}`}
                                                title="View Ledger"
                                                className="text-gray-400 hover:text-safaricom-green p-2 rounded-lg hover:bg-green-50 transition-colors"
                                            >
                                                <FaHistory />
                                            </Link>
                                            <button
                                                disabled={member.status === 'Inactive'}
                                                title={member.status === 'Inactive' ? "Cannot issue loan to inactive member" : "Issue Loan"}
                                                onClick={() => {
                                                    setSelectedMemberForLoan(member);
                                                    setShowLoanModal(true);
                                                }}
                                                className={`${member.status === 'Inactive' ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'} p-2 rounded-lg transition-colors`}
                                            >
                                                <FaHandHoldingUsd />
                                            </button>
                                            <Link
                                                to={`/members/${member.id}`}
                                                title="Member Profile"
                                                className="text-gray-400 hover:text-safaricom-dark p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                            >
                                                <FaUser />
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredMembers.length === 0 && (
                    <div className="p-12 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 text-gray-300 mb-4">
                            <FaSearch size={32} />
                        </div>
                        <p className="text-gray-500 font-medium">No members found matching your search.</p>
                    </div>
                )}
            </div>

            {/* New Member Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-safaricom-green p-6 text-white flex justify-between items-center">
                            <h3 className="text-xl font-bold">Register New Member</h3>
                            <button onClick={() => setShowModal(false)} className="hover:rotate-90 transition-transform">
                                <FaTimes size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleAddMember} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none transition-all"
                                    placeholder="Enter full name"
                                    value={newMember.name}
                                    onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone Number</label>
                                <input
                                    required
                                    type="tel"
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none transition-all"
                                    placeholder="+254..."
                                    value={newMember.phone}
                                    onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                                />
                                <p className="text-[10px] text-gray-400 mt-1 italic">Note: Phone number is the primary identifier and cannot be changed later.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Assigned Group</label>
                                <select
                                    required
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none transition-all appearance-none bg-no-repeat bg-[right_1rem_center]"
                                    value={newMember.groupId}
                                    onChange={(e) => setNewMember({ ...newMember, groupId: e.target.value })}
                                >
                                    <option value="">Select a group</option>
                                    {mockGroups.map(group => (
                                        <option key={group.id} value={group.id}>{group.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-3 px-4 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 px-4 bg-safaricom-green hover:bg-safaricom-dark text-white font-bold rounded-xl shadow-lg shadow-green-900/20 transition-all active:scale-95"
                                >
                                    Create Member
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Loan Issuance Modal */}
            <LoanIssuanceModal
                isOpen={showLoanModal}
                onClose={() => setShowLoanModal(false)}
                member={selectedMemberForLoan}
                onSuccess={(newLoan) => {
                    // In a real app, we'd update the loans list and potentially the member balance
                    console.log('New Loan Issued:', newLoan);
                }}
            />
        </div>
    );
};

export default Members;
