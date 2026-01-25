import React, { useState, useEffect, useMemo } from 'react';
import { FaPlus, FaSearch, FaPiggyBank, FaUserClock, FaCheckCircle, FaLock, FaUnlock } from 'react-icons/fa';
import ContributionModal from '../components/ContributionModal';
import { toast } from 'react-toastify';
import api from '../services/api';

const Step = ({ number, label, active, completed }) => (
    <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm transition-all duration-500 ${completed ? 'bg-safaricom-green text-white' :
            active ? 'bg-safaricom-green text-white ring-4 ring-green-100 scale-110' :
                'bg-gray-100 text-gray-400'
            }`}>
            {completed ? <FaCheckCircle /> : number}
        </div>
        <span className={`text-xs font-bold tracking-tight hidden md:block ${active || completed ? 'text-gray-800' : 'text-gray-400'
            }`}>{label}</span>
    </div>
);

const Contributions = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [groupSearchTerm, setGroupSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [selectedMember, setSelectedMember] = useState(null);
    const [loading, setLoading] = useState(true);

    const [groups, setGroups] = useState([]);
    const [members, setMembers] = useState([]);
    const [activeMeeting, setActiveMeeting] = useState(null);

    const selectedGroup = groups.find(g => g.id === parseInt(selectedGroupId));

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (selectedGroupId) {
            fetchActiveMeeting(selectedGroupId);
        } else {
            setActiveMeeting(null);
        }
    }, [selectedGroupId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [groupsData, membersData] = await Promise.all([
                api.getGroups(),
                api.getMembers()
            ]);

            const enrichedGroups = await Promise.all((groupsData || []).map(async (group) => {
                const activeMeeting = await api.getActiveMeeting(group.id);
                return {
                    ...group,
                    hasActiveMeeting: !!activeMeeting,
                    activeMeeting: activeMeeting
                };
            }));

            setGroups(enrichedGroups);
            setMembers(membersData || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const fetchActiveMeeting = async (groupId) => {
        try {
            const meeting = await api.getActiveMeeting(groupId);
            setActiveMeeting(meeting);
        } catch (error) {
            console.error(error);
            setActiveMeeting(null);
        }
    };

    const filteredGroups = useMemo(() => {
        return groups.filter(g =>
            g.group_name.toLowerCase().includes(groupSearchTerm.toLowerCase()) ||
            (g.location && g.location.toLowerCase().includes(groupSearchTerm.toLowerCase()))
        );
    }, [groups, groupSearchTerm]);

    const displayedMembers = useMemo(() => {
        if (!selectedGroupId) return [];
        return members.filter(m => {
            const matchesGroup = m.group_id === parseInt(selectedGroupId);
            const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesGroup && matchesSearch;
        }).map(m => ({
            ...m,
            expectedContribution: 100, // Matrix default
            hasArrears: m.arrears > 0,
            canPost: !!activeMeeting
        }));
    }, [selectedGroupId, searchTerm, activeMeeting, members]);

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
            {/* 1. Header & Workflow Stepper */}
            <div className="flex flex-col gap-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-gray-800 tracking-tight">Post Contributions</h2>
                        <p className="text-sm text-gray-500 font-medium">Record member deposits securely within active meetings.</p>
                    </div>
                    {selectedGroupId && (
                        <button
                            onClick={() => setSelectedGroupId('')}
                            className="text-xs font-bold text-safaricom-green hover:underline flex items-center gap-1"
                        >
                            ← Change Group
                        </button>
                    )}
                </div>

                <div className="flex items-center justify-center max-w-2xl mx-auto w-full mb-4">
                    <Step number="1" label="Select Group" active={!selectedGroupId} completed={!!selectedGroupId} />
                    <div className={`h-1 w-12 mx-2 rounded-full ${selectedGroupId ? 'bg-safaricom-green' : 'bg-gray-200'}`} />
                    <Step number="2" label="Post Deposits" active={!!selectedGroupId && !!activeMeeting} completed={false} />
                    <div className={`h-1 w-12 mx-2 rounded-full bg-gray-200`} />
                    <Step number="3" label="Finalize" active={false} completed={false} />
                </div>
            </div>

            {/* 2. Group Dashboard Selection */}
            {!selectedGroupId ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                    {/* Group Search Bar */}
                    <div className="max-w-xl mx-auto relative group">
                        <FaSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-safaricom-green transition-colors" />
                        <input
                            type="text"
                            placeholder="Search group by name or location..."
                            className="w-full pl-14 pr-6 py-4 bg-white border-2 border-gray-100 rounded-2xl shadow-sm focus:outline-none focus:border-safaricom-green/50 focus:ring-4 focus:ring-green-500/5 font-bold text-gray-700 transition-all"
                            value={groupSearchTerm}
                            onChange={(e) => setGroupSearchTerm(e.target.value)}
                        />
                        {groupSearchTerm && (
                            <button
                                onClick={() => setGroupSearchTerm('')}
                                className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-black text-gray-300 hover:text-red-500 transition-colors"
                            >
                                CLEAR
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredGroups.map(group => (
                            <div
                                key={group.id}
                                onClick={() => setSelectedGroupId(group.id.toString())}
                                className={`group relative bg-white border rounded-3xl p-6 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all cursor-pointer overflow-hidden ${group.hasActiveMeeting ? 'border-green-100' : 'border-gray-100'
                                    }`}
                            >
                                <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl transition-colors ${group.hasActiveMeeting ? 'bg-safaricom-green/5' : 'bg-gray-100'
                                    }`} />

                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-2xl ${group.hasActiveMeeting ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                        <FaPiggyBank size={24} />
                                    </div>
                                    <div className="flex flex-col items-end">
                                        {group.hasActiveMeeting ? (
                                            <span className="flex items-center gap-1.5 px-3 py-1 bg-green-500 text-white text-[10px] font-black uppercase rounded-full shadow-sm">
                                                <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                                                Active Session
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 bg-gray-100 text-gray-400 text-[10px] font-black uppercase rounded-full">
                                                Closed
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <h3 className="text-xl font-black text-gray-800 mb-1">{group.group_name}</h3>
                                <p className="text-xs text-gray-500 mb-4 flex items-center gap-1">
                                    <FaUserClock /> {group.meeting_day} • {group.meeting_frequency}
                                </p>
                                {group.location && (
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                                        📍 {group.location}
                                    </p>
                                )}

                                {group.hasActiveMeeting ? (
                                    <button className="w-full mt-6 py-3 bg-gradient-to-r from-safaricom-green to-green-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-green-200 group-hover:from-green-600 group-hover:to-green-700 transition-all">
                                        Open Ledger
                                    </button>
                                ) : (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            window.location.href = `/meetings?groupId=${group.id}`;
                                        }}
                                        className="w-full mt-6 py-3 border-2 border-gray-100 text-gray-400 rounded-2xl font-black text-sm hover:border-safaricom-green hover:text-safaricom-green transition-all bg-gray-50/50"
                                    >
                                        Open New Meeting
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {filteredGroups.length === 0 && (
                        <div className="py-20 text-center space-y-4">
                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                                <FaSearch size={32} className="text-gray-200" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-gray-400">No groups found</h3>
                                <p className="text-sm text-gray-500">Try searching with a different name or location.</p>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    {/* Meeting Status Banner */}
                    {activeMeeting ? (
                        <div className="bg-green-50 border border-green-100 p-6 rounded-3xl flex items-center justify-between text-green-800 shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-green-100 rounded-full text-green-600 animate-pulse">
                                    <FaUnlock size={24} />
                                </div>
                                <div>
                                    <p className="font-black text-sm uppercase tracking-wider">Active Meeting: {activeMeeting.session_number}</p>
                                    <p className="text-sm opacity-80">
                                        Date: {new Date(activeMeeting.meeting_date).toLocaleDateString()}
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
                                    <p className="text-sm opacity-80">Please open a meeting session first.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => window.location.href = '/meetings'}
                                className="px-6 py-3 bg-red-600 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-red-100 hover:bg-red-700 transition-all"
                            >
                                Open Session
                            </button>
                        </div>
                    )}

                    {/* Member Action Table */}
                    <div className="bg-white p-6 rounded-3xl shadow-xl shadow-gray-100/50 border border-gray-100">
                        <div className="relative mb-6">
                            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Find member to post deposits..."
                                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:outline-none focus:ring-2 focus:ring-safaricom-green/20 font-medium text-gray-700"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Member</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Savings Bal.</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Arrears</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Expected</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {displayedMembers.length > 0 ? displayedMembers.map((member) => (
                                        <tr key={member.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-5">
                                                <div className="font-black text-gray-900">{member.name}</div>
                                                <div className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">{member.phone}</div>
                                            </td>
                                            <td className="px-6 py-5 font-bold text-gray-700">
                                                KES {member.savings?.toLocaleString() || '0'}
                                            </td>
                                            <td className="px-6 py-5">
                                                {member.hasArrears ? (
                                                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded-lg text-[10px] font-black">
                                                        KES {member.arrears?.toLocaleString() || '0'}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300 text-[10px] font-black uppercase">None</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-5 text-gray-600 font-bold">
                                                KES {member.expectedContribution?.toLocaleString() || '0'}
                                            </td>
                                            <td className="px-6 py-5">
                                                <button
                                                    onClick={() => handlePostClick(member)}
                                                    disabled={!member.canPost}
                                                    className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${member.canPost
                                                        ? 'bg-safaricom-green text-white hover:bg-safaricom-dark shadow-lg shadow-green-100 active:scale-95'
                                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                        }`}
                                                >
                                                    {member.canPost ? <><FaPlus /> Post Deposit</> : <><FaLock /> Locked</>}
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-12 text-center">
                                                <div className="flex flex-col items-center gap-3 text-gray-300">
                                                    <FaSearch size={40} className="opacity-20" />
                                                    <p className="font-bold text-sm">No members found matching your search</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <ContributionModal
                        isOpen={showModal}
                        onClose={() => {
                            setShowModal(false);
                            setSelectedMember(null);
                        }}
                        selectedGroupId={parseInt(selectedGroupId)}
                        selectedGroupName={selectedGroup?.group_name}
                        member={selectedMember}
                        activeMeeting={activeMeeting}
                        onSuccess={async (contributionData) => {
                            try {
                                await api.postContribution({
                                    memberId: contributionData.memberId,
                                    groupId: contributionData.groupId,
                                    meetingId: contributionData.meetingId,
                                    type: contributionData.type,
                                    amount: contributionData.amount,
                                    paymentMethod: contributionData.paymentMethod,
                                    meetingReference: contributionData.meetingReference,
                                    officerId: contributionData.officerId || 1,
                                    affectsSavings: contributionData.contributionRule.affectsSavings,
                                    affectsLoanEligibility: contributionData.contributionRule.affectsLoanEligibility,
                                    affectsCash: contributionData.contributionRule.affectsCash
                                });
                                toast.success("✅ Recorded successfully!");
                                fetchData();
                            } catch (error) {
                                console.error(error);
                                toast.error("Failed to record contribution");
                                throw error;
                            }
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default Contributions;
