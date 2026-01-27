import React, { useState, useEffect, useMemo } from 'react';
import {
    FaCalculator, FaMoneyBillWave, FaPercent, FaSpinner,
    FaTriangleExclamation, FaTable, FaCircleInfo, FaCalendarDays, FaCircleCheck, FaFilePdf
} from 'react-icons/fa6';
import { toast } from 'react-toastify';
import api from '../services/api';

/**
 * LOAN ADVISORY PAGE
 * -------------------
 * Provides Field Officers with tools to calculate and advise on:
 * 1. Short Term Loans (STL) - Reducing Balance (3 Month Max)
 * 2. Long Term Loans (LTL) - Standard Table Schedule
 */

const LoanAdvisory = () => {
    const [activeTab, setActiveTab] = useState('STL'); // STL or LTL

    // ==========================================
    // CORE SYSTEM DATA
    // ==========================================
    const [members, setMembers] = useState([]);
    const [selectedMemberId, setSelectedMemberId] = useState('');
    const [loanProducts, setLoanProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [guarantor1Id, setGuarantor1Id] = useState('');
    const [guarantor2Id, setGuarantor2Id] = useState('');

    const selectedMember = useMemo(() =>
        members.find(m => m.id === parseInt(selectedMemberId)),
        [members, selectedMemberId]);

    const activeProduct = useMemo(() =>
        loanProducts.find(p => p.code === activeTab),
        [loanProducts, activeTab]);

    // ==========================================
    // SHORT TERM LOAN LOGIC (Reducing Balance)
    // ==========================================
    const [stlAmount, setStlAmount] = useState(1000);
    const [stlDuration, setStlDuration] = useState(1); // 1, 2, or 3 months
    const [stlSchedule, setStlSchedule] = useState({ breakdown: [], totalPaid: 0 });

    useEffect(() => {
        calculateStlSchedule();
    }, [stlAmount, stlDuration, activeProduct]);

    const calculateStlSchedule = () => {
        const principal = parseFloat(stlAmount) || 0;
        const months = parseInt(stlDuration) || 1;
        const interestRate = (activeProduct?.interest_rate || 10) / 100;

        let schedule = [];
        let balance = principal;
        let totalPaid = 0;

        const principalPerMonth = principal / months;

        for (let i = 1; i <= months; i++) {
            const interest = balance * interestRate;
            const payment = Math.ceil(principalPerMonth + interest);

            schedule.push({
                month: i,
                balanceStart: balance,
                interest: Math.ceil(interest),
                principal: Math.ceil(principalPerMonth),
                totalPayment: payment
            });

            balance -= principalPerMonth;
            totalPaid += payment;
        }

        setStlSchedule({ breakdown: schedule, totalPaid });
    };

    // ==========================================
    // LONG TERM LOAN DATA (Lookup Table)
    // ==========================================
    const [ltlSelection, setLtlSelection] = useState(null);

    const ltlTableData = [
        { amount: 5000, installment: 500, principal: 345, interest: 55, shares: 100, period: "15 Months" },
        { amount: 10000, installment: 700, principal: 500, interest: 100, shares: 100, period: "20 Months" },
        { amount: 15000, installment: 900, principal: 625, interest: 135, shares: 140, period: "24 Months" },
        { amount: 20000, installment: 1200, principal: 835, interest: 180, shares: 185, period: "24 Months" },
        { amount: 30000, installment: 1850, principal: 1200, interest: 300, shares: 300, period: "24 Months" },
        { amount: 50000, installment: 2500, principal: 2000, interest: 250, shares: 250, period: "25 Months" },
        { amount: 60000, installment: 3200, principal: 2500, interest: 350, shares: 350, period: "24 Months" },
        { amount: 70000, installment: 3700, principal: 2800, interest: 450, shares: 450, period: "25 Months" },
        { amount: 100000, installment: 5000, principal: 4000, interest: 500, shares: 500, period: "25 Months" },
        { amount: 150000, installment: 7500, principal: 6000, interest: 1500, shares: 1500, period: "25 Months" },
        { amount: 180000, installment: 9000, principal: 7500, interest: 900, shares: 900, period: "24 Months" },
        { amount: 200000, installment: 10000, principal: 8000, interest: 1000, shares: 1000, period: "25 Months" },
        { amount: 250000, installment: 12500, principal: 10000, interest: 1250, shares: 1250, period: "25 Months" },
        { amount: 300000, installment: 15000, principal: 12000, interest: 1500, shares: 1500, period: "25 Months" },
        { amount: 350000, installment: 17500, principal: 16000, interest: 1750, shares: 1750, period: "25 Months" },
        { amount: 400000, installment: 20000, principal: 16000, interest: 2000, shares: 2000, period: "25 Months" },
        { amount: 500000, installment: 25000, principal: 20000, interest: 2500, shares: 2500, period: "25 Months" },
        { amount: 600000, installment: 30000, principal: 24000, interest: 3000, shares: 3000, period: "25 Months" },
        { amount: 700000, installment: 35000, principal: 28000, interest: 3500, shares: 3500, period: "25 Months" },
        { amount: 800000, installment: 40000, principal: 32000, interest: 4000, shares: 4000, period: "25 Months" },
        { amount: 900000, installment: 45000, principal: 36000, interest: 4500, shares: 4500, period: "25 Months" },
        { amount: 1000000, installment: 50000, principal: 40000, interest: 5000, shares: 5000, period: "25 Months" },
    ];

    // ==========================================
    // DATA LOADING
    // ==========================================
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        initPage();
    }, []);

    const initPage = async () => {
        setLoading(true);
        try {
            const [membersData, productsData] = await Promise.all([
                api.getMembers(),
                api.getLoanProducts()
            ]);
            setMembers(membersData || []);
            setLoanProducts(productsData || []);
        } catch (error) {
            console.error("Initialization failed", error);
            toast.error("Failed to load system data");
        } finally {
            setLoading(false);
        }
    };

    const handleApply = async () => {
        if (!selectedMemberId) {
            toast.warn("Please select a member first.");
            return;
        }

        if (activeTab === 'LTL' && (!guarantor1Id || !guarantor2Id)) {
            toast.warn("Long Term Loans require at least 2 guarantors.");
            return;
        }

        if (activeTab === 'STL' && !coverage?.isCovered && !guarantor1Id) {
            toast.warn("This loan is not fully covered by savings. Please select a guarantor.");
            return;
        }

        setIsSubmitting(true);
        try {
            const loanData = activeTab === 'STL' ? {
                memberId: parseInt(selectedMemberId),
                groupId: selectedMember?.group_id || 1,
                loanType: 'STL',
                amount: parseFloat(stlAmount),
                interestRate: activeProduct?.interest_rate || 10,
                duration: parseInt(stlDuration),
                officerId: 1,
                guarantor1_id: guarantor1Id ? parseInt(guarantor1Id) : null,
                guarantor2_id: guarantor2Id ? parseInt(guarantor2Id) : null
            } : {
                memberId: parseInt(selectedMemberId),
                groupId: selectedMember?.group_id || 1,
                loanType: 'LTL',
                amount: ltlSelection.amount,
                interestRate: activeProduct?.interest_rate || 15,
                duration: parseInt(ltlSelection.period.split(' ')[0]),
                officerId: 1,
                guarantor1_id: guarantor1Id ? parseInt(guarantor1Id) : null,
                guarantor2_id: guarantor2Id ? parseInt(guarantor2Id) : null
            };

            await api.issueLoan(loanData);
            toast.success("✅ Loan Application Submitted!");
            setTimeout(() => window.location.href = '/loans', 1500);
        } catch (error) {
            console.error(error);
            toast.error("Failed to submit application");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ==========================================
    // ADVISORY LOGIC
    // ==========================================
    const coverage = useMemo(() => {
        if (!selectedMember) return null;
        const loanTotal = activeTab === 'STL' ? stlAmount : (ltlSelection?.amount || 0);
        const savings = selectedMember.savings || 0;

        return {
            isCovered: savings >= loanTotal,
            ratio: loanTotal > 0 ? (savings / loanTotal) * 100 : 0,
            gap: Math.max(0, loanTotal - savings)
        };
    }, [selectedMember, activeTab, stlAmount, ltlSelection]);

    const handlePrint = () => {
        toast.info("Generating Repayment Advisory PDF...");
        // PDF logic integration point
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                        <FaCalculator className="text-safaricom-green" /> Loan Advisory Panel
                    </h2>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                        Member Advisory & Repayment Simulator
                    </p>
                </div>
                <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all shadow-sm"
                >
                    <FaFilePdf className="text-red-500" /> Export PDF
                </button>
            </div>

            {/* Tab Switcher */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex p-1 bg-gray-100 rounded-lg w-full md:w-auto">
                    <button
                        onClick={() => setActiveTab('STL')}
                        className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'STL'
                            ? 'bg-white text-safaricom-green shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Short Term (STL)
                    </button>
                    <button
                        onClick={() => setActiveTab('LTL')}
                        className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'LTL'
                            ? 'bg-white text-safaricom-green shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Long Term (LTL)
                    </button>
                </div>

                {/* Member Selector */}
                <div className="w-full md:w-auto flex items-center gap-2">
                    <select
                        value={selectedMemberId}
                        onChange={(e) => setSelectedMemberId(e.target.value)}
                        className="w-full md:w-64 bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-safaricom-green focus:border-safaricom-green block p-2.5 font-bold"
                    >
                        <option value="">-- Select Member to Apply --</option>
                        {members.map(m => (
                            <option key={m.id} value={m.id}>{m.name} ({m.groupName})</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* LEFT: INPUTS */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <FaPercent className="text-blue-500" />
                        {activeTab === 'STL' ? 'STL Configuration' : 'LTL Lookup'}
                    </h3>

                    {activeTab === 'STL' ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Loan Amount (KES)</label>
                                <input
                                    type="number"
                                    value={stlAmount}
                                    onChange={(e) => setStlAmount(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-safaricom-green font-bold text-xl"
                                    step="1000"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Duration</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[1, 2, 3].map(m => (
                                        <button
                                            key={m}
                                            onClick={() => setStlDuration(m)}
                                            className={`py-3 rounded-xl font-bold border-2 transition-all ${stlDuration === m
                                                ? 'border-safaricom-green bg-green-50 text-safaricom-green'
                                                : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'
                                                }`}
                                        >
                                            {m} Month{m > 1 ? 's' : ''}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Dynamic Guarantor Policy Advice */}
                            <div className={`p-4 rounded-xl border transition-all ${coverage?.isCovered ? 'bg-green-50 border-green-100' : 'bg-orange-50 border-orange-100'}`}>
                                <h4 className={`font-bold text-sm mb-2 flex items-center gap-2 ${coverage?.isCovered ? 'text-green-800' : 'text-orange-800'}`}>
                                    {coverage?.isCovered ? <FaCircleCheck /> : <FaTriangleExclamation />}
                                    Guarantor Policy Advice
                                </h4>
                                <p className={`text-xs leading-relaxed ${coverage?.isCovered ? 'text-green-700' : 'text-orange-700'}`}>
                                    {coverage ? (
                                        coverage.isCovered
                                            ? "Member's savings fully cover this loan. No Guarantors required."
                                            : `Loan exceeds savings by KES ${coverage.gap?.toLocaleString() || '0'}. Require 1 or 2 Guarantors.`
                                    ) : "Select a member to view guarantor requirements."}
                                </p>
                            </div>

                            {/* Guarantor Selectors (STL) */}
                            {!coverage?.isCovered && (
                                <div className="space-y-3 pt-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase">Select Guarantors</label>
                                    <select
                                        value={guarantor1Id}
                                        onChange={(e) => setGuarantor1Id(e.target.value)}
                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold"
                                    >
                                        <option value="">-- Select Guarantor 1 --</option>
                                        {members.filter(m => m.id !== parseInt(selectedMemberId)).map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                    {coverage?.gap > 5000 && (
                                        <select
                                            value={guarantor2Id}
                                            onChange={(e) => setGuarantor2Id(e.target.value)}
                                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold"
                                        >
                                            <option value="">-- Select Guarantor 2 --</option>
                                            {members.filter(m => m.id !== parseInt(selectedMemberId) && m.id !== parseInt(guarantor1Id)).map(m => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Select Loan Amount Category</label>
                                <select
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        const match = ltlTableData.find(d => d.amount === val);
                                        setLtlSelection(match);
                                    }}
                                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-safaricom-green font-bold text-gray-700"
                                >
                                    <option value="">-- Choose Amount --</option>
                                    {ltlTableData.map(r => (
                                        <option key={r.amount} value={r.amount}>KES {r.amount?.toLocaleString() || '0'}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Dynamic Guarantor Policy Advice */}
                            <div className={`p-4 rounded-xl border transition-all ${coverage?.isCovered ? 'bg-green-50 border-green-100' : 'bg-purple-50 border-purple-100'}`}>
                                <h4 className={`font-bold text-sm mb-2 flex items-center gap-2 ${coverage?.isCovered ? 'text-green-800' : 'text-purple-800'}`}>
                                    <FaTriangleExclamation /> Guarantor Policy
                                </h4>
                                <p className={`text-xs leading-relaxed ${coverage?.isCovered ? 'text-green-700' : 'text-purple-700'}`}>
                                    {coverage ? (
                                        coverage.isCovered
                                            ? "Fully covered by savings. 1 reference guarantor still recommended for LTL."
                                            : "Long Term Loans require At least 3 Guarantors (More than 2). Ensure all forms are fully signed."
                                    ) : "Choose an amount to view requirements."}
                                </p>
                            </div>

                            {/* Guarantor Selectors (LTL) */}
                            <div className="space-y-3 pt-2">
                                <label className="block text-[10px] font-black text-gray-400 uppercase">Assign Guarantors (REQ: 2-3)</label>
                                <select
                                    value={guarantor1Id}
                                    onChange={(e) => setGuarantor1Id(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold"
                                >
                                    <option value="">-- Select Guarantor 1 --</option>
                                    {members.filter(m => m.id !== parseInt(selectedMemberId)).map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                                <select
                                    value={guarantor2Id}
                                    onChange={(e) => setGuarantor2Id(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold"
                                >
                                    <option value="">-- Select Guarantor 2 --</option>
                                    {members.filter(m => m.id !== parseInt(selectedMemberId) && m.id !== parseInt(guarantor1Id)).map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT: OUTPUT / SCHEDULE */}
                <div className="lg:col-span-2 space-y-6">
                    {/* SUMMARY CARD */}
                    <div className="bg-gray-800 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
                        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                            <div>
                                <p className="text-gray-400 text-xs font-bold uppercase mb-1">Total Repayment Amount</p>
                                <h2 className="text-4xl font-black text-white">
                                    KES {activeTab === 'STL'
                                        ? stlSchedule.totalPaid?.toLocaleString() || '0'
                                        : (ltlSelection ? (ltlSelection.installment * parseInt(ltlSelection.period)).toLocaleString() || '---' : '---')
                                    }
                                </h2>
                                <p className="text-gray-400 text-xs mt-2">
                                    {activeTab === 'STL'
                                        ? `Includes principal + ${activeProduct?.interest_rate || 10}% reducing interest`
                                        : ltlSelection ? `Standard LTL Rate • ${ltlSelection.period}` : 'Select an amount to view details'
                                    }
                                </p>
                            </div>
                            <div className="hidden md:block h-16 w-px bg-gray-600"></div>
                            <div className="text-center md:text-right">
                                <p className="text-gray-400 text-xs font-bold uppercase mb-1">Monthly Installment</p>
                                <div className="text-2xl font-bold text-green-400">
                                    {activeTab === 'STL'
                                        ? 'Variable (Reducing)'
                                        : ltlSelection ? `KES ${ltlSelection.installment?.toLocaleString() || '0'}` : '---'
                                    }
                                </div>
                                {activeTab === 'STL' && (
                                    <p className="text-[10px] text-green-300">See schedule below</p>
                                )}
                            </div>
                        </div>

                        {/* ACTION BUTTON */}
                        <div className="relative z-10 mt-6 pt-6 border-t border-gray-700 flex justify-end">
                            <button
                                onClick={handleApply}
                                disabled={isSubmitting || (activeTab === 'LTL' && !ltlSelection)}
                                className={`px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${isSubmitting || (activeTab === 'LTL' && !ltlSelection)
                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                    : 'bg-safaricom-green hover:bg-green-600 text-white shadow-lg hover:shadow-green-500/30'
                                    }`}
                            >
                                {isSubmitting ? <FaSpinner className="animate-spin" /> : <FaCircleCheck />}
                                {isSubmitting ? 'Processing...' : 'Apply for this Loan'}
                            </button>
                        </div>

                        {/* Decor */}
                        <div className="absolute right-0 top-0 w-64 h-64 bg-safaricom-green/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                    </div>

                    {/* DETAILED SCHEDULE */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <FaTable className="text-gray-400" /> Repayment Schedule
                            </h3>
                            <span className="text-xs font-bold text-gray-400 uppercase">
                                {activeTab === 'STL' ? 'Reducing Balance Method' : 'Standard Rate Method'}
                            </span>
                        </div>

                        {activeTab === 'STL' ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-black">
                                        <tr>
                                            <th className="px-6 py-3">Month</th>
                                            <th className="px-6 py-3 text-right">Balance B/F</th>
                                            <th className="px-6 py-3 text-right">Principal</th>
                                            <th className="px-6 py-3 text-right">Interest ({activeProduct?.interest_rate || 10}%)</th>
                                            <th className="px-6 py-3 text-right text-safaricom-green">Total Due</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-sm font-bold text-gray-700">
                                        {stlSchedule.breakdown?.map((row) => (
                                            <tr key={row.month} className="hover:bg-green-50/30 transition-colors group">
                                                <td className="px-6 py-4">Month {row.month}</td>
                                                <td className="px-6 py-4 text-right text-gray-400">{row.balanceStart?.toLocaleString() || '0'}</td>
                                                <td className="px-6 py-4 text-right group-hover:text-safaricom-green transition-colors">{row.principal?.toLocaleString() || '0'}</td>
                                                <td className="px-6 py-4 text-right text-orange-600">{row.interest?.toLocaleString() || '0'}</td>
                                                <td className="px-6 py-4 text-right text-lg text-safaricom-green">{row.totalPayment?.toLocaleString() || '0'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-8">
                                {ltlSelection ? (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
                                            <div className="text-xs text-gray-500 font-bold uppercase mb-1">Total Months</div>
                                            <div className="text-xl font-black text-gray-800">{ltlSelection.period}</div>
                                        </div>
                                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
                                            <div className="text-xs text-gray-500 font-bold uppercase mb-1">Shares Required</div>
                                            <div className="text-xl font-black text-gray-800">{ltlSelection.shares?.toLocaleString() || '0'}</div>
                                        </div>
                                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
                                            <div className="text-xs text-gray-500 font-bold uppercase mb-1">Principal Part</div>
                                            <div className="text-xl font-black text-blue-600">{ltlSelection.principal?.toLocaleString() || '0'}</div>
                                        </div>
                                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
                                            <div className="text-xs text-gray-500 font-bold uppercase mb-1">Interest Part</div>
                                            <div className="text-xl font-black text-orange-600">{ltlSelection.interest?.toLocaleString() || '0'}</div>
                                        </div>

                                        <div className="col-span-2 md:col-span-4 mt-4 p-4 bg-blue-50 text-blue-800 rounded-xl text-center text-sm">
                                            Field Officer Advisory: Inform the member that they must pay <strong>KES {ltlSelection.installment?.toLocaleString() || '0'}</strong> every month for <strong>{ltlSelection.period}</strong>.
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-10 text-gray-400">
                                        <FaCircleInfo className="mx-auto text-4xl mb-3 opacity-20" />
                                        <p>Select a Loan Amount from the left panel to view the LTL structure.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default LoanAdvisory;
