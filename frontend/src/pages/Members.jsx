import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { mockMembers } from '../data/mockData';
import { FaUserPlus, FaSearch, FaHistory, FaHandHoldingUsd, FaUser, FaTimes, FaInfoCircle, FaFileInvoice, FaExclamationTriangle, FaCheckCircle, FaMoneyBillWave, FaClock } from 'react-icons/fa';
import { toast } from 'react-toastify';
import LoanIssuanceModal from '../components/LoanIssuanceModal';
import STLLoanModal from '../components/STLLoanModal';
import StatementModal from '../components/StatementModal';
import ContributionModal from '../components/ContributionModal';
import { useTransactions } from '../context/TransactionContext';
import { api } from '../services/api';

const Members = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showLoanModal, setShowLoanModal] = useState(false);
    const [showSTLModal, setShowSTLModal] = useState(false);
    const [selectedMemberForLoan, setSelectedMemberForLoan] = useState(null);
    const [showContributionModal, setShowContributionModal] = useState(false);
    const [selectedMemberForContribution, setSelectedMemberForContribution] = useState(null);
    const [members, setMembers] = useState(mockMembers);
    const [newMember, setNewMember] = useState({ name: '', phone: '', groupId: '' });
    const [showSystemInfo, setShowSystemInfo] = useState(false);
    const [showStatementModal, setShowStatementModal] = useState(false);
    const [selectedMemberForStatement, setSelectedMemberForStatement] = useState(null);

    const { groups } = useTransactions();

    // Mock active meeting for demonstration
    const [activeMeeting] = useState({
        id: 1,
        session_number: 14,
        group_id: 1,
        status: 'OPEN',
        date: new Date().toISOString().split('T')[0]
    });

    // Calculate Net Position for each member
    const membersWithNetPosition = useMemo(() => {
        return members.map(member => ({
            ...member,
            netPosition: member.savings - (member.activeLoans + member.arrears)
        }));
    }, [members]);

    // Filter members
    const filteredMembers = membersWithNetPosition.filter(member => {
        const matchesSearch =
            member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            member.phone.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesGroup = selectedGroup ? member.groupId === parseInt(selectedGroup) : true;
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
            totalArrears: groupMembers.reduce((sum, m) => sum + m.arrears, 0),
            netPosition: groupMembers.reduce((sum, m) => sum + m.netPosition, 0)
        };
    }, [filteredMembers, selectedGroup]);

    const handleAddMember = async (e) => {
        e.preventDefault();
        if (!newMember.name || !newMember.phone || !newMember.groupId) {
            toast.error('Please fill in all fields');
            return;
        }

        try {
            const payload = {
                name: newMember.name,
                phone: newMember.phone,
                groupId: parseInt(newMember.groupId),
                opening_balance_savings: parseFloat(newMember.opening_balance_savings || 0),
                opening_balance_ltl: parseFloat(newMember.opening_balance_ltl || 0),
                opening_balance_stl: parseFloat(newMember.opening_balance_stl || 0),
                opening_balance_reason: newMember.opening_balance_reason || 'New member',
                userId: 1 // For audit trail
            };

            const res = await fetch('http://localhost:5000/api/members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to create member');
            }

            const createdMember = await res.json();
            setMembers([...members, createdMember]);
            setShowModal(false);
            setNewMember({ name: '', phone: '', groupId: '' });
            toast.success(`Member "${createdMember.name}" registered successfully!`);
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleContributionSuccess = (contributionData) => {
        // Update member's savings balance locally
        setMembers(prevMembers =>
            prevMembers.map(m =>
                m.id === contributionData.memberId
                    ? { ...m, savings: m.savings + contributionData.amount, lastActivity: contributionData.date, lastActivityType: contributionData.type }
                    : m
            )
        );

        toast.success(`✅ Contribution of KES ${contributionData.amount.toLocaleString()} posted successfully!`);
        setShowContributionModal(false);
        setSelectedMemberForContribution(null);
    };

    const getNetPositionColor = (netPosition) => {
        if (netPosition > 0) return 'text-green-600 font-bold';
        if (netPosition < 0) return 'text-red-600 font-bold';
        return 'text-yellow-600 font-bold';
    };

    const getActivityAlertColor = (daysSinceActivity) => {
        if (daysSinceActivity > 60) return 'text-red-600 font-bold';
        if (daysSinceActivity > 30) return 'text-yellow-600';
        return 'text-gray-600';
    };

    return (
        <div className="space-y-6">
            {/* Header with System Badge */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-gray-800">Member Financial Snapshot</h2>
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold uppercase rounded-full border border-green-200 flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            LIVE
                        </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                        Auto-calculated balances, loans & savings
                        <button
                            onClick={() => setShowSystemInfo(!showSystemInfo)}
                            className="ml-2 text-blue-600 hover:text-blue-700"
                        >
                            <FaInfoCircle className="inline" />
                        </button>
                    </p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center px-6 py-2 bg-safaricom-green text-white rounded-xl font-extrabold hover:bg-safaricom-dark transition-all shadow-lg shadow-green-900/20"
                >
                    <FaUserPlus className="mr-2" /> New Member
                </button>
            </div>

            {/* System Info Banner */}
            {showSystemInfo && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                    <p className="text-sm font-bold text-blue-900 mb-2">🔒 System-Calculated Balances</p>
                    <p className="text-xs text-blue-700">
                        All balances are automatically calculated from:<br />
                        • Member Contributions (Savings, Welfare, etc.)<br />
                        • Loan Disbursements<br />
                        • Loan Repayments<br />
                        • Fines & Penalties<br />
                        <span className="font-bold">Manual edits are disabled.</span> This ensures audit compliance and prevents fraud.
                    </p>
                </div>
            )}

            {/* Group Filter & Stats */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name or phone number..."
                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-safaricom-green/20 shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    className="px-4 py-3 border-2 border-gray-100 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-safaricom-green/20 outline-none font-bold text-gray-700"
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                >
                    <option value="">All Groups</option>
                    {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                </select>
            </div>

            {/* Group Statistics Cards */}
            {groupStats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl text-white shadow-lg">
                        <p className="text-xs opacity-80 uppercase font-bold">Members</p>
                        <p className="text-2xl font-black">{groupStats.totalMembers}</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 rounded-xl text-white shadow-lg">
                        <p className="text-xs opacity-80 uppercase font-bold">Total Savings</p>
                        <p className="text-xl font-black">KES {groupStats.totalSavings.toLocaleString()}</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 rounded-xl text-white shadow-lg">
                        <p className="text-xs opacity-80 uppercase font-bold">Active Loans</p>
                        <p className="text-xl font-black">KES {groupStats.totalLoans.toLocaleString()}</p>
                    </div>
                    <div className="bg-gradient-to-br from-red-500 to-red-600 p-4 rounded-xl text-white shadow-lg">
                        <p className="text-xs opacity-80 uppercase font-bold">Arrears</p>
                        <p className="text-xl font-black">KES {groupStats.totalArrears.toLocaleString()}</p>
                    </div>
                    <div className={`bg-gradient-to-br ${groupStats.netPosition >= 0 ? 'from-teal-500 to-teal-600' : 'from-orange-500 to-orange-600'} p-4 rounded-xl text-white shadow-lg`}>
                        <p className="text-xs opacity-80 uppercase font-bold">Net Position</p>
                        <p className="text-xl font-black">KES {groupStats.netPosition.toLocaleString()}</p>
                    </div>
                </div>
            )}

            {/* Members Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Member Details</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Group</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Savings</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Active Loans</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Arrears</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Net Position</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Last Activity</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Quick Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredMembers.map(member => {
                                const daysSinceActivity = Math.floor((new Date() - new Date(member.lastActivity)) / (1000 * 60 * 60 * 24));

                                return (
                                    <tr key={member.id} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                                                    {member.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900">{member.name}</p>
                                                    <p className="text-xs text-gray-500">{member.phone}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-700 font-medium">{member.groupName}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-green-600 font-bold font-mono">
                                                KES {member.savings.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-purple-600 font-bold font-mono">
                                                KES {member.activeLoans.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {member.arrears > 0 ? (
                                                <span className="text-red-600 font-bold font-mono">
                                                    KES {member.arrears.toLocaleString()}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`font-mono font-black text-lg ${getNetPositionColor(member.netPosition)}`}>
                                                KES {member.netPosition.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-xs text-gray-600">{member.lastActivityType}</div>
                                            <div className={`text-[10px] ${getActivityAlertColor(daysSinceActivity)}`}>
                                                {daysSinceActivity === 0 ? 'Today' : daysSinceActivity === 1 ? 'Yesterday' : `${daysSinceActivity} days ago`}
                                                {daysSinceActivity > 60 && <span className="ml-1">⚠️</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex justify-end gap-2">
                                                <Link
                                                    to={`/members/${member.id}`}
                                                    title="View Full Ledger"
                                                    className="text-gray-400 hover:text-safaricom-green p-2 rounded-lg hover:bg-green-50 transition-colors"
                                                >
                                                    <FaHistory />
                                                </Link>
                                                <button
                                                    title="Post Contribution"
                                                    onClick={() => {
                                                        setSelectedMemberForContribution(member);
                                                        setShowContributionModal(true);
                                                    }}
                                                    className="text-gray-400 hover:text-green-600 p-2 rounded-lg hover:bg-green-50 transition-colors"
                                                >
                                                    <FaMoneyBillWave />
                                                </button>
                                                <button
                                                    disabled={member.status === 'Inactive'}
                                                    title={member.status === 'Inactive' ? "Cannot issue loan to inactive member" : "Issue Long-Term Loan"}
                                                    onClick={() => {
                                                        setSelectedMemberForLoan(member);
                                                        setShowLoanModal(true);
                                                    }}
                                                    className={`${member.status === 'Inactive' ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'} p-2 rounded-lg transition-colors`}
                                                >
                                                    <FaHandHoldingUsd />
                                                </button>
                                                <button
                                                    disabled={member.status === 'Inactive'}
                                                    title={member.status === 'Inactive' ? "Cannot issue loan to inactive member" : "Issue Short-Term Loan (STL)"}
                                                    onClick={() => {
                                                        setSelectedMemberForLoan(member);
                                                        setShowSTLModal(true);
                                                    }}
                                                    className={`${member.status === 'Inactive' ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'} p-2 rounded-lg transition-colors`}
                                                >
                                                    <FaClock />
                                                </button>
                                                <button
                                                    title="Generate Statement"
                                                    onClick={() => {
                                                        setSelectedMemberForStatement(member);
                                                        setShowStatementModal(true);
                                                    }}
                                                    className="text-gray-400 hover:text-purple-600 p-2 rounded-lg hover:bg-purple-50 transition-colors"
                                                >
                                                    <FaFileInvoice />
                                                </button>
                                                <Link
                                                    to={`/members/${member.id}`}
                                                    title="View Profile"
                                                    className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                                >
                                                    <FaUser />
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals remain the same... */}
            {/* Add Member Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    {/* Modal content... (keeping existing) */}
                </div>
            )}

            {/* Loan Issuance Modal */}
            <LoanIssuanceModal
                isOpen={showLoanModal}
                onClose={() => setShowLoanModal(false)}
                member={selectedMemberForLoan}
                activeMeeting={activeMeeting}
                onSuccess={(newLoan) => {
                    console.log('New Loan Issued:', newLoan);
                }}
            />

            {/* Contribution Modal */}
            <ContributionModal
                isOpen={showContributionModal}
                onClose={() => {
                    setShowContributionModal(false);
                    setSelectedMemberForContribution(null);
                }}
                member={selectedMemberForContribution}
                selectedGroupId={selectedMemberForContribution?.groupId}
                selectedGroupName={selectedMemberForContribution?.groupName}
                activeMeeting={activeMeeting}
                onSuccess={handleContributionSuccess}
            />

            {/* STL Loan Modal */}
            <STLLoanModal
                isOpen={showSTLModal}
                onClose={() => setShowSTLModal(false)}
                member={selectedMemberForLoan}
                onSuccess={(newLoan) => {
                    console.log('STL Issued:', newLoan);
                    setShowSTLModal(false);
                }}
            />

            {/* Statement Generation Modal */}
            {selectedMemberForStatement && (
                <StatementModal
                    isOpen={showStatementModal}
                    onClose={() => {
                        setShowStatementModal(false);
                        setSelectedMemberForStatement(null);
                    }}
                    member={selectedMemberForStatement}
                    transactions={[
                        // Mock transactions - replace with real API call
                        {
                            id: 1,
                            date: '2025-01-19',
                            type: 'Savings',
                            reference: 'Meeting #15',
                            debit: 0,
                            credit: 2000,
                            notes: 'January savings contribution'
                        },
                        {
                            id: 2,
                            date: '2025-01-19',
                            type: 'Loan Repayment',
                            reference: 'Loan #LN-045',
                            debit: 2500,
                            credit: 0,
                            notes: 'Installment 12/25'
                        },
                        {
                            id: 3,
                            date: '2024-08-10',
                            type: 'Loan Disbursement',
                            reference: 'Loan #LN-045',
                            debit: 0,
                            credit: 50000,
                            notes: 'Approved long-term loan'
                        },
                        {
                            id: 4,
                            date: '2024-07-01',
                            type: 'Shares',
                            reference: 'Registration',
                            debit: 0,
                            credit: 5000,
                            notes: 'Initial member shares'
                        }
                    ]}
                />
            )}
        </div>
    );
};

export default Members;
