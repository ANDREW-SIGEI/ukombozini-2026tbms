import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api'; // Import API
import {
    FaArrowLeft,
    FaFileDownload,
    FaPrint,
    FaFilter,
    FaCalendarAlt,
    FaCheckCircle,
    FaExclamationTriangle,
    FaMoneyBillWave,
    FaFilePdf,
    FaFileExcel,
    FaUndo
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import PdfService from '../services/pdfService';
import ExcelService from '../services/excelService';
import { FaUserPlus, FaHandsHelping, FaBalanceScale, FaUserTag } from 'react-icons/fa';

// Mock transaction data - will be replaced with real data from API
// Real data is now fetched from API

const MemberLedger = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    // Filter states
    const [filterType, setFilterType] = useState('All');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Data states
    const [member, setMember] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [relationships, setRelationships] = useState({ next_of_kin: null, guarantors: [], liability_network: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [showReversalModal, setShowReversalModal] = useState(false);
    const [selectedTxn, setSelectedTxn] = useState(null);
    const [reversalReason, setReversalReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch Data
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                // 1. Fetch Member Details
                const memberData = await api.getMember(id);
                if (!memberData) {
                    toast.error("Member not found");
                    navigate('/members');
                    return;
                }
                setMember(memberData);

                // 2. Fetch Transactions
                const txData = await api.getTransactions(id);
                setTransactions(txData);

                // 3. Fetch Relationships
                const relationshipData = await api.getMemberRelationships(id);
                if (relationshipData) {
                    setRelationships(relationshipData);
                }

            } catch (error) {
                console.error("Ledger load error:", error);
                toast.error("Failed to load ledger data");
            } finally {
                setIsLoading(false);
            }
        };

        if (id) loadData();
    }, [id, navigate]);

    const handleExportStatement = () => {
        if (!member || !transactions.length) return;
        PdfService.generateMemberStatement(member, transactions, "All Time");
        toast.success("Statement Exported!");
    };

    const handleRequestReversal = async () => {
        if (!selectedTxn || !reversalReason.trim()) {
            toast.warn("Please provide a reason for the reversal.");
            return;
        }

        setIsSubmitting(true);
        try {
            await api.requestReversal(selectedTxn.id, reversalReason);
            toast.success("Reversal request submitted successfully.");
            setShowReversalModal(false);
            setReversalReason('');
            setSelectedTxn(null);
        } catch (error) {
            console.error("Reversal request error:", error);
            // toast.error is handled by api.js
        } finally {
            setIsSubmitting(false);
        }
    };

    // Calculate running balances
    const transactionsWithBalance = useMemo(() => {
        // Sort by date ascending to calculate running balance
        const sorted = [...transactions].sort((a, b) =>
            new Date(a.created_at) - new Date(b.created_at)
        );

        let runningBalance = 0;
        return sorted.map(txn => {
            // Determine Credit/Debit based on type and amount sign
            // In DB: Positive is Credit (Deposit), Negative is Debit (Withdrawal) usually
            // But 'transactions' table might store signed amounts.
            // Let's assume:
            // Savings Deposit: +Amount
            // Withdrawal: -Amount
            // Loan Disb: -Amount (Money out)
            // Loan Repay: +Amount (Money in)

            // Visualization logic:
            const amount = Number(txn.amount);
            let debit = 0;
            let credit = 0;

            if (amount > 0) {
                credit = amount;
            } else {
                debit = Math.abs(amount);
            }

            // Running Balance logic depends on what we are tracking.
            // If tracking User's Savings Balance:
            // Deposit (+): Increases Balance
            // Withdrawal (-): Decreases Balance
            // Loan Disb (-): NO EFFECT on Savings (usually, unless tracking Net Position)
            // Loan Repay (+): NO EFFECT on Savings (goes to loan acc)

            // However, this ledger seems to be a General Ledger.
            // Let's stick to the visual:
            // If type is 'savings' or 'shares' -> Affects Savings Balance.

            // Simpler approach for now: cumulative sum of signed amount?
            // api.getTransactions returns 'amount'.

            runningBalance += amount;

            return {
                ...txn,
                date: txn.created_at,
                type: (txn.type || 'unknown').charAt(0).toUpperCase() + (txn.type || 'unknown').slice(1).replace('_', ' '), // Format type
                reference: txn.reference || `TRX - ${txn.id} `,
                debit,
                credit,
                balance: runningBalance,
                notes: txn.notes
            };
        });
    }, [transactions]);

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

        return filtered.reverse(); // Most recent first for display
    }, [transactionsWithBalance, filterType, startDate, endDate]);

    // Loading State
    if (isLoading) {
        return <div className="p-10 text-center text-gray-500">Loading Ledger...</div>;
    }

    // Early return if no member
    if (!member) return null;

    const handleExportPDF = () => {
        if (!member || !transactions.length) {
            toast.warn("No data to export");
            return;
        }
        PdfService.generateMemberStatement(member, transactions, "All Time");
        toast.success("Statement Exported!");
    };

    const handleExportExcel = () => {
        if (!member || !transactions.length) {
            toast.warn("No data to export");
            return;
        }
        // Format data for Excel
        const data = transactions.map(t => ({
            Date: new Date(t.created_at).toLocaleDateString(),
            Ref: `TX-${t.id}`,
            Type: t.transaction_type,
            Description: t.description,
            Amount: t.amount || (t.savings_amount + t.loan_interest) || 0,
            Status: 'Completed'
        }));

        // Define Columns
        const columns = [
            { header: 'Date', key: 'Date' },
            { header: 'Reference', key: 'Ref' },
            { header: 'Type', key: 'Type' },
            { header: 'Description', key: 'Description' },
            { header: 'Amount (KES)', key: 'Amount' },
            { header: 'Status', key: 'Status' }
        ];

        ExcelService.exportToExcel(
            data,
            columns,
            "Member Ledger Statement",
            `Statement_${member.name.replace(/\s+/g, '_')}`,
            { "Member Name": member.name, "Member ID": member.id }
        );
        toast.success("Excel Exported!");
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

            {/* Member Summary Card */}
            <div className="bg-gradient-to-br from-safaricom-green to-safaricom-dark text-white rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                        {member.name.charAt(0)}
                    </div>
                    <div>
                        <h3 className="text-2xl font-black flex items-center gap-3">
                            {member.name}
                            {member.group_role && member.group_role !== 'Member' && (
                                <span className="text-xs bg-white/20 px-3 py-1 rounded-full border border-white/30 uppercase tracking-widest font-black">
                                    {member.group_role}
                                </span>
                            )}
                        </h3>
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
                        <p className="text-lg font-black mt-1">KES {(member.savings || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                        <p className="text-xs text-blue-100 uppercase font-bold">Active Loan</p>
                        <p className="text-lg font-black mt-1">KES {(member.activeLoans || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                        <p className="text-xs text-blue-100 uppercase font-bold">Monthly Installment</p>
                        <p className="text-lg font-black mt-1">KES 2,500</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                        <p className="text-xs text-blue-100 uppercase font-bold">Current Arrears</p>
                        <p className="text-lg font-black mt-1">
                            {member.arrears > 0 ? (
                                <span className="text-red-300">KES {(member.arrears || 0).toLocaleString()}</span>
                            ) : (
                                <span className="text-green-300">KES 0</span>
                            )}
                        </p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                        <p className="text-xs text-blue-100 uppercase font-bold">Net Position</p>
                        <p className="text-lg font-black mt-1">
                            KES {((member.savings || 0) - (member.activeLoans || 0) - (member.arrears || 0)).toLocaleString()}
                        </p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm lg:col-span-1">
                        <p className="text-xs text-blue-100 uppercase font-bold">Next of Kin</p>
                        <p className="text-sm font-bold mt-1 line-clamp-1">{member.next_of_kin_name || 'None Set'}</p>
                        <p className="text-[10px] text-blue-200">{member.next_of_kin_relationship} {member.next_of_kin_phone}</p>
                    </div>
                </div>
                {/* Social Trust Snapshot */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Next of Kin (Social Successor) */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <FaUserTag size={20} />
                                </div>
                                <h3 className="font-black text-gray-800 uppercase tracking-tight">Next of Kin</h3>
                            </div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Successor</span>
                        </div>

                        {relationships.next_of_kin ? (
                            <Link
                                to={`/members/${relationships.next_of_kin.id}/ledger`}
                                className="group flex items-center gap-4 p-3 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors border border-dashed border-gray-200"
                            >
                                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold group-hover:bg-blue-600 group-hover:text-white transition-all">
                                    {relationships.next_of_kin.name.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900 group-hover:text-blue-700">{relationships.next_of_kin.name}</p>
                                    <p className="text-xs text-gray-500">{relationships.next_of_kin.phone}</p>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${relationships.next_of_kin.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {relationships.next_of_kin.status}
                                    </span>
                                </div>
                            </Link>
                        ) : (
                            <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-center">
                                <p className="text-sm font-bold text-gray-800">{member.next_of_kin_name || 'No Internal Link'}</p>
                                <p className="text-xs text-gray-500 mt-1">{member.next_of_kin_relationship} • {member.next_of_kin_phone || 'No Phone'}</p>
                                <p className="text-[10px] text-gray-400 mt-2 italic">(External Relationship)</p>
                            </div>
                        )}
                    </div>

                    {/* Backing Network (Guarantors) */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                                    <FaHandsHelping size={20} />
                                </div>
                                <h3 className="font-black text-gray-800 uppercase tracking-tight">Backing Network</h3>
                            </div>
                            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-lg uppercase tracking-widest">
                                {relationships.guarantors.length} Active
                            </span>
                        </div>

                        <div className="space-y-3 max-h-[120px] overflow-y-auto pr-1">
                            {relationships.guarantors.length > 0 ? (
                                relationships.guarantors.map(g => (
                                    <Link
                                        key={g.id}
                                        to={`/members/${g.id}/ledger`}
                                        className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-green-50 transition-colors border border-gray-100"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-green-100 text-green-800 flex items-center justify-center text-xs font-bold">
                                                {g.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">{g.name}</p>
                                                <p className="text-[10px] text-gray-500">{g.application_number || 'Loan Security'}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black text-green-700">KES {Number(g.amount).toLocaleString()}</p>
                                            <p className="text-[9px] text-gray-400">Guaranteed</p>
                                        </div>
                                    </Link>
                                ))
                            ) : (
                                <div className="p-6 text-center text-gray-400">
                                    <FaBalanceScale className="mx-auto mb-2 opacity-20" size={32} />
                                    <p className="text-xs">No active guarantors identified</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Liability Network (Guaranteed by Item) */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                                    <FaExclamationTriangle size={20} />
                                </div>
                                <h3 className="font-black text-gray-800 uppercase tracking-tight">Liability Network</h3>
                            </div>
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-lg uppercase tracking-widest">
                                EXPOSURE
                            </span>
                        </div>

                        <div className="space-y-3 max-h-[120px] overflow-y-auto pr-1">
                            {relationships.liability_network.length > 0 ? (
                                relationships.liability_network.map(l => (
                                    <Link
                                        key={l.id}
                                        to={`/members/${l.id}/ledger`}
                                        className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-red-50 transition-colors border border-gray-100"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-red-100 text-red-800 flex items-center justify-center text-xs font-bold">
                                                {l.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">{l.name}</p>
                                                <p className="text-[10px] text-gray-500">{l.application_number}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black text-red-700">KES {Number(l.amount).toLocaleString()}</p>
                                            <p className="text-[9px] text-gray-400">Liability</p>
                                        </div>
                                    </Link>
                                ))
                            ) : (
                                <div className="p-6 text-center text-gray-400">
                                    <FaCheckCircle className="mx-auto mb-2 opacity-20" size={32} />
                                    <p className="text-xs">Zero cross-liability identified</p>
                                </div>
                            )}
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
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Actions</th>
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
                                                <span className={`px - 3 py - 1 rounded - full text - [10px] font - bold uppercase border ${getTypeColor(txn.type)} `}>
                                                    {txn.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 font-medium">{txn.reference}</td>
                                            <td className="px-6 py-4 text-right">
                                                {txn.debit > 0 ? (
                                                    <span className="text-red-600 font-bold font-mono">
                                                        KES {(txn.debit || 0).toLocaleString()}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300">–</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {txn.credit > 0 ? (
                                                    <span className="text-green-600 font-bold font-mono">
                                                        KES {(txn.credit || 0).toLocaleString()}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300">–</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-blue-900 font-black font-mono text-base">
                                                    KES {(txn.balance || 0).toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 text-xs">{txn.notes}</td>
                                            <td className="px-6 py-4 text-center">
                                                {txn.status !== 'REVERSED' ? (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedTxn(txn);
                                                            setShowReversalModal(true);
                                                        }}
                                                        className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors title='Request Reversal'"
                                                    >
                                                        <FaUndo size={14} />
                                                    </button>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-tighter">Reversed</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer Info */}
            </div>

            {/* Reversal Request Modal */}
            {showReversalModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-orange-600 p-6 text-white text-center">
                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 scale-110">
                                <FaUndo size={32} />
                            </div>
                            <h3 className="text-xl font-black uppercase tracking-tight">Request Reversal</h3>
                            <p className="text-orange-100 text-sm mt-1">Transaction Ref: {selectedTxn?.reference}</p>
                        </div>

                        <div className="p-6">
                            <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mb-6 rounded-r-lg">
                                <p className="text-xs text-blue-800 leading-relaxed italic">
                                    "Institutional reversals require administrative approval and cause a permanent ledger adjustment."
                                </p>
                            </div>

                            <div className="mb-6">
                                <label className="block text-xs font-black text-gray-500 uppercase mb-2 tracking-widest">Reason for Reversal</label>
                                <textarea
                                    value={reversalReason}
                                    onChange={(e) => setReversalReason(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-orange-500 transition-all text-sm min-h-[100px]"
                                    placeholder="Explain why this transaction needs to be corrected..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => {
                                        setShowReversalModal(false);
                                        setReversalReason('');
                                        setSelectedTxn(null);
                                    }}
                                    className="py-3 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors uppercase tracking-widest text-xs"
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRequestReversal}
                                    disabled={isSubmitting || !reversalReason.trim()}
                                    className="py-3 font-bold bg-orange-600 text-white rounded-xl shadow-lg shadow-orange-600/20 hover:bg-orange-700 transition-all uppercase tracking-widest text-xs disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Submitting...' : 'Submit Request'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MemberLedger;
