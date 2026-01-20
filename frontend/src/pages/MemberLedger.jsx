import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { mockMembers } from '../data/mockData';
import {
    FaArrowLeft,
    FaFileDownload,
    FaPrint,
    FaFilter,
    FaCalendarAlt,
    FaCheckCircle,
    FaExclamationTriangle,
    FaMoneyBillWave
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { generateMemberStatementPDF } from '../utils/pdfGenerator';

// Mock transaction data - will be replaced with real data from API
const mockTransactions = [
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
        date: '2025-01-05',
        type: 'Savings',
        reference: 'Meeting #14',
        debit: 0,
        credit: 2000,
        notes: 'Weekly savings'
    },
    {
        id: 4,
        date: '2024-12-15',
        type: 'Loan Repayment',
        reference: 'Loan #LN-045',
        debit: 2500,
        credit: 0,
        notes: 'Installment 11/25'
    },
    {
        id: 5,
        date: '2024-12-01',
        type: 'Fine',
        reference: 'Meeting #13',
        debit: 500,
        credit: 0,
        notes: 'Late attendance fine'
    },
    {
        id: 6,
        date: '2024-08-10',
        type: 'Loan Disbursement',
        reference: 'Loan #LN-045',
        debit: 0,
        credit: 50000,
        notes: 'Approved long-term loan'
    },
    {
        id: 7,
        date: '2024-07-01',
        type: 'Shares',
        reference: 'Registration',
        debit: 0,
        credit: 5000,
        notes: 'Initial member shares'
    },
    {
        id: 8,
        date: '2024-07-01',
        type: 'Savings',
        reference: 'Registration',
        debit: 0,
        credit: 10000,
        notes: 'Opening balance'
    }
];

