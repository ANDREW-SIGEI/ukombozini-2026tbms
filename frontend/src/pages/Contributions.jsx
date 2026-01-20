import React, { useState, useEffect, useMemo } from 'react';
import { mockContributions, mockMembers, mockMeetings } from '../data/mockData';
import { FaPlus, FaSearch, FaPiggyBank, FaExclamationCircle, FaUserClock, FaCheckCircle, FaLock, FaUnlock } from 'react-icons/fa';
import ContributionModal from '../components/ContributionModal';
import { useTransactions } from '../context/TransactionContext';
import { toast } from 'react-toastify';

const Contributions = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [selectedMember, setSelectedMember] = useState(null);
    const [contributions, setContributions] = useState(mockContributions);

    const { groups } = useTransactions();

    const selectedGroup = groups.find(g => g.id === parseInt(selectedGroupId));

    // Get active meeting context
    const activeMeeting = useMemo(() => {
        if (!selectedGroupId) return null;
        return mockMeetings.find(m => m.group_id === parseInt(selectedGroupId) && m.status === 'ACTIVE');
    }, [selectedGroupId]);

    // Enhanced member list with status and arrears logic
    const displayedMembers = useMemo(() => {
        if (!selectedGroupId) return [];
        return mockMembers.filter(m => {
            const matchesGroup = m.groupId === parseInt(selectedGroupId);
            const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesGroup && matchesSearch;
        }).map(m => ({
            ...m,
            expectedContribution: 2000, // Hardcoded standard for demo
            hasArrears: m.arrears > 0,
            canPost: !!activeMeeting
        }));
    }, [selectedGroupId, searchTerm, activeMeeting]);


    const handlePostClick = (member) => {
        if (!activeMeeting) {
            toast.error("No active meeting open for this group!");
            return;
        }
        setSelectedMember(member);
        setShowModal(true);
    };

    return (
        <div className="space-y-6">
            {/* 1. Header & Group Selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Post Contributions</h2>
                    <p className="text-sm text-gray-500">Record member deposits securely within active meetings.</p>
                </div>
                <div className="w-full md:w-auto">
                    <select
                        className="w-full md:w-64 px-4 py-2 border border-gray-100 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-safaricom-green/20 outline-none font-bold text-gray-700"
                        value={selectedGroupId}
                        onChange={(e) => setSelectedGroupId(e.target.value)}
                    >
                        <option value="">Select Group Context...</option>
                        {groups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* 2. Context Banner / Warning */}
            {!selectedGroupId ? (
                <div className="bg-yellow-50 border border-yellow-100 p-6 rounded-3xl flex items-center gap-4 text-yellow-800 animate-pulse">
                    <div className="p-3 bg-yellow-100 rounded-full text-yellow-600">
                        <FaExclamationCircle size={24} />
                    </div>
                    <div>
                        <p className="font-black text-sm uppercase tracking-wider">Group Selection Required</p>
                        <p className="text-sm opacity-80">Please select a group above to verify meeting status.</p>
                    </div>
                </div>
            ) : activeMeeting ? (
                <div className="bg-green-50 border border-green-100 p-6 rounded-3xl flex items-center justify-between text-green-800 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-full text-green-600 animate-pulse">
                            <FaUnlock size={24} />
                        </div>
                        <div>
                            <p className="font-black text-sm uppercase tracking-wider">Active Meeting: {activeMeeting.session_number}</p>
                            <p className="text-sm opacity-80">
                                Date: {new Date(activeMeeting.meeting_date).toLocaleDateString()} | Started by: {activeMeeting.opened_by_name}
                            </p>
                        </div>
                    </div>
                    <div className="px-4 py-1 bg-green-200 text-green-900 rounded-full text-xs font-black uppercase">
                        Posting Enabled
                    </div>
                </div>
            ) : (
                <div className="bg-red-50 border border-red-100 p-6 rounded-3xl flex items-center justify-between text-red-800 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-100 rounded-full text-red-600">
                            <FaLock size={24} />
                        </div>
                        <div>
                            <p className="font-black text-sm uppercase tracking-wider">No Active Meeting</p>
                            <p className="text-sm opacity-80">Posting is disabled. Please open a meeting session first.</p>
                        </div>
                    </div>
                    <div className="px-4 py-1 bg-red-200 text-red-900 rounded-full text-xs font-black uppercase">
                        Posting Disabled
                    </div>
                </div>
            )}

            {/* 3. Member Action Table */}
            {selectedGroupId && (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <div className="relative mb-4">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Find member to post..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-safaricom-green/20"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Member</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Savings Bal.</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Arrears</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Expected</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {displayedMembers.length > 0 ? displayedMembers.map((member) => (
                                    <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900">{member.name}</div>
                                            <div className="text-xs text-gray-400">{member.phone}</div>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-700">
                                            KES {member.savings.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            {member.hasArrears ? (
                                                <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md text-xs font-bold">
                                                    KES {member.arrears.toLocaleString()}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 font-medium">
                                            KES {member.expectedContribution.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => handlePostClick(member)}
                                                disabled={!member.canPost}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${member.canPost
                                                        ? 'bg-safaricom-green text-white hover:bg-safaricom-dark shadow'
                                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    }`}
                                            >
                                                {member.canPost ? (
                                                    <><FaPlus /> Post</>
                                                ) : (
                                                    <><FaLock /> Closed</>
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8 text-center text-gray-400">
                                            No members found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <ContributionModal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    setSelectedMember(null);
                }}
                selectedGroupId={parseInt(selectedGroupId)}
                selectedGroupName={selectedGroup?.name}
                member={selectedMember}
                activeMeeting={activeMeeting}
                onSuccess={(newEntry) => {
                    setContributions([newEntry, ...contributions]);
                    toast.success("Contribution recorded successfully!");
                }}
            />
        </div>
    );
};

export default Contributions;
