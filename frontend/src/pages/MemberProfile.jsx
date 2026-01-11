import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { mockMembers, mockGroups, mockLoans, mockLedgerEntries } from '../data/mockData';
import { FaArrowLeft, FaPhone, FaUsers, FaWallet, FaChartLine, FaHandHoldingUsd, FaHistory, FaCalendarAlt, FaFileInvoiceDollar, FaCheckCircle, FaPlus } from 'react-icons/fa';
import LoanIssuanceModal from '../components/LoanIssuanceModal';
import ContributionModal from '../components/ContributionModal';

const MemberProfile = () => {
    const { id } = useParams();
    const memberId = parseInt(id);
    const [showLoanModal, setShowLoanModal] = useState(false);
    const [showContributionModal, setShowContributionModal] = useState(false);

    // Find member
    const member = mockMembers.find(m => m.id === memberId);

    // Find group
    const group = mockGroups.find(g => g.id === member?.groupId);

    // Member's loans
    const memberLoans = mockLoans.filter(l => l.memberName === member?.name);

    // Member's ledger
    const memberLedger = mockLedgerEntries.filter(e => e.memberId === memberId);

    // Member Stats Calculation (Step 4 logic)
    const totalContributions = memberLedger
        .filter(e => e.type === 'Credit' && e.description.toLowerCase().includes('saving'))
        .reduce((acc, curr) => acc + curr.amount, 0);

    const activeLoans = mockLoans.filter(l => l.memberName === member?.name && l.status === 'Active');
    const loanBalance = activeLoans.reduce((acc, curr) => acc + curr.amount, 0);

    // Dividend Calculation (Formula)
    const groupTotalContributions = mockLedgerEntries
        .filter(e => e.type === 'Credit' && e.description.toLowerCase().includes('saving'))
        .reduce((acc, curr) => acc + curr.amount, 0);

    const distributableSurplus = 500000; // Mocked group surplus
    const memberShare = totalContributions / (groupTotalContributions || 1);
    const expectedDividend = memberShare * distributableSurplus;

    if (!member) {
        return (
            <div className="p-12 text-center">
                <h2 className="text-2xl font-bold text-gray-800">Member not found</h2>
                <Link to="/members" className="text-safaricom-green hover:underline mt-4 inline-block font-bold">Back to Members Directory</Link>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12">
            {/* Header / Nav */}
            <div className="flex items-center gap-4">
                <Link to="/members" className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400">
                    <FaArrowLeft />
                </Link>
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Member Profile</h2>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span className="font-medium text-safaricom-dark">{member.name}</span>
                        <span>•</span>
                        <span>{group?.name}</span>
                    </div>
                </div>
            </div>

            {/* Profile Summary Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-safaricom-green to-safaricom-dark p-8 text-white">
                    <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
                        <div className="w-24 h-24 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-4xl font-bold shadow-xl">
                            {member.name.charAt(0)}
                        </div>
                        <div className="flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="text-3xl font-extrabold">{member.name}</h1>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${member.status === 'Active' ? 'bg-white text-safaricom-green' : 'bg-red-500 text-white'}`}>
                                    {member.status}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-6 text-sm opacity-90">
                                <span className="flex items-center gap-2"><FaPhone /> {member.phone}</span>
                                <span className="flex items-center gap-2"><FaUsers /> {group?.name}</span>
                                <span className="flex items-center gap-2 font-bold"><FaWallet /> KES {member.balance.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="w-full md:w-auto flex gap-3">
                            <button
                                onClick={() => setShowLoanModal(true)}
                                disabled={member.status === 'Inactive'}
                                className="flex-1 md:flex-none py-3 px-6 bg-white text-safaricom-green font-bold rounded-xl shadow-lg shadow-black/10 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Issue Loan
                            </button>
                            <button
                                onClick={() => setShowContributionModal(true)}
                                className="flex-1 md:flex-none py-3 px-6 bg-black/20 text-white font-bold rounded-xl backdrop-blur-sm hover:bg-black/30 transition-all flex items-center justify-center gap-2"
                            >
                                <FaPlus /> Add Contribution
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-gray-100 border-t border-gray-100 bg-gray-50/30">
                    <div className="p-6 text-center">
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Total Contributions</p>
                        <p className="text-xl font-bold text-gray-800">KES {totalContributions.toLocaleString()}</p>
                    </div>
                    <div className="p-6 text-center">
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Active Loans</p>
                        <p className="text-xl font-bold text-gray-800">{activeLoans.length}</p>
                    </div>
                    <div className="p-6 text-center">
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Loan Balance</p>
                        <p className="text-xl font-bold text-red-600">KES {loanBalance.toLocaleString()}</p>
                    </div>
                    <div className="p-6 text-center">
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Interest Contribution</p>
                        <p className="text-xl font-bold text-safaricom-green">KES {Math.floor(totalContributions * 0.1).toLocaleString()}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Transaction Ledger */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <FaHistory className="text-safaricom-green" />
                            Member Ledger History
                        </h3>
                        <button className="text-xs font-bold text-safaricom-green hover:underline">Download PDF Statement</button>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">Date</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">Description</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase text-right">Amount</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase text-center">Ref</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {memberLedger.length > 0 ? memberLedger.map(entry => (
                                    <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-500">
                                            {new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-gray-900">{entry.description}</div>
                                            <div className="text-[10px] text-gray-400">Transaction ID: {entry.reference}</div>
                                        </td>
                                        <td className={`px-6 py-4 text-right font-black text-sm ${entry.type === 'Credit' ? 'text-green-600' : 'text-red-600'}`}>
                                            {entry.type === 'Credit' ? '+' : '-'} {entry.amount.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="px-2 py-0.5 bg-gray-100 text-[10px] font-bold text-gray-500 rounded uppercase">
                                                {entry.type}
                                            </span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-12 text-center text-gray-400 text-sm italic">
                                            No recent transactions found for this member.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Loan Summary & Other Info */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <FaHandHoldingUsd className="text-blue-600" />
                            Active Loan(s)
                        </h3>
                        {memberLoans.length > 0 ? memberLoans.map(loan => (
                            <div key={loan.id} className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Loan #{loan.id}</p>
                                        <p className="text-lg font-black text-gray-900">KES {loan.amount.toLocaleString()}</p>
                                    </div>
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase">
                                        {loan.status}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Interest</span>
                                        <span className="font-bold">KES {loan.interest.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Due Date</span>
                                        <span className="font-bold text-red-600">{loan.dueDate}</span>
                                    </div>
                                    <div className="pt-2">
                                        <div className="w-full bg-blue-100 h-1.5 rounded-full overflow-hidden">
                                            <div className="bg-blue-600 h-full w-[40%]" title="40% Repaid"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="p-6 text-center border-2 border-dashed border-gray-100 rounded-xl text-gray-400 text-sm">
                                <FaCheckCircle size={24} className="mx-auto mb-2 opacity-20" />
                                No active loans
                            </div>
                        )}
                        <button className="w-full py-2.5 text-blue-600 font-bold text-xs hover:bg-blue-50 rounded-xl transition-all border border-blue-100">
                            View All Loan History
                        </button>
                    </div>

                    {/* Dividends & Eligibility */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <FaChartLine className="text-purple-600" />
                            Dividend Profile
                        </h3>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                                    <FaCheckCircle />
                                </div>
                                <div>
                                    <p className="text-xs font-bold">Dividend Eligible</p>
                                    <p className="text-[10px] text-gray-500">Member meets all criteria for 2026 payout.</p>
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs text-gray-500">Member Share (Weight)</span>
                                    <span className="text-sm font-black text-gray-800">{(memberShare * 100).toFixed(2)}%</span>
                                </div>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs text-gray-500">Est. 2026 Payout</span>
                                    <span className="text-sm font-black text-safaricom-green">KES {Math.floor(expectedDividend).toLocaleString()}</span>
                                </div>
                                <p className="text-[10px] text-gray-400 italic font-medium leading-tight">Calculation based on total savings and loan repayment compliance.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Loan Issuance Modal */}
            <LoanIssuanceModal
                isOpen={showLoanModal}
                onClose={() => setShowLoanModal(false)}
                member={member}
                onSuccess={(newLoan) => {
                    console.log('New Loan Issued from Profile:', newLoan);
                }}
            />
            {/* Contribution Modal */}
            <ContributionModal
                isOpen={showContributionModal}
                onClose={() => setShowContributionModal(false)}
                member={member}
                onSuccess={(newEntry) => {
                    console.log('Ripple Effect: Profile updated with contribution:', newEntry);
                }}
            />
        </div>
    );
};

export default MemberProfile;
