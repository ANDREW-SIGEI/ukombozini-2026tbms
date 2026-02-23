import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import {
    FaArrowLeft,
    FaPrint,
    FaFilter,
    FaCalendarAlt,
    FaCheckCircle,
    FaExclamationTriangle,
    FaFilePdf,
    FaFileExcel,
    FaUndo,
    FaFileInvoice,
    FaSync,
    FaShieldAlt,
    FaChartLine,
    FaUserFriends,
    FaTimesCircle,
    FaTimes
} from 'react-icons/fa';
import { FaUserTag, FaHandsHelping, FaBalanceScale } from 'react-icons/fa';
import { toast } from 'react-toastify';

// ─── Transaction type helpers ────────────────────────────────────────────────

const TYPE_META = {
    savings: { label: 'Savings', color: 'text-green-700 bg-green-50 border-green-200', dot: 'bg-green-500' },
    SAVINGS: { label: 'Savings', color: 'text-green-700 bg-green-50 border-green-200', dot: 'bg-green-500' },
    withdrawal: { label: 'Withdrawal', color: 'text-red-600 bg-red-50 border-red-200', dot: 'bg-red-500' },
    WITHDRAWAL: { label: 'Withdrawal', color: 'text-red-600 bg-red-50 border-red-200', dot: 'bg-red-500' },
    loan_repayment: { label: 'Loan Repayment', color: 'text-blue-700 bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
    LOAN_REPAYMENT: { label: 'Loan Repayment', color: 'text-blue-700 bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
    loan_issuance: { label: 'Loan Issued', color: 'text-purple-700 bg-purple-50 border-purple-200', dot: 'bg-purple-500' },
    LOAN_ISSUANCE: { label: 'Loan Issued', color: 'text-purple-700 bg-purple-50 border-purple-200', dot: 'bg-purple-500' },
    fine: { label: 'Fine', color: 'text-orange-700 bg-orange-50 border-orange-200', dot: 'bg-orange-500' },
    FINE: { label: 'Fine', color: 'text-orange-700 bg-orange-50 border-orange-200', dot: 'bg-orange-500' },
    welfare: { label: 'Welfare', color: 'text-teal-700 bg-teal-50 border-teal-200', dot: 'bg-teal-500' },
    WELFARE: { label: 'Welfare', color: 'text-teal-700 bg-teal-50 border-teal-200', dot: 'bg-teal-500' },
    shares: { label: 'Shares', color: 'text-indigo-700 bg-indigo-50 border-indigo-200', dot: 'bg-indigo-500' },
    SHARES: { label: 'Shares', color: 'text-indigo-700 bg-indigo-50 border-indigo-200', dot: 'bg-indigo-500' },
    interest_payment: { label: 'Interest', color: 'text-blue-600 bg-blue-50 border-blue-200', dot: 'bg-blue-400' },
    INTEREST_PAYMENT: { label: 'Interest', color: 'text-blue-600 bg-blue-50 border-blue-200', dot: 'bg-blue-400' },
    penalty_payment: { label: 'Penalty', color: 'text-orange-700 bg-orange-50 border-orange-200', dot: 'bg-orange-400' },
    PENALTY_PAYMENT: { label: 'Penalty', color: 'text-orange-700 bg-orange-50 border-orange-200', dot: 'bg-orange-400' },
};

const getTypeMeta = (type) => {
    const key = (type || '').toLowerCase();
    return TYPE_META[type] || TYPE_META[key] || {
        label: (type || 'Unknown').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        color: 'text-gray-600 bg-gray-50 border-gray-200',
        dot: 'bg-gray-400'
    };
};

const getRiskColor = (s) => s >= 80 ? 'text-green-400' : s >= 60 ? 'text-blue-400' : s >= 40 ? 'text-yellow-400' : 'text-red-400';
const getRiskBg = (s) => s >= 80 ? 'bg-green-500' : s >= 60 ? 'bg-blue-500' : s >= 40 ? 'bg-yellow-500' : 'bg-red-500';
const getRiskLabel = (s) => s >= 80 ? 'EXCELLENT' : s >= 60 ? 'GOOD' : s >= 40 ? 'FAIR' : 'RISKY';

// ─── Component ───────────────────────────────────────────────────────────────
const MemberLedger = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    // ── Filter state
    const [filterType, setFilterType] = useState('All');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // ── Data state
    const [member, setMember] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [relationships, setRelationships] = useState({ next_of_kin: null, guarantors: [], liability_network: [] });
    const [isLoading, setIsLoading] = useState(true);

    // ── Reversal modal state
    const [showReversalModal, setShowReversalModal] = useState(false);
    const [selectedTxn, setSelectedTxn] = useState(null);
    const [reversalReason, setReversalReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ── Fetch all data
    const loadData = useCallback(async () => {
        if (!id) return;
        setIsLoading(true);
        try {
            const [memberData, txData, relData] = await Promise.all([
                api.getMember(id),
                api.getTransactions(id),
                api.getMemberRelationships(id)
            ]);

            if (!memberData) {
                toast.error('Member not found');
                navigate('/members');
                return;
            }

            setMember(memberData);
            setTransactions(Array.isArray(txData) ? txData : []);
            if (relData) setRelationships(relData);
        } catch (err) {
            console.error('Ledger load error:', err);
            toast.error('Failed to load ledger data. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, [id, navigate]);

    useEffect(() => { loadData(); }, [loadData]);

    // ── Computed: running balance ledger
    const transactionsWithBalance = useMemo(() => {
        const sorted = [...transactions].sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at)
        );
        let runningBalance = 0;
        return sorted.map(txn => {
            const amount = Number(txn.amount) || 0;
            let credit = 0, debit = 0;
            if (amount >= 0) {
                credit = amount;
                runningBalance += amount;
            } else {
                debit = Math.abs(amount);
                runningBalance -= Math.abs(amount);
            }
            return {
                ...txn,
                credit,
                debit,
                balance: runningBalance,
                _typeMeta: getTypeMeta(txn.type)
            };
        });
    }, [transactions]);

    // ── Filtered + most-recent-first
    const filteredTransactions = useMemo(() => {
        let arr = transactionsWithBalance;
        if (filterType !== 'All') {
            arr = arr.filter(t =>
                (t.type || '').toUpperCase() === filterType.toUpperCase() ||
                getTypeMeta(t.type).label.toUpperCase() === filterType.toUpperCase()
            );
        }
        if (startDate) arr = arr.filter(t => new Date(t.created_at) >= new Date(startDate));
        if (endDate) arr = arr.filter(t => new Date(t.created_at) <= new Date(endDate + 'T23:59:59'));
        return [...arr].reverse();
    }, [transactionsWithBalance, filterType, startDate, endDate]);

    // ── Summary metrics
    const summaryMetrics = useMemo(() => {
        const totalCredits = transactionsWithBalance.reduce((s, t) => s + t.credit, 0);
        const totalDebits = transactionsWithBalance.reduce((s, t) => s + t.debit, 0);
        const lastBalance = transactionsWithBalance.length ? transactionsWithBalance[transactionsWithBalance.length - 1].balance : 0;
        return { totalCredits, totalDebits, lastBalance };
    }, [transactionsWithBalance]);

    // ── Transaction type options for filter dropdown
    const typeOptions = useMemo(() => {
        const seen = new Set();
        transactionsWithBalance.forEach(t => seen.add(getTypeMeta(t.type).label));
        return Array.from(seen).sort();
    }, [transactionsWithBalance]);

    // ── Action handlers
    const handleExportPDF = () => {
        if (!member) return toast.warn('No member data to export');
        api.downloadMemberStatementPDF(member.id, startDate || null, endDate || null);
        toast.success('Professional PDF Statement Requested!');
    };

    const handleExportExcel = () => {
        if (!member) return toast.warn('No member data to export');
        api.downloadMemberStatementExcel(member.id, startDate || null, endDate || null);
        toast.success('Excel Analytics Requested!');
    };

    const handlePrint = () => window.print();

    const handleDownloadReceipt = (txnId) => {
        api.downloadReceiptPDF(txnId);
        toast.success('Downloading receipt...');
    };

    const handleRequestReversal = async () => {
        if (!selectedTxn || !reversalReason.trim()) {
            toast.warn('Please provide a reason for the reversal.');
            return;
        }
        setIsSubmitting(true);
        try {
            await api.requestReversal(selectedTxn.id, reversalReason);
            toast.success('Reversal request submitted successfully.');
            setShowReversalModal(false);
            setReversalReason('');
            setSelectedTxn(null);
            // Reload data to reflect any status changes
            loadData();
        } catch (err) {
            console.error('Reversal request error:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const openReversalModal = (txn) => {
        setSelectedTxn(txn);
        setReversalReason('');
        setShowReversalModal(true);
    };

    const clearFilters = () => {
        setFilterType('All');
        setStartDate('');
        setEndDate('');
    };

    // ── Loading
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-16 h-16 border-4 border-safaricom-green/20 border-t-safaricom-green rounded-full animate-spin" />
                <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">Loading Ledger...</p>
            </div>
        );
    }

    if (!member) return null;

    const score = member.risk_score || 0;
    const savings = member.current_savings || 0;
    const loanBal = member.active_loan_balance || 0;
    const arrears = member.arrears || member.loan_arrears || 0;
    const netPos = savings - loanBal - arrears;

    return (
        <div className="space-y-6 pb-10">

            {/* ── HEADER ─────────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/members')}
                        className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors shadow-sm"
                        title="Back to Members"
                    >
                        <FaArrowLeft className="text-gray-600" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-black text-gray-800">Member Ledger</h2>
                        <p className="text-xs text-gray-400 mt-0.5 uppercase tracking-widest font-bold">
                            Full Transaction History · Financial Position · Social Trust Matrix
                        </p>
                    </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={loadData}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors font-bold text-sm"
                        title="Refresh"
                    >
                        <FaSync size={13} /> Refresh
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors font-bold text-sm"
                    >
                        <FaPrint size={13} /> Print
                    </button>
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-xl hover:bg-green-800 transition-colors shadow-sm font-bold text-sm"
                    >
                        <FaFileExcel size={13} /> Excel
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 px-4 py-2 bg-safaricom-green text-white rounded-xl hover:bg-safaricom-dark transition-colors shadow-sm font-bold text-sm"
                    >
                        <FaFilePdf size={13} /> Export PDF
                    </button>
                </div>
            </div>

            {/* ── MEMBER HERO CARD ────────────────────────────────────────── */}
            <div className="bg-gradient-to-br from-safaricom-green to-emerald-800 text-white rounded-2xl p-6 shadow-xl shadow-green-900/20 relative overflow-hidden">
                {/* decorative circles */}
                <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/5 rounded-full pointer-events-none" />
                <div className="absolute -right-4 -bottom-8 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />

                {/* Member Identity */}
                <div className="relative z-10 flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-black border-2 border-white/30">
                        {(member.name || '?').charAt(0)}
                    </div>
                    <div>
                        <h3 className="text-2xl font-black flex items-center gap-3 flex-wrap">
                            {member.name}
                            {member.group_role && member.group_role !== 'Member' && (
                                <span className="text-[10px] bg-white/20 px-3 py-1 rounded-full border border-white/30 uppercase tracking-widest font-black">
                                    {member.group_role}
                                </span>
                            )}
                        </h3>
                        <p className="text-emerald-100 text-sm">{member.phone} • {member.group_name || 'Individual'}</p>
                        <p className="text-emerald-200 text-xs mt-0.5">
                            Member Since: {member.joined_at
                                ? new Date(member.joined_at).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })
                                : 'N/A'}
                        </p>
                    </div>
                </div>

                {/* Financial Matrix */}
                <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                    {[
                        { label: 'Total Savings', value: `KES ${savings.toLocaleString()}`, sub: 'Cumulative Balance' },
                        { label: 'Active Loan Balance', value: `KES ${loanBal.toLocaleString()}`, sub: 'Outstanding Principal', danger: loanBal > 0 },
                        { label: 'Monthly Installment', value: `KES ${(member.monthly_installment || 0).toLocaleString()}`, sub: 'Repayment Obligation' },
                        { label: 'Current Arrears', value: `KES ${arrears.toLocaleString()}`, sub: 'Contribution Deficit', danger: arrears > 0 },
                        { label: 'Welfare Balance', value: `KES ${(member.welfare_balance || 0).toLocaleString()}`, sub: 'Social Protection' },
                        {
                            label: 'Social Trust Score',
                            value: `${score}%`,
                            sub: getRiskLabel(score),
                            customColor: getRiskColor(score)
                        },
                        {
                            label: 'Net Position',
                            value: `KES ${netPos.toLocaleString()}`,
                            sub: netPos >= 0 ? 'Credit Standing' : 'Deficit Position',
                            danger: netPos < 0
                        }
                    ].map((m, i) => (
                        <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                            <p className="text-[10px] text-emerald-200 uppercase font-bold tracking-wider leading-tight">{m.label}</p>
                            <p className={`text-base font-black mt-1 leading-tight ${m.customColor || (m.danger ? 'text-red-300' : 'text-white')}`}>
                                {m.value}
                            </p>
                            <p className="text-[9px] text-emerald-300 mt-0.5">{m.sub}</p>
                        </div>
                    ))}
                </div>

                {/* Risk bar */}
                <div className="relative z-10 mt-4">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider">Social Trust Score</span>
                        <span className={`text-[10px] font-black ${getRiskColor(score)}`}>{getRiskLabel(score)} — {score}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${getRiskBg(score)}`}
                            style={{ width: `${score}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* ── SOCIAL TRUST & LIABILITY MATRIX ─────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Next of Kin */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                                <FaUserTag size={18} />
                            </div>
                            <div>
                                <h3 className="font-black text-gray-800 text-sm uppercase tracking-tight">Next of Kin</h3>
                                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Legal Successor</p>
                            </div>
                        </div>
                    </div>

                    {relationships.next_of_kin ? (
                        <Link
                            to={`/members/${relationships.next_of_kin.id}/ledger`}
                            className="group flex items-center gap-3 p-3 bg-blue-50/50 rounded-xl hover:bg-blue-50 transition-colors border border-dashed border-blue-200"
                        >
                            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black group-hover:bg-blue-600 group-hover:text-white transition-all text-sm">
                                {(relationships.next_of_kin.name || '?').charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-black text-gray-900 text-sm group-hover:text-blue-700 truncate">{relationships.next_of_kin.name}</p>
                                <p className="text-[10px] text-gray-500 truncate">{relationships.next_of_kin.phone}</p>
                            </div>
                            {relationships.next_of_kin.status && (
                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${relationships.next_of_kin.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {relationships.next_of_kin.status}
                                </span>
                            )}
                        </Link>
                    ) : (
                        <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-center space-y-1">
                            <p className="text-sm font-black text-gray-700">{member.next_of_kin || member.next_of_kin_name || 'Not Registered'}</p>
                            {(member.next_of_kin_relationship || member.next_of_kin_phone) && (
                                <p className="text-xs text-gray-400">{member.next_of_kin_relationship} • {member.next_of_kin_phone}</p>
                            )}
                            <p className="text-[10px] text-gray-400 italic">(External – Not a System Member)</p>
                        </div>
                    )}
                </div>

                {/* Backing Network (Guarantors) */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-green-50 text-green-600 rounded-xl">
                                <FaHandsHelping size={18} />
                            </div>
                            <div>
                                <h3 className="font-black text-gray-800 text-sm uppercase tracking-tight">Backing Network</h3>
                                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Members Guaranteeing This Member</p>
                            </div>
                        </div>
                        <span className="text-[10px] font-black text-green-600 bg-green-50 px-2.5 py-1 rounded-lg uppercase">
                            {relationships.guarantors.length} Active
                        </span>
                    </div>

                    <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                        {relationships.guarantors.length > 0 ? (
                            relationships.guarantors.map((g, i) => (
                                <Link
                                    key={g.id || i}
                                    to={`/members/${g.id}/ledger`}
                                    className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl hover:bg-green-50 transition-colors border border-gray-100 group"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-green-100 text-green-800 flex items-center justify-center text-xs font-black">
                                            {(g.name || '?').charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-gray-900 group-hover:text-green-700">{g.name}</p>
                                            <p className="text-[10px] text-gray-400">{g.loan_id ? `Loan #${g.loan_id}` : 'Security'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-black text-green-700">KES {Number(g.amount || 0).toLocaleString()}</p>
                                        <p className="text-[9px] text-gray-400">Guaranteed</p>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div className="py-6 text-center text-gray-400">
                                <FaBalanceScale className="mx-auto mb-2 opacity-20" size={28} />
                                <p className="text-xs">No active guarantors on record</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Liability Network */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-red-50 text-red-600 rounded-xl">
                                <FaExclamationTriangle size={18} />
                            </div>
                            <div>
                                <h3 className="font-black text-gray-800 text-sm uppercase tracking-tight">Liability Network</h3>
                                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Loans This Member Is Guaranteeing</p>
                            </div>
                        </div>
                        <span className="text-[10px] font-black text-red-600 bg-red-50 px-2.5 py-1 rounded-lg uppercase">
                            EXPOSURE
                        </span>
                    </div>

                    <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                        {relationships.liability_network.length > 0 ? (
                            relationships.liability_network.map((l, i) => (
                                <Link
                                    key={l.id || i}
                                    to={`/members/${l.id}/ledger`}
                                    className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl hover:bg-red-50 transition-colors border border-gray-100 group"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-red-100 text-red-800 flex items-center justify-center text-xs font-black">
                                            {(l.name || '?').charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-gray-900 group-hover:text-red-700">{l.name}</p>
                                            <p className="text-[10px] text-gray-400">{l.loan_id ? `Loan #${l.loan_id}` : 'Active Loan'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-black text-red-700">KES {Number(l.amount || 0).toLocaleString()}</p>
                                        <p className="text-[9px] text-gray-400">Liability</p>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div className="py-6 text-center text-gray-400">
                                <FaCheckCircle className="mx-auto mb-2 opacity-20" size={28} />
                                <p className="text-xs">Zero cross-liability identified</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── LEDGER SUMMARY STRIP ────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                    <p className="text-xs font-black text-green-600 uppercase tracking-wider">Total Credits (In)</p>
                    <p className="text-xl font-black text-green-700 mt-1">KES {summaryMetrics.totalCredits.toLocaleString()}</p>
                    <p className="text-[10px] text-green-500 mt-0.5">{filteredTransactions.filter(t => t.credit > 0).length} inflow transactions</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
                    <p className="text-xs font-black text-red-600 uppercase tracking-wider">Total Debits (Out)</p>
                    <p className="text-xl font-black text-red-700 mt-1">KES {summaryMetrics.totalDebits.toLocaleString()}</p>
                    <p className="text-[10px] text-red-500 mt-0.5">{filteredTransactions.filter(t => t.debit > 0).length} outflow transactions</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
                    <p className="text-xs font-black text-blue-600 uppercase tracking-wider">Closing Balance</p>
                    <p className={`text-xl font-black mt-1 ${summaryMetrics.lastBalance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                        KES {summaryMetrics.lastBalance.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-blue-500 mt-0.5">{transactions.length} total entries</p>
                </div>
            </div>

            {/* ── FILTERS ─────────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 print:hidden">
                <div className="flex items-center gap-2 mb-4">
                    <FaFilter className="text-gray-400" size={14} />
                    <h3 className="font-black text-gray-700 text-sm uppercase tracking-wider">Filter Transactions</h3>
                    {(filterType !== 'All' || startDate || endDate) && (
                        <button
                            onClick={clearFilters}
                            className="ml-auto text-[10px] text-red-500 hover:text-red-700 font-black uppercase flex items-center gap-1"
                        >
                            <FaTimesCircle size={11} /> Clear All
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-black text-gray-500 mb-1.5 uppercase tracking-wider">Transaction Type</label>
                        <select
                            value={filterType}
                            onChange={e => setFilterType(e.target.value)}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-safaricom-green/30 text-sm font-bold bg-white"
                        >
                            <option value="All">All Transactions</option>
                            {typeOptions.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-black text-gray-500 mb-1.5 uppercase tracking-wider">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-safaricom-green/30 text-sm font-bold"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-black text-gray-500 mb-1.5 uppercase tracking-wider">End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-safaricom-green/30 text-sm font-bold"
                        />
                    </div>

                    <div className="flex items-end">
                        <button
                            onClick={clearFilters}
                            className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-black text-sm uppercase tracking-wider"
                        >
                            Clear Filters
                        </button>
                    </div>
                </div>

                {(filterType !== 'All' || startDate || endDate) && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500 font-bold">
                            Showing <span className="text-safaricom-green font-black">{filteredTransactions.length}</span> of <span className="font-black">{transactions.length}</span> transactions
                        </p>
                    </div>
                )}
            </div>

            {/* ── LEDGER TABLE ─────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                        <FaChartLine className="text-safaricom-green" size={16} />
                        Transaction Ledger
                    </h3>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {filteredTransactions.length} Entries
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-5 py-3.5 text-[10px] font-black text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                    Date
                                </th>
                                <th className="px-5 py-3.5 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                    Type
                                </th>
                                <th className="px-5 py-3.5 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                    Reference
                                </th>
                                <th className="px-5 py-3.5 text-[10px] font-black text-gray-500 uppercase tracking-wider text-right">
                                    Debit (Out)
                                </th>
                                <th className="px-5 py-3.5 text-[10px] font-black text-gray-500 uppercase tracking-wider text-right">
                                    Credit (In)
                                </th>
                                <th className="px-5 py-3.5 text-[10px] font-black text-gray-500 uppercase tracking-wider text-right">
                                    Balance
                                </th>
                                <th className="px-5 py-3.5 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                    Notes
                                </th>
                                <th className="px-5 py-3.5 text-[10px] font-black text-gray-500 uppercase tracking-wider text-center print:hidden">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="px-5 py-14 text-center">
                                        <FaChartLine className="mx-auto mb-3 text-gray-200" size={36} />
                                        <p className="text-gray-400 font-bold">No transactions match your filters.</p>
                                        {(filterType !== 'All' || startDate || endDate) && (
                                            <button onClick={clearFilters} className="mt-2 text-safaricom-green text-sm font-black hover:underline">
                                                Clear filters
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                filteredTransactions.map((txn, idx) => {
                                    const meta = txn._typeMeta || getTypeMeta(txn.type);
                                    const isReversed = txn.status === 'REVERSED' || txn.status === 'reversed';
                                    return (
                                        <tr
                                            key={txn.id || idx}
                                            className={`hover:bg-blue-50/30 transition-colors ${isReversed ? 'opacity-50' : ''}`}
                                        >
                                            {/* Date */}
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2 text-gray-700 font-semibold text-xs">
                                                    <FaCalendarAlt className="text-gray-300" size={11} />
                                                    {new Date(txn.created_at).toLocaleDateString('en-KE', {
                                                        day: '2-digit', month: 'short', year: 'numeric'
                                                    })}
                                                </div>
                                                <div className="text-[10px] text-gray-400 mt-0.5 pl-4">
                                                    {new Date(txn.created_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </td>

                                            {/* Type badge */}
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${meta.color}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                                                    {meta.label}
                                                </span>
                                                {isReversed && (
                                                    <span className="ml-1.5 text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-black">REVERSED</span>
                                                )}
                                            </td>

                                            {/* Reference */}
                                            <td className="px-5 py-4 text-gray-600 font-mono text-xs">
                                                {txn.reference || `TXN-${txn.id}`}
                                            </td>

                                            {/* Debit */}
                                            <td className="px-5 py-4 text-right">
                                                {txn.debit > 0 ? (
                                                    <span className="text-red-600 font-black font-mono text-sm">
                                                        KES {txn.debit.toLocaleString()}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-200 font-bold">–</span>
                                                )}
                                            </td>

                                            {/* Credit */}
                                            <td className="px-5 py-4 text-right">
                                                {txn.credit > 0 ? (
                                                    <span className="text-green-600 font-black font-mono text-sm">
                                                        KES {txn.credit.toLocaleString()}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-200 font-bold">–</span>
                                                )}
                                            </td>

                                            {/* Running Balance */}
                                            <td className="px-5 py-4 text-right">
                                                <span className={`font-black font-mono text-base ${txn.balance < 0 ? 'text-red-700' : 'text-gray-800'}`}>
                                                    KES {txn.balance.toLocaleString()}
                                                </span>
                                            </td>

                                            {/* Notes */}
                                            <td className="px-5 py-4 text-gray-500 text-xs max-w-[180px] truncate" title={txn.notes || ''}>
                                                {txn.notes || txn.description || '—'}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-5 py-4 text-center print:hidden">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {!isReversed && (
                                                        <>
                                                            <button
                                                                onClick={() => handleDownloadReceipt(txn.id)}
                                                                className="p-2 text-safaricom-green hover:bg-green-50 rounded-lg transition-colors border border-transparent hover:border-green-200"
                                                                title="Download Official Receipt"
                                                            >
                                                                <FaFileInvoice size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => openReversalModal(txn)}
                                                                className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors border border-transparent hover:border-orange-200"
                                                                title="Request Reversal"
                                                            >
                                                                <FaUndo size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                    {isReversed && (
                                                        <span className="text-[9px] font-black text-red-500 uppercase tracking-wider">Reversed</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>

                        {/* Totals footer */}
                        {filteredTransactions.length > 0 && (
                            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                                <tr>
                                    <td colSpan="3" className="px-5 py-3 text-xs font-black text-gray-500 uppercase tracking-wider">
                                        Period Totals ({filteredTransactions.length} transactions)
                                    </td>
                                    <td className="px-5 py-3 text-right font-black text-red-700 font-mono text-sm">
                                        KES {filteredTransactions.reduce((s, t) => s + t.debit, 0).toLocaleString()}
                                    </td>
                                    <td className="px-5 py-3 text-right font-black text-green-700 font-mono text-sm">
                                        KES {filteredTransactions.reduce((s, t) => s + t.credit, 0).toLocaleString()}
                                    </td>
                                    <td className="px-5 py-3 text-right font-black text-gray-800 font-mono text-sm">
                                        KES {(filteredTransactions[0]?.balance ?? 0).toLocaleString()}
                                    </td>
                                    <td colSpan="2" />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* ── REVERSAL MODAL ───────────────────────────────────────────── */}
            {showReversalModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-orange-600 to-orange-500 p-6 text-white relative">
                            <button
                                onClick={() => { setShowReversalModal(false); setReversalReason(''); setSelectedTxn(null); }}
                                className="absolute top-4 right-4 p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                            >
                                <FaTimes size={14} />
                            </button>
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center border-2 border-white/30">
                                    <FaUndo size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight">Request Reversal</h3>
                                    <p className="text-orange-100 text-sm mt-0.5">Ref: {selectedTxn?.reference || `TXN-${selectedTxn?.id}`}</p>
                                    {selectedTxn?.debit > 0 && (
                                        <p className="text-orange-200 text-xs">Amount: KES {selectedTxn.debit.toLocaleString()}</p>
                                    )}
                                    {selectedTxn?.credit > 0 && (
                                        <p className="text-orange-200 text-xs">Amount: KES {selectedTxn.credit.toLocaleString()}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6">
                            <div className="bg-amber-50 border-l-4 border-amber-400 p-3.5 mb-5 rounded-r-xl">
                                <div className="flex gap-2">
                                    <FaShieldAlt className="text-amber-500 mt-0.5 flex-shrink-0" size={14} />
                                    <p className="text-xs text-amber-800 leading-relaxed">
                                        Requesting a reversal initiates an institutional audit workflow. This action is logged and requires administrative approval. The transaction will be marked pending review.
                                    </p>
                                </div>
                            </div>

                            <div className="mb-5">
                                <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">
                                    Reason for Reversal <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={reversalReason}
                                    onChange={e => setReversalReason(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-orange-400 transition-all text-sm min-h-[100px] resize-none font-medium"
                                    placeholder="Describe why this transaction needs to be corrected (e.g., posted to wrong member, incorrect amount, duplicate entry)..."
                                    maxLength={500}
                                />
                                <p className="text-right text-[10px] text-gray-400 mt-1">{reversalReason.length}/500</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => { setShowReversalModal(false); setReversalReason(''); setSelectedTxn(null); }}
                                    className="py-3 font-black text-gray-500 hover:bg-gray-100 rounded-xl transition-colors uppercase tracking-wider text-xs border border-gray-200"
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRequestReversal}
                                    disabled={isSubmitting || !reversalReason.trim()}
                                    className="py-3 font-black bg-orange-600 text-white rounded-xl shadow-lg shadow-orange-500/20 hover:bg-orange-700 transition-all uppercase tracking-wider text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <FaShieldAlt size={12} />
                                            Submit Request
                                        </>
                                    )}
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
