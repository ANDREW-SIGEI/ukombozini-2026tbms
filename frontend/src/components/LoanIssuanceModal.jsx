import React, { useState, useEffect } from 'react';
import { FaTimes, FaHandHoldingUsd, FaCalculator, FaCalendarAlt, FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaShieldAlt, FaBan, FaLock, FaMoneyBillWave, FaChartLine } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { checkLoanEligibility, calculateMaxLoan } from '../utils/loanRules';
import { checkLoanApprovalBlock } from '../utils/cashReportEnforcement';
import { useAuth } from '../context/AuthContext';

// 🔐 LOAN TYPE RULES ENGINE
const LOAN_TYPE_RULES = {
    'Long-Term Loan (LTL)': {
        minAmount: 5000,
        maxMultiplier: 3,
        minDuration: 6,
        maxDuration: 24,
        interestRate: 2,
        requiresGuarantors: true,
        requiresApproval: true,
        description: 'Standard long-term financing - Requires approval & guarantors',
        icon: '📅',
        color: 'blue'
    },
    'Short-Term Loan (STL)': {
        minAmount: 1000,
        maxMultiplier: 2,
        minDuration: 1,
        maxDuration: 6,
        interestRate: 3,
        requiresGuarantors: false,
        requiresApproval: false,
        description: 'Quick emergency financing - Auto-approved for eligible members',
        icon: '⚡',
        color: 'purple'
    },
    'Emergency Loan': {
        minAmount: 500,
        maxMultiplier: 1,
        minDuration: 1,
        maxDuration: 3,
        interestRate: 5,
        requiresGuarantors: false,
        requiresApproval: true,
        description: 'Urgent needs only - Director approval required',
        icon: '🚨',
        color: 'red'
    }
};