const MemberLedger = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    // Filter states
    const [filterType, setFilterType] = useState('All');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Find member
    const member = mockMembers.find(m => m.id === parseInt(id));

    // Calculate running balances
    const transactionsWithBalance = useMemo(() => {
        const sorted = [...mockTransactions].sort((a, b) =>
            new Date(a.date) - new Date(b.date)
        );

        let runningBalance = 0;
        return sorted.map(txn => {
            if (txn.type === 'Loan Disbursement' || txn.type === 'Loan Repayment') {
                // For loans: disbursement increases loan balance, repayment decreases it
                runningBalance += (txn.credit - txn.debit);
            } else {
                // For savings/shares: credits increase, debits decrease
                runningBalance += (txn.credit - txn.debit);
            }

            return {
                ...txn,
                balance: runningBalance
            };
        });
    }, []);

    // Filter transactions
    const filteredTransactions = useMemo(() => {
        let filtered = transactionsWithBalance;

        // Filter by type
        if (filterType !== 'All') {
            filtered = filtered.filter(txn => txn.type === filterType);
        }

        // Filter by date range
        if (startDate) {
            filtered = filtered.filter(txn => new Date(txn.date) >= new Date(startDate));
        }
        if (endDate) {
            filtered = filtered.filter(txn => new Date(txn.date) <= new Date(endDate));
        }

        return filtered.reverse(); // Most recent first
    }, [transactionsWithBalance, filterType, startDate, endDate]);

    // Early return after all hooks
    if (!member) {
        return (
            <div className="text-center py-20">
                <p className="text-gray-500">Member not found</p>
                <Link to="/members" className="text-safaricom-green hover:underline mt-4 inline-block">
                    ← Back to Members
                </Link>
            </div>
        );
    }

    const handleExportPDF = () => {
        try {
            // Determine period based on filters
            let period = 'All Time';
            if (startDate && endDate) {
                period = `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;
            } else if (startDate) {
                period = `From ${new Date(startDate).toLocaleDateString()}`;
            } else if (endDate) {
                period = `Up to ${new Date(endDate).toLocaleDateString()}`;
            }

            // Add filter type to period if specific type is selected
            if (filterType !== 'All') {
                period += ` (${filterType} only)`;
            }

            const filename = generateMemberStatementPDF(member, filteredTransactions, period);
            toast.success(`Statement downloaded: ${filename}`);
        } catch (error) {
            console.error('PDF generation error:', error);
            toast.error('Failed to generate PDF statement');
        }
    };

    const handlePrint = () => {
        window.print();
    };

    // Transaction type colors
    const getTypeColor = (type) => {
        const colors = {
            'Savings': 'bg-green-100 text-green-700 border-green-200',
            'Loan Disbursement': 'bg-purple-100 text-purple-700 border-purple-200',
            'Loan Repayment': 'bg-blue-100 text-blue-700 border-blue-200',
            'Shares': 'bg-teal-100 text-teal-700 border-teal-200',
            'Fine': 'bg-red-100 text-red-700 border-red-200',
            'Welfare': 'bg-orange-100 text-orange-700 border-orange-200',
            'Arrears': 'bg-red-100 text-red-700 border-red-200'
        };
        return colors[type] || 'bg-gray-100 text-gray-700 border-gray-200';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/members')}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <FaArrowLeft className="text-gray-600" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Member Full Ledger</h2>
                        <p className="text-sm text-gray-500 mt-1">Complete transaction history and financial position</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handlePrint}
                        className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <FaPrint className="mr-2" /> Print
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className="flex items-center px-4 py-2 bg-safaricom-green text-white rounded-lg hover:bg-safaricom-dark transition-colors shadow-sm"
                    >
                        <FaFileDownload className="mr-2" /> Export PDF
                    </button>
                </div>
            </div>

            {/* Member Summary Card */}
            <div className="bg-gradient-to-br from-safaricom-green to-safaricom-dark text-white rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                        {member.name.charAt(0)}
                    </div>
                    <div>
                        <h3 className="text-2xl font-black">{member.name}</h3>
                        <p className="text-blue-100">{member.phone}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                        <p className="text-xs text-blue-100 uppercase font-bold">Group</p>
                        <p className="text-sm font-bold mt-1">{member.groupName}</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                        <p className="text-xs text-blue-100 uppercase font-bold">Member Since</p>
                        <p className="text-sm font-bold mt-1">Jan 2024</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                        <p className="text-xs text-blue-100 uppercase font-bold">Total Savings</p>
                        <p className="text-lg font-black mt-1">KES {member.savings.toLocaleString()}</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                        <p className="text-xs text-blue-100 uppercase font-bold">Active Loan</p>
                        <p className="text-lg font-black mt-1">KES {member.activeLoans.toLocaleString()}</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                        <p className="text-xs text-blue-100 uppercase font-bold">Monthly Installment</p>
                        <p className="text-lg font-black mt-1">KES 2,500</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                        <p className="text-xs text-blue-100 uppercase font-bold">Current Arrears</p>
                        <p className="text-lg font-black mt-1">
                            {member.arrears > 0 ? (
                                <span className="text-red-300">KES {member.arrears.toLocaleString()}</span>
                            ) : (
                                <span className="text-green-300">KES 0</span>
                            )}
                        </p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                        <p className="text-xs text-blue-100 uppercase font-bold">Net Position</p>
                        <p className="text-lg font-black mt-1">
                            KES {(member.savings - member.activeLoans - member.arrears).toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-4">
                    <FaFilter className="text-gray-400" />
                    <h3 className="font-bold text-gray-700">Filter Transactions</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Transaction Type</label>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-safaricom-green/20"
                        >
                            <option value="All">All Transactions</option>
                            <option value="Savings">Savings Only</option>
                            <option value="Loan Disbursement">Loan Disbursement</option>
                            <option value="Loan Repayment">Loan Repayment</option>
                            <option value="Shares">Shares</option>
                            <option value="Fine">Fines</option>
                            <option value="Arrears">Arrears</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-safaricom-green/20"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-safaricom-green/20"
                        />
                    </div>

                    <div className="flex items-end">
                        <button
                            onClick={() => {
                                setFilterType('All');
                                setStartDate('');
                                setEndDate('');
                            }}
                            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-bold"
                        >
                            Clear Filters
                        </button>
                    </div>
                </div>
            </div>

            {/* Ledger Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Reference</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Debit</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Credit</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Running Balance</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-10 text-center text-gray-500">
                                        No transactions found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                filteredTransactions.map((txn) => (
                                    <tr key={txn.id} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 text-gray-700 font-medium">
                                                <FaCalendarAlt className="text-gray-400 text-xs" />
                                                {new Date(txn.date).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${getTypeColor(txn.type)}`}>
                                                {txn.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 font-medium">{txn.reference}</td>
                                        <td className="px-6 py-4 text-right">
                                            {txn.debit > 0 ? (
                                                <span className="text-red-600 font-bold font-mono">
                                                    KES {txn.debit.toLocaleString()}
                                                </span>
                                            ) : (
                                                <span className="text-gray-300">–</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {txn.credit > 0 ? (
                                                <span className="text-green-600 font-bold font-mono">
                                                    KES {txn.credit.toLocaleString()}
                                                </span>
                                            ) : (
                                                <span className="text-gray-300">–</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-blue-900 font-black font-mono text-base">
                                                KES {txn.balance.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 text-xs">{txn.notes}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer Info */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                <div className="flex items-start gap-3">
                    <FaCheckCircle className="text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                        <p className="font-bold text-blue-900 mb-1">🔒 System-Generated Ledger</p>
                        <p className="text-blue-700">
                            All entries are automatically generated from meetings, loans, and repayments.
                            This ledger is <span className="font-bold">read-only</span> and cannot be manually edited,
                            ensuring audit compliance and preventing fraud.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MemberLedger;
