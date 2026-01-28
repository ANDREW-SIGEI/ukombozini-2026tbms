import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import {
    FaArrowLeft,
    FaPrint,
    FaFilter,
    FaCalendarAlt,
    FaCheckCircle,
    FaFilePdf,
    FaFileExcel,
    FaUsers
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import PdfService from '../services/pdfService';
import ExcelService from '../services/excelService';

const GroupLedger = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    // Filter states
    const [filterType, setFilterType] = useState('All');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Data states
    const [group, setGroup] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch Data
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                // 1. Fetch Group Details (Need an API for this or get from list)
                // Assuming we can filter getGroups or have a getGroup endpoint. 
                // api.getGroups returns an array. Let's find it there or create getGroup(id).
                // Existing api.getGroups fetches all. Let's use that for now.
                const allGroups = await api.getGroups();
                const groupData = allGroups.find(g => g.id === parseInt(id));

                if (!groupData) {
                    toast.error("Group not found");
                    navigate('/groups');
                    return;
                }
                setGroup(groupData);

                // 2. Fetch Group Transactions
                const txData = await api.getGroupTransactions(id);
                setTransactions(txData);

            } catch (error) {
                console.error("Ledger load error:", error);
                toast.error("Failed to load group ledger data");
            } finally {
                setIsLoading(false);
            }
        };

        if (id) loadData();
    }, [id, navigate]);

    // Filter transactions
    const filteredTransactions = useMemo(() => {
        let filtered = transactions;

        // Filter by type
        if (filterType !== 'All') {
            filtered = filtered.filter(txn => txn.transaction_type === filterType);
        }

        // Filter by date range
        if (startDate) {
            filtered = filtered.filter(txn => new Date(txn.created_at) >= new Date(startDate));
        }
        if (endDate) {
            filtered = filtered.filter(txn => new Date(txn.created_at) <= new Date(endDate));
        }

        return filtered; // transactions already desc from backend
    }, [transactions, filterType, startDate, endDate]);

    // Loading State
    if (isLoading) {
        return <div className="p-10 text-center text-gray-500">Loading Group Ledger...</div>;
    }

    // Early return if no group
    if (!group) return null;

    const handleExportPDF = () => {
        if (!group || !transactions.length) {
            toast.warn("No data to export");
            return;
        }
        PdfService.generateGroupStatement(group, filteredTransactions, "All Time");
        toast.success("Statement Exported!");
    };

    const handleExportExcel = () => {
        if (!group || !transactions.length) {
            toast.warn("No data to export");
            return;
        }
        // Format data for Excel
        const data = filteredTransactions.map(t => ({
            Date: new Date(t.created_at).toLocaleDateString(),
            Member: t.memberName || 'Unknown',
            Ref: `TX-${t.id}`,
            Type: t.transaction_type,
            Description: t.description || '-',
            Debit: ['Withdrawal', 'LoanIssue'].includes(t.transaction_type) ? (t.amount || 0) : 0,
            Credit: ['Savings', 'LoanRepayment', 'DividendPayout', 'Contribution'].includes(t.transaction_type) ? (t.amount || 0) : 0,
        }));

        ExcelService.exportToExcel(data, `Group_Ledger_${group.name.replace(/\s+/g, '_')}`, 'GroupLedger');
        toast.success("Excel Exported!");
    };

    const handlePrint = () => {
        window.print();
    };

    // Transaction type colors
    const getTypeColor = (type) => {
        const colors = {
            'Savings': 'bg-green-100 text-green-700 border-green-200',
            'LoanDisbursement': 'bg-purple-100 text-purple-700 border-purple-200',
            'LoanIssue': 'bg-purple-100 text-purple-700 border-purple-200',
            'LoanRepayment': 'bg-blue-100 text-blue-700 border-blue-200',
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
                        onClick={() => navigate('/groups')}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <FaArrowLeft className="text-gray-600" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Group Transaction Ledger</h2>
                        <p className="text-sm text-gray-500 mt-1">Consolidated financial history for all members</p>
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
                        onClick={handleExportExcel}
                        className="flex items-center px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors shadow-sm"
                        title="Export to Excel"
                    >
                        <FaFileExcel className="mr-2" /> Excel
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className="flex items-center px-4 py-2 bg-safaricom-green text-white rounded-lg hover:bg-safaricom-dark transition-colors shadow-sm"
                    >
                        <FaFilePdf className="mr-2" /> Export PDF
                    </button>
                </div>
            </div>

            {/* Group Summary Card */}
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-900 text-white rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                        <FaUsers />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black flex items-center gap-3">
                            {group.name}
                        </h3>
                        <p className="text-indigo-100">Official Group Ledger</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                        <p className="text-xs text-indigo-100 uppercase font-bold">Total Transactions</p>
                        <p className="text-lg font-black mt-1">{transactions.length}</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                        <p className="text-xs text-indigo-100 uppercase font-bold">Latest Activity</p>
                        <p className="text-sm font-bold mt-1">
                            {transactions.length > 0 ? new Date(transactions[0].created_at).toLocaleDateString() : 'N/A'}
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
                            <option value="Savings">Savings</option>
                            <option value="LoanIssue">Loan Issue</option>
                            <option value="LoanRepayment">Loan Repayment</option>
                            <option value="Contribution">Contribution</option>
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
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Member</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Reference</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-10 text-center text-gray-500">
                                        No transactions found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                filteredTransactions.map((txn) => (
                                    <tr key={txn.id} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 text-gray-700 font-medium">
                                                <FaCalendarAlt className="text-gray-400 text-xs" />
                                                {new Date(txn.created_at).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-gray-800">
                                            {txn.memberName || 'Unknown'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${getTypeColor(txn.transaction_type)}`}>
                                                {txn.transaction_type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 font-medium font-mono text-xs">TX-{txn.id}</td>
                                        <td className="px-6 py-4 text-right">
                                            {['Withdrawal', 'LoanIssue'].includes(txn.transaction_type) ? (
                                                <span className="text-red-600 font-bold font-mono">
                                                    - KES {(txn.amount || 0).toLocaleString()}
                                                </span>
                                            ) : (
                                                <span className="text-green-600 font-bold font-mono">
                                                    + KES {(txn.amount || 0).toLocaleString()}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 text-xs">{txn.description || '-'}</td>
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
                        <p className="font-bold text-blue-900 mb-1">🔒 Locked Group Ledger</p>
                        <p className="text-blue-700">
                            This document represents the consolidated immutable history of all member transactions in this group.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GroupLedger;