const LoanIssuanceModal = ({ isOpen, onClose, member, onSuccess, activeMeeting }) => {
    const { user } = useAuth();
    const [loanType, setLoanType] = useState('Long-Term Loan (LTL)');
    const [loanAmount, setLoanAmount] = useState('');
    const [duration, setDuration] = useState('6');
    const [purpose, setPurpose] = useState('');
    const [guarantor1, setGuarantor1] = useState('');
    const [guarantor2, setGuarantor2] = useState('');
    const [repaymentPreview, setRepaymentPreview] = useState(null);
    const [showConfirmation, setShowConfirmation] = useState(false);

    // Meeting status check
    const hasMeeting = activeMeeting && activeMeeting.status === 'OPEN';
    const meetingDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    // Mock system rules and active loans for demo
    const systemRules = { loanMultiplier: 3, maxInterestRate: 5 };
    const activeLoans = []; // Mock empty for demo

    // Get current loan type rules
    const currentRule = LOAN_TYPE_RULES[loanType];
    const interestRate = currentRule.interestRate;

    // Calculate max loan based on type
    const baseMaxLoan = member ? calculateMaxLoan(member.savings, systemRules.loanMultiplier) : 0;
    const maxLoan = Math.min(baseMaxLoan, baseMaxLoan * (currentRule.maxMultiplier / systemRules.loanMultiplier));

    // Auto-calculate repayment
    useEffect(() => {
        if (loanAmount && duration) {
            const principal = parseFloat(loanAmount);
            const months = parseInt(duration);
            const rate = interestRate / 100;

            const totalInterest = principal * rate * months;
            const totalRepayable = principal + totalInterest;
            const monthlyRepayment = totalRepayable / months;

            setRepaymentPreview({
                principal,
                totalInterest,
                totalRepayable,
                monthlyRepayment,
                firstPaymentDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                finalPaymentDate: new Date(new Date().setMonth(new Date().getMonth() + months)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            });
        } else {
            setRepaymentPreview(null);
        }
    }, [loanAmount, duration, interestRate]);

    // Auto-set duration when loan type changes
    useEffect(() => {
        if (loanType) {
            const rule = LOAN_TYPE_RULES[loanType];
            setDuration(rule.minDuration.toString());
        }
    }, [loanType]);

    if (!isOpen || !member) return null;

    const handleProceedToConfirm = (e) => {
        e.preventDefault();

        // Validation
        if (!hasMeeting) {
            toast.error("🔒 Cannot issue loan - No active meeting!");
            return;
        }

        const numAmount = parseFloat(loanAmount);
        if (isNaN(numAmount) || numAmount <= 0) {
            toast.error("⚠️ Loan amount must be greater than zero");
            return;
        }

        if (numAmount < currentRule.minAmount) {
            toast.error(`⚠️ Minimum loan amount for ${loanType} is KES ${currentRule.minAmount.toLocaleString()}`);
            return;
        }

        if (numAmount > maxLoan) {
            toast.error(`⚠️ Loan amount exceeds limit! Max possible: KES ${maxLoan.toLocaleString()}`);
            return;
        }

        if (!purpose || purpose.trim().length < 10) {
            toast.error("⚠️ Please provide a detailed purpose (minimum 10 characters)");
            return;
        }

        if (currentRule.requiresGuarantors && (!guarantor1 || !guarantor2)) {
            toast.error("⚠️ This loan type requires two guarantors");
            return;
        }

        // Check loan eligibility
        const eligibility = checkLoanEligibility(member, numAmount, activeLoans, systemRules);
        if (!eligibility.eligible) {
            toast.error(eligibility.reason);
            return;
        }

        // Show confirmation
        setShowConfirmation(true);
    };

    const handleFinalSubmit = () => {
        const loanData = {
            id: `L-NEW-${Math.floor(1000 + Math.random() * 9000)}`,
            memberName: member.name,
            memberId: member.id,
            loanType: loanType,
            amount: parseFloat(loanAmount),
            interest: repaymentPreview?.totalInterest,
            totalRepayable: repaymentPreview?.totalRepayable,
            monthlyRepayment: repaymentPreview?.monthlyRepayment,
            duration: parseInt(duration),
            interestRate: interestRate,
            purpose: purpose,
            guarantor1: guarantor1,
            guarantor2: guarantor2,
            meetingReference: activeMeeting.session_number,
            officerId: user?.id || 1,
            approvalStatus: currentRule.requiresApproval ? 'Pending' : 'Auto-Approved',
            dueDate: repaymentPreview?.finalPaymentDate,
            status: 'Active',
            loanRule: currentRule
        };

        toast.success(`✅ Loan of KES ${parseFloat(loanAmount).toLocaleString()} ${currentRule.requiresApproval ? 'submitted for approval' : 'issued'} to ${member.name}!`);
        onSuccess(loanData);
        setShowConfirmation(false);
        onClose();
    };

    // Confirmation Dialog
    if (showConfirmation) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-white/20 rounded-2xl">
                                <FaExclamationTriangle size={24} />
                            </div>
                            <h3 className="text-xl font-black">Confirm Loan Issuance</h3>
                        </div>
                    </div>

                    <div className="p-8 space-y-6">
                        <div className="bg-gray-50 p-6 rounded-2xl space-y-3">
                            <ConfirmRow label="Member" value={member.name} />
                            <ConfirmRow label="Loan Type" value={loanType} />
                            <ConfirmRow label="Meeting" value={`#${activeMeeting.session_number}`} />
                            <ConfirmRow label="Duration" value={`${duration} months`} />
                            <ConfirmRow label="Interest" value={`${interestRate}% p.m.`} />
                            <div className="h-px bg-gray-200 my-3"></div>
                            <ConfirmRow
                                label="Principal"
                                value={`KES ${parseFloat(loanAmount).toLocaleString()}`}
                                highlight={true}
                            />
                            <ConfirmRow
                                label="Total Repayable"
                                value={`KES ${repaymentPreview?.totalRepayable.toLocaleString()}`}
                            />
                        </div>

                        {currentRule.requiresApproval && (
                            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r-lg">
                                <p className="text-xs text-yellow-800 font-bold flex items-center gap-2">
                                    <FaInfoCircle /> This loan requires director approval before disbursement
                                </p>
                            </div>
                        )}

                        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                            <p className="text-xs text-blue-800 font-bold">
                                ⚠️ This action cannot be undone. Loan will be recorded in member ledger and linked to Meeting #{activeMeeting.session_number}.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirmation(false)}
                                className="flex-1 py-4 border-2 border-gray-200 text-gray-700 rounded-2xl font-black hover:bg-gray-50 transition-all"
                            >
                                ← Cancel
                            </button>
                            <button
                                onClick={handleFinalSubmit}
                                className="flex-1 py-4 bg-gradient-to-r from-safaricom-green to-green-600 text-white rounded-2xl font-black hover:shadow-lg transition-all"
                            >
                                ✅ Confirm & Issue
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Main Modal
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
            <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden my-8">
                {/* 🟢 MEETING CONTEXT BANNER */}
                {hasMeeting ? (
                    <div className="bg-gradient-to-r from-green-600 to-green-700 p-4 text-white">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-xl">
                                    <FaCalendarAlt />
                                </div>
                                <div>
                                    <div className="font-black text-sm">🟢 Active Meeting</div>
                                    <div className="text-[10px] opacity-90">
                                        Meeting #{activeMeeting.session_number} • {meetingDate} • Status: OPEN
                                    </div>
                                </div>
                            </div>
                            <div className="text-xs font-black bg-white/20 px-3 py-1 rounded-full">
                                LOAN ISSUANCE ENABLED
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-gradient-to-r from-red-600 to-red-700 p-4 text-white">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-xl">
                                <FaBan />
                            </div>
                            <div>
                                <div className="font-black text-sm">🔴 No Active Meeting</div>
                                <div className="text-[10px] opacity-90">
                                    Loan issuance disabled - Please create or open a meeting first
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="bg-safaricom-green p-6 text-white">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-2xl font-black flex items-center gap-3">
                                <div className="p-3 bg-white/20 rounded-2xl">
                                    <FaHandHoldingUsd />
                                </div>
                                Issue New Loan
                            </h3>
                            <p className="text-xs text-white/80 mt-1">
                                UKOMBOZI Institutional Standard - Bank-Grade Loan Issuance
                            </p>
                        </div>
                        <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl transition-all">
                            <FaTimes size={20} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleProceedToConfirm} className="p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* LEFT: Member & Loan Details */}
                        <div className="space-y-6">
                            {/* Member Financial Summary */}
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-2xl border-2 border-blue-200">
                                <div className="flex items-center gap-2 mb-3">
                                    <FaInfoCircle className="text-blue-600" />
                                    <h4 className="text-xs font-black text-blue-900 uppercase">Member Loan Capacity</h4>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <SummaryItem label="Current Savings" value={`KES ${member.savings.toLocaleString()}`} />
                                    <SummaryItem label="Max Loan (3x)" value={`KES ${baseMaxLoan.toLocaleString()}`} />
                                    <SummaryItem label="Active Loans" value={`KES ${member.activeLoans.toLocaleString()}`} />
                                    <SummaryItem
                                        label="Arrears"
                                        value={member.arrears > 0 ? `KES ${member.arrears.toLocaleString()}` : 'None'}
                                        alert={member.arrears > 0}
                                    />
                                </div>
                            </div>

                            {/* Loan Type Selection */}
                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-3">
                                    Loan Type *
                                    <span className="ml-2 text-[10px] font-normal text-gray-400">(Rules enforced automatically)</span>
                                </label>
                                <div className="space-y-2">
                                    {Object.entries(LOAN_TYPE_RULES).map(([typeName, rule]) => (
                                        <button
                                            key={typeName}
                                            type="button"
                                            disabled={!hasMeeting}
                                            onClick={() => setLoanType(typeName)}
                                            className={`w-full p-4 rounded-xl text-left transition-all border-2 disabled:opacity-40 disabled:cursor-not-allowed ${loanType === typeName
                                                    ? 'bg-safaricom-green/10 border-safaricom-green shadow-md'
                                                    : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">{rule.icon}</span>
                                                <div className="flex-1">
                                                    <div className={`text-sm font-black ${loanType === typeName ? 'text-safaricom-green' : 'text-gray-700'}`}>
                                                        {typeName}
                                                    </div>
                                                    <div className="text-[10px] text-gray-500 mt-0.5">
                                                        {rule.interestRate}% p.m. • {rule.minDuration}-{rule.maxDuration} months • {rule.requiresApproval ? 'Approval Required' : 'Auto-Approved'}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                {/* Rule Description */}
                                <div className="mt-3 bg-purple-50 border-l-4 border-purple-500 p-3 rounded-r-xl">
                                    <div className="flex items-start gap-2">
                                        <FaShieldAlt className="text-purple-600 mt-0.5" size={14} />
                                        <div>
                                            <p className="text-xs font-bold text-purple-900">{currentRule.description}</p>
                                            <div className="flex gap-3 mt-2 text-[10px]">
                                                <span className={currentRule.requiresGuarantors ? 'text-yellow-700 font-bold' : 'text-green-700 font-bold'}>
                                                    {currentRule.requiresGuarantors ? '⚠️' : '✅'} {currentRule.requiresGuarantors ? 'Guarantors Required' : 'No Guarantors Needed'}
                                                </span>
                                                <span className={currentRule.requiresApproval ? 'text-red-700 font-bold' : 'text-green-700 font-bold'}>
                                                    {currentRule.requiresApproval ? '🔒' : '⚡'} {currentRule.requiresApproval ? 'Requires Approval' : 'Auto-Approved'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Loan Amount & Duration */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase mb-2">
                                        Loan Amount (KES) *
                                    </label>
                                    <input
                                        required
                                        type="number"
                                        min={currentRule.minAmount}
                                        max={maxLoan}
                                        disabled={!hasMeeting}
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                        placeholder="0"
                                        value={loanAmount}
                                        onChange={(e) => setLoanAmount(e.target.value)}
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1">
                                        Min: KES {currentRule.minAmount.toLocaleString()} | Max: KES {maxLoan.toLocaleString()}
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase mb-2">
                                        Duration (Months) *
                                    </label>
                                    <select
                                        value={duration}
                                        disabled={!hasMeeting}
                                        onChange={(e) => setDuration(e.target.value)}
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-safaricom-green/20 outline-none font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {Array.from({ length: currentRule.maxDuration - currentRule.minDuration + 1 }, (_, i) => currentRule.minDuration + i).map(m => (
                                            <option key={m} value={m}>{m} Month{m > 1 ? 's' : ''}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Purpose */}
                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase mb-2">
                                    Loan Purpose * (Minimum 10 characters)
                                </label>
                                <textarea
                                    required
                                    minLength={10}
                                    rows={3}
                                    disabled={!hasMeeting}
                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-safaricom-green/20 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                    placeholder="Enter detailed purpose for this loan..."
                                    value={purpose}
                                    onChange={(e) => setPurpose(e.target.value)}
                                />
                            </div>

                            {/* Guarantors (conditional) */}
                            {currentRule.requiresGuarantors && (
                                <div className="space-y-3">
                                    <label className="block text-xs font-black text-gray-500 uppercase">
                                        Guarantors (Required for {loanType}) *
                                    </label>
                                    <input
                                        required={currentRule.requiresGuarantors}
                                        type="text"
                                        disabled={!hasMeeting}
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-safaricom-green/20 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                        placeholder="Guarantor 1 Name"
                                        value={guarantor1}
                                        onChange={(e) => setGuarantor1(e.target.value)}
                                    />
                                    <input
                                        required={currentRule.requiresGuarantors}
                                        type="text"
                                        disabled={!hasMeeting}
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-safaricom-green/20 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                        placeholder="Guarantor 2 Name"
                                        value={guarantor2}
                                        onChange={(e) => setGuarantor2(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>

                        {/* RIGHT: Repayment Preview & System Impact */}
                        <div className="space-y-6">
                            {/* Repayment Calculator */}
                            <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-2xl border-2 border-gray-200">
                                <h4 className="text-sm font-black text-gray-900 flex items-center gap-2 mb-4">
                                    <FaCalculator className="text-safaricom-green" />
                                    Repayment Calculator
                                </h4>

                                {repaymentPreview ? (
                                    <div className="space-y-4">
                                        <div className="bg-white p-5 rounded-xl border-2 border-safaricom-green/20">
                                            <div className="text-xs text-gray-500 uppercase font-bold mb-2">Monthly Payment</div>
                                            <div className="text-4xl font-black text-safaricom-dark">
                                                KES {repaymentPreview.monthlyRepayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </div>
                                        </div>

                                        <div className="bg-white p-4 rounded-xl space-y-2">
                                            <RepaymentRow label="Principal" value={`KES ${repaymentPreview.principal.toLocaleString()}`} />
                                            <RepaymentRow label={`Interest (${interestRate}% p.m.)`} value={`KES ${repaymentPreview.totalInterest.toLocaleString()}`} />
                                            <div className="h-px bg-gray-200 my-2"></div>
                                            <RepaymentRow label="Total Repayable" value={`KES ${repaymentPreview.totalRepayable.toLocaleString()}`} bold={true} />
                                        </div>

                                        <div className="text-xs text-gray-600">
                                            <div className="flex justify-between mb-1">
                                                <span>First Payment:</span>
                                                <span className="font-bold">{repaymentPreview.firstPaymentDate}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Final Payment:</span>
                                                <span className="font-bold">{repaymentPreview.finalPaymentDate}</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-48 flex flex-col items-center justify-center text-gray-400">
                                        <FaCalculator size={32} className="mb-2 opacity-20" />
                                        <p className="text-xs font-bold uppercase">Enter amount to calculate</p>
                                    </div>
                                )}
                            </div>

                            {/* System Impact Preview */}
                            <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-5 rounded-2xl border-2 border-purple-200">
                                <h4 className="text-xs font-black text-purple-900 uppercase flex items-center gap-2 mb-4">
                                    <FaShieldAlt /> System Impact Preview
                                </h4>

                                <div className="space-y-3">
                                    <ImpactRow
                                        icon="💰"
                                        label="Member Ledger"
                                        value={loanAmount ? `+KES ${parseFloat(loanAmount).toLocaleString()}` : 'N/A'}
                                        sub="Loan disbursed to member account"
                                        active={!!loanAmount}
                                    />
                                    <ImpactRow
                                        icon="📊"
                                        label="Cash Out"
                                        value={loanAmount ? `KES ${parseFloat(loanAmount).toLocaleString()}` : 'N/A'}
                                        sub={`Meeting #${activeMeeting?.session_number || 'N/A'} cash reconciliation`}
                                        active={!!loanAmount}
                                    />
                                    <ImpactRow
                                        icon="📈"
                                        label="Loan Tracking"
                                        value={repaymentPreview ? `${duration} payments` : 'N/A'}
                                        sub={`Monthly: KES ${repaymentPreview?.monthlyRepayment.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}`}
                                        active={!!repaymentPreview}
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={!hasMeeting}
                                className="w-full py-5 bg-gradient-to-r from-safaricom-green to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 text-lg"
                            >
                                {hasMeeting ? (
                                    <>
                                        <FaCheckCircle />
                                        Review & Confirm
                                    </>
                                ) : (
                                    <>
                                        <FaLock />
                                        Meeting Required
                                    </>
                                )}
                            </button>

                            {!hasMeeting && (
                                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl">
                                    <p className="text-xs text-red-800 font-bold flex items-center gap-2">
                                        <FaBan /> Loan issuance disabled - Please create or open a meeting first
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Helper Components
const ConfirmRow = ({ label, value, highlight }) => (
    <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-gray-500 uppercase">{label}</span>
        <span className={`font-black ${highlight ? 'text-2xl text-safaricom-green' : 'text-sm text-gray-900'}`}>
            {value}
        </span>
    </div>
);

const SummaryItem = ({ label, value, alert }) => (
    <div className="bg-white p-3 rounded-xl">
        <div className="text-[10px] text-gray-500 font-bold uppercase">{label}</div>
        <div className={`text-sm font-black mt-1 ${alert ? 'text-red-600' : 'text-gray-900'}`}>
            {value}
        </div>
    </div>
);

const RepaymentRow = ({ label, value, bold }) => (
    <div className="flex justify-between text-xs">
        <span className={bold ? 'font-black text-gray-900' : 'text-gray-500'}>{label}</span>
        <span className={bold ? 'font-black text-gray-900' : 'font-bold text-gray-700'}>{value}</span>
    </div>
);

const ImpactRow = ({ icon, label, value, sub, active }) => (
    <div className={`bg-white p-4 rounded-xl border-2 ${active ? 'border-green-300' : 'border-gray-200'} transition-all`}>
        <div className="flex items-start gap-3">
            <div className="text-2xl">{icon}</div>
            <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">{label}</span>
                    <span className={`text-xs font-black ${active ? 'text-green-600' : 'text-gray-500'}`}>{value}</span>
                </div>
                <div className="text-[9px] text-gray-400 italic">{sub}</div>
            </div>
        </div>
    </div>
);

export default LoanIssuanceModal;
