import React, { useState, useEffect } from 'react';
import { FaTimes, FaHandHoldingUsd, FaCalculator, FaCalendarAlt, FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaShieldAlt, FaBan, FaLock, FaMoneyBillWave, FaChartLine, FaSpinner } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { checkLoanEligibility, calculateMaxLoan } from '../utils/loanRules';
import { checkLoanApprovalBlock } from '../utils/cashReportEnforcement';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import offlineManager from '../services/OfflineManager';
import LoanAdvisoryPanel from './LoanAdvisoryPanel';

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
    const [guarantor1Id, setGuarantor1Id] = useState('');
    const [guarantor2Id, setGuarantor2Id] = useState('');
    const [membersList, setMembersList] = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [repaymentPreview, setRepaymentPreview] = useState(null);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [showAdvisory, setShowAdvisory] = useState(false);
    const [selectedAdvisoryProduct, setSelectedAdvisoryProduct] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Fetch members for guarantors
    useEffect(() => {
        const fetchMembers = async () => {
            setLoadingMembers(true);
            try {
                const data = await api.getMembers();
                // Filter out the borrowing member
                setMembersList(data.filter(m => m.id !== member.id));
            } catch (error) {
                console.error("Failed to fetch members for guarantors", error);
            } finally {
                setLoadingMembers(false);
            }
        };
        if (isOpen) fetchMembers();
    }, [isOpen, member.id]);

    // Meeting status check
    const hasMeeting = activeMeeting && activeMeeting.status === 'OPEN';
    const meetingDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    // Mock system rules and active loans for demo
    const systemRules = { loanMultiplier: 3, maxInterestRate: 5 };
    const activeLoans = []; // Mock empty for demo

    // Get current loan type rules
    const currentRule = LOAN_TYPE_RULES[loanType];
    const interestRate = currentRule.interestRate;

    // Calculate max loan based on type and liens
    const rawLimit = member ? (member.savings * systemRules.loanMultiplier) : 0;
    const baseMaxLoan = member ? calculateMaxLoan(member.savings, systemRules.loanMultiplier, member.guaranteedAmount || 0) : 0;
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

    const handleProceedToConfirm = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
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

            if (currentRule.requiresGuarantors && (!guarantor1Id || !guarantor2Id)) {
                toast.error("⚠️ This loan type requires two guarantors");
                return;
            }

            if (guarantor1Id && guarantor2Id && guarantor1Id === guarantor2Id) {
                toast.error("⚠️ Guarantor 1 and Guarantor 2 must be different members");
                return;
            }

            // Check loan eligibility (Server-side validation)
            const eligibilityResult = await api.checkLoanEligibility({
                memberId: member.id,
                groupId: member.group_id || member.groupId,
                requestedAmount: numAmount,
                loanType: loanType,
                duration: parseInt(duration),
                guarantor1_id: guarantor1Id ? parseInt(guarantor1Id) : null,
                guarantor2_id: guarantor2Id ? parseInt(guarantor2Id) : null
            });

            if (!eligibilityResult.eligible) {
                toast.error(eligibilityResult.reason || "Member is not eligible for this loan.");
                return;
            }

            // Show confirmation
            setShowConfirmation(true);
        } catch (error) {
            console.error("Eligibility check failed:", error);
            // Error handled by api.js handleApiError or as fallback here
            toast.error("Failed to verify loan eligibility. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };


    const handleFinalSubmit = async () => {
        setSubmitting(true);
        try {
            const loanData = {
                memberId: member.id,
                loanType: loanType,
                amount: parseFloat(loanAmount),
                duration: parseInt(duration),
                purpose: purpose,
                guarantor1Id: guarantor1Id ? parseInt(guarantor1Id) : null,
                guarantor2Id: guarantor2Id ? parseInt(guarantor2Id) : null,
                sessionId: activeMeeting?.id,
                officerId: user?.id || 1,
                // Pre-calculated values for the ledger
                interest: repaymentPreview?.totalInterest,
                totalRepayable: repaymentPreview?.totalRepayable,
                monthlyRepayment: selectedAdvisoryProduct?.monthly_installment || repaymentPreview?.monthlyRepayment,
                principal_portion: selectedAdvisoryProduct?.principal_portion || (parseFloat(loanAmount) / parseInt(duration)),
                interest_portion: selectedAdvisoryProduct?.interest_portion || (repaymentPreview?.totalInterest / parseInt(duration))
            };

            if (!navigator.onLine) {
                const offlineResult = await offlineManager.saveOfflineTransaction({
                    type: loanType.includes('Long-Term') ? 'ltl' : 'stl',
                    data: loanData
                });
                toast.warning(`⚡ Offline: Loan application queued for sync!`);
                if (onSuccess) onSuccess({ ...loanData, offline: true, id: offlineResult });
            } else {
                const result = await api.issueLoan(loanData);
                toast.success(`✅ Loan of KES ${parseFloat(loanAmount).toLocaleString()} ${currentRule.requiresApproval ? 'submitted for approval' : 'issued'} successfully!`);
                if (onSuccess) onSuccess(result);
            }
            setShowConfirmation(false);
            onClose();
        } catch (error) {
            console.error("Loan issuance failed:", error);
            // Error handled by api.js handleApiError
        } finally {
            setSubmitting(false);
        }
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
                        {submitting && (
                            <div className="flex flex-col items-center gap-3 py-4">
                                <FaSpinner className="animate-spin text-3xl text-safaricom-green" />
                                <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Processing...</span>
                            </div>
                        )}
                        <div className="bg-gray-50 p-6 rounded-2xl space-y-3">
                            <ConfirmRow label="Member" value={member.name} />
                            <ConfirmRow label="Loan Type" value={loanType} />
                            <ConfirmRow label="Duration" value={`${duration} months`} />
                            <ConfirmRow label="Interest" value={`${interestRate}% p.m.`} />
                            <div className="h-px bg-gray-200 my-3"></div>
                            <ConfirmRow label="Principal" value={`KES ${parseFloat(loanAmount).toLocaleString()}`} highlight={true} />
                            <ConfirmRow label="Total Repayable" value={`KES ${repaymentPreview?.totalRepayable.toLocaleString()}`} />
                        </div>

                        <div className="flex gap-3">
                            <button
                                disabled={submitting}
                                onClick={() => setShowConfirmation(false)}
                                className="flex-1 py-4 border-2 border-gray-200 text-gray-700 rounded-2xl font-black hover:bg-gray-50 transition-all"
                            >
                                ← Cancel
                            </button>
                            <button
                                disabled={submitting}
                                onClick={handleFinalSubmit}
                                className="flex-1 py-4 bg-gradient-to-r from-safaricom-green to-green-600 text-white rounded-2xl font-black hover:shadow-lg transition-all flex items-center justify-center gap-2"
                            >
                                {submitting ? <FaSpinner className="animate-spin" /> : '✅'} Confirm & Issue
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
                        <button
                            onClick={onClose}
                            className="bg-white/10 hover:bg-red-500 hover:text-white p-3 rounded-2xl transition-all shadow-lg backdrop-blur-sm"
                            title="Close / Exit"
                        >
                            <FaTimes size={20} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleProceedToConfirm} className="p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* LEFT: Member & Loan Details */}
                        <div className="space-y-6">
                            {/* Member Financial Summary - ENHANCED */}
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-2xl border-2 border-blue-200">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <FaInfoCircle className="text-blue-600" />
                                        <h4 className="text-xs font-black text-blue-900 uppercase">Member Loan Capacity</h4>
                                    </div>
                                    <button
                                        type="button"
                                        className="text-blue-500 hover:text-blue-700 transition-colors"
                                        title="Loan capacity is calculated as 3× member's total savings. This ensures members can repay from their own funds if needed."
                                    >
                                        <FaInfoCircle className="text-sm" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {/* Current Savings */}
                                    <div className="bg-white p-3 rounded-xl">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="text-xs text-gray-500">Current Savings</div>
                                            <button
                                                type="button"
                                                className="text-gray-400 hover:text-gray-600"
                                                title="Total member savings from all contributions. Updated in real-time."
                                            >
                                                <FaInfoCircle className="text-[10px]" />
                                            </button>
                                        </div>
                                        <div className="text-lg font-black text-safaricom-green">
                                            KES {member.savings.toLocaleString()}
                                        </div>
                                        <div className="text-[10px] text-gray-500 mt-1">
                                            As of {new Date().toLocaleDateString('en-GB')}
                                        </div>
                                    </div>

                                    {/* Max Loan */}
                                    <div className="bg-white p-3 rounded-xl">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="text-xs text-gray-500">Max Loan (3×)</div>
                                            <button
                                                type="button"
                                                className="text-gray-400 hover:text-gray-600"
                                                title="Maximum loan = Savings × 3. This is the upper limit based on member's financial capacity."
                                            >
                                                <FaInfoCircle className="text-[10px]" />
                                            </button>
                                        </div>
                                        <div className="text-lg font-black text-blue-600">
                                            KES {baseMaxLoan.toLocaleString()}
                                        </div>
                                        <div className="text-[10px] text-gray-500 mt-1">
                                            Calc: ({member.savings.toLocaleString()} × 3) {member.guaranteedAmount > 0 ? `- ${member.guaranteedAmount.toLocaleString()} Lien` : ''}
                                        </div>
                                    </div>

                                    {/* Active Loans Card - same code ... */}
                                    <div className={`bg-white p-3 rounded-xl border-l-4 ${member.activeLoans > rawLimit * 0.7 ? 'border-red-500' : member.activeLoans > 0 ? 'border-orange-500' : 'border-gray-200'}`}>
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="text-xs text-gray-500">Active Loans</div>
                                        </div>
                                        <div className={`text-lg font-black ${member.activeLoans > rawLimit * 0.7 ? 'text-red-600' : member.activeLoans > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                                            KES {member.activeLoans.toLocaleString()}
                                        </div>
                                    </div>

                                    {/* Guaranteed for Others (LIEN) */}
                                    <div className="bg-white p-3 rounded-xl border-l-4 border-blue-500">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="text-xs text-gray-500">Liens (Guarantees)</div>
                                            <button
                                                type="button"
                                                className="text-gray-400 hover:text-gray-600"
                                                title="Total amount member has guaranteed for other members. This amount is 'locked' and reduces their own borrowing capacity."
                                            >
                                                <FaInfoCircle className="text-[10px]" />
                                            </button>
                                        </div>
                                        <div className={`text-lg font-black ${member.guaranteedAmount > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                                            KES {(member.guaranteedAmount || 0).toLocaleString()}
                                        </div>
                                        {member.guaranteedAmount > 0 && (
                                            <div className="text-[10px] text-blue-600 mt-1 flex items-center gap-1">
                                                <FaLock className="text-[8px]" />
                                                Reduces capacity
                                            </div>
                                        )}
                                    </div>

                                    {/* Risk Awareness Warning - NEW */}
                                    {member.activeLoans > rawLimit * 0.7 && (
                                        <div className="col-span-2 p-3 bg-orange-50 border-2 border-orange-200 rounded-xl flex items-center gap-3">
                                            <div className="p-2 bg-orange-100 rounded-lg">
                                                <FaExclamationTriangle className="text-orange-600" />
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-black text-orange-900">High Loan Utilization</div>
                                                <div className="text-[9px] text-orange-700">Member has used over 70% of total borrowing capacity.</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Arrears Status */}
                                    <div className={`bg-white p-3 rounded-xl border-l-4 ${member.arrears > 0 ? 'border-red-500' : 'border-green-500'}`}>
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="text-xs text-gray-500">Arrears Status</div>
                                            <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${member.arrears > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                {member.arrears > 0 ? 'Blocked' : 'Eligible'}
                                            </div>
                                        </div>
                                        <div className={`text-lg font-black ${member.arrears > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {member.arrears > 0 ? `KES ${member.arrears.toLocaleString()}` : 'None'}
                                        </div>
                                        {member.arrears === 0 ? (
                                            <div className="text-[10px] text-green-600 mt-1 flex items-center gap-1">
                                                <FaCheckCircle className="text-[8px]" />
                                                Loan Access Granted
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-red-600 mt-1 flex items-center gap-1">
                                                <FaBan className="text-[8px]" />
                                                Action Required
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Helpful tip */}
                                <div className="mt-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
                                    <p className="text-[10px] text-blue-700 flex items-center gap-1">
                                        <FaInfoCircle className="text-[8px]" />
                                        <strong>Tip:</strong> Members with higher savings can access larger loans. Encourage regular contributions to increase loan capacity.
                                    </p>
                                </div>
                            </div>

                            {/* Loan Type Selection */}
                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-3">
                                    Loan Type *
                                    <span className="ml-2 text-[10px] font-normal text-gray-400">(Rules enforced automatically)</span>
                                </label>

                                {/* 📊 Loan Type Comparison Table - NEW */}
                                <div className="mb-4 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                                    <div className="text-[10px] font-black text-gray-700 mb-3 flex items-center gap-2 uppercase tracking-widest">
                                        <FaInfoCircle className="text-blue-500" />
                                        Loan Type Comparison Matrix
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="border-b border-gray-300">
                                                    <th className="py-2 text-[10px] font-bold text-gray-400 uppercase">Feature</th>
                                                    <th className="py-2 text-[10px] font-bold text-blue-600 uppercase text-center">LTL</th>
                                                    <th className="py-2 text-[10px] font-bold text-purple-600 uppercase text-center">STL</th>
                                                    <th className="py-2 text-[10px] font-bold text-red-600 uppercase text-center">EMG</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-[10px] text-gray-600 font-medium">
                                                <tr className="border-b border-gray-100">
                                                    <td className="py-2">Interest Rate</td>
                                                    <td className="text-center">2% p.m.</td>
                                                    <td className="text-center">3% p.m.</td>
                                                    <td className="text-center">5% p.m.</td>
                                                </tr>
                                                <tr className="border-b border-gray-100">
                                                    <td className="py-2">Duration</td>
                                                    <td className="text-center">6-24 Mo</td>
                                                    <td className="text-center">1-6 Mo</td>
                                                    <td className="text-center">1-3 Mo</td>
                                                </tr>
                                                <tr className="border-b border-gray-100">
                                                    <td className="py-2">Multiplier</td>
                                                    <td className="text-center">3× Savings</td>
                                                    <td className="text-center">2× Savings</td>
                                                    <td className="text-center">1× Savings</td>
                                                </tr>
                                                <tr>
                                                    <td className="py-2">Guarantors</td>
                                                    <td className="text-center text-orange-600 font-bold">2 Required</td>
                                                    <td className="text-center text-green-600 font-bold">Auto-Sync</td>
                                                    <td className="text-center text-green-600 font-bold">None</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

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

                            {/* 📊 OFFICIAL LOAN PRODUCTS BUTTON - NEW */}
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-5 mb-2">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <FaCalculator className="text-blue-600" />
                                        <span className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Fixed Loan Products</span>
                                    </div>
                                    <span className="text-[9px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">Recommended</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowAdvisory(true)}
                                    className="w-full bg-white border-2 border-blue-400 text-blue-600 hover:bg-blue-600 hover:text-white py-3 rounded-xl font-black transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 mb-2"
                                >
                                    <FaCalculator /> View Official Loan Products
                                </button>
                                <p className="text-[9px] text-gray-500 text-center">
                                    Click above to select from 18 standardized UKOMBOZI loan amounts with pre-calculated terms.
                                </p>
                            </div>

                            {/* Loan Amount & Duration */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase mb-2 flex items-center justify-between">
                                        Amount (KES) *
                                        <button
                                            type="button"
                                            className="text-gray-400 hover:text-gray-600"
                                            title="Enter amount within min/max limits. Use percentage buttons for quick selection."
                                        >
                                            <FaInfoCircle className="text-[10px]" />
                                        </button>
                                    </label>
                                    <input
                                        required
                                        type="number"
                                        min={currentRule.minAmount}
                                        max={maxLoan}
                                        disabled={!hasMeeting}
                                        className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-safaricom-green/20 outline-none font-bold disabled:opacity-50 ${loanAmount && parseFloat(loanAmount) > maxLoan
                                            ? 'border-red-500 text-red-600'
                                            : 'border-gray-200 focus:border-safaricom-green'
                                            }`}
                                        placeholder="0"
                                        value={loanAmount}
                                        onChange={(e) => setLoanAmount(e.target.value)}
                                    />

                                    {/* Smart Amount Suggestions */}
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {[2000, 5000, 10000, 20000, 50000].filter(amt => amt >= currentRule.minAmount && amt <= maxLoan).map((amt) => (
                                            <button
                                                key={amt}
                                                type="button"
                                                onClick={() => setLoanAmount(amt)}
                                                className={`px-2 py-1 text-[9px] font-black rounded-lg transition-colors border ${parseFloat(loanAmount) === amt
                                                    ? 'bg-blue-600 text-white border-blue-600'
                                                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                                                    }`}
                                            >
                                                KES {amt.toLocaleString()}
                                            </button>
                                        ))}
                                        {[0.25, 0.5, 0.75, 1].map((pct) => (
                                            <button
                                                key={pct}
                                                type="button"
                                                onClick={() => setLoanAmount(Math.floor(maxLoan * pct))}
                                                className={`px-2 py-1 text-[9px] font-black rounded-lg transition-colors border ${parseFloat(loanAmount) === Math.floor(maxLoan * pct)
                                                    ? 'bg-safaricom-green text-white border-safaricom-green'
                                                    : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'
                                                    }`}
                                            >
                                                {pct * 100}% Max
                                            </button>
                                        ))}
                                    </div>

                                    {/* Validation Message */}
                                    {loanAmount && parseFloat(loanAmount) > maxLoan ? (
                                        <div className="text-[10px] text-red-600 mt-2 flex items-center gap-1 font-bold">
                                            <FaExclamationTriangle />
                                            Exceeds limit by KES {(parseFloat(loanAmount) - maxLoan).toLocaleString()}
                                        </div>
                                    ) : (
                                        <p className="text-[10px] text-gray-500 mt-2">
                                            Min: {currentRule.minAmount.toLocaleString()} | Max: {maxLoan.toLocaleString()}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase mb-2 flex items-center justify-between">
                                        Duration *
                                        <button
                                            type="button"
                                            className="text-gray-400 hover:text-gray-600"
                                            title="Longer duration = lower monthly payments but higher total interest."
                                        >
                                            <FaInfoCircle className="text-[10px]" />
                                        </button>
                                    </label>
                                    <input
                                        required
                                        type="number"
                                        min={currentRule.minDuration}
                                        max={currentRule.maxDuration}
                                        value={duration}
                                        onChange={(e) => setDuration(e.target.value)}
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-safaricom-green/20 outline-none font-bold"
                                        placeholder={`${currentRule.minDuration}-${currentRule.maxDuration}`}
                                    />
                                </div>
                            </div>


                            {/* Purpose */}
                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase mb-2 flex items-center justify-between">
                                    Loan Purpose * (Min 10 chars)
                                    <button
                                        type="button"
                                        className="text-gray-400 hover:text-gray-600"
                                        title="Specific purposes increase approval chances."
                                    >
                                        <FaInfoCircle className="text-[10px]" />
                                    </button>
                                </label>
                                <textarea
                                    required
                                    minLength={10}
                                    rows={3}
                                    disabled={!hasMeeting}
                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-safaricom-green/20 outline-none disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                    placeholder="Enter detailed purpose (e.g., 'Business expansion - Stock purchase')"
                                    value={purpose}
                                    onChange={(e) => setPurpose(e.target.value)}
                                />

                                {/* 📝 Detailed Purpose Examples - ENHANCED */}
                                <details className="mt-2 group">
                                    <summary className="text-[10px] text-blue-600 cursor-pointer hover:text-blue-800 font-bold flex items-center gap-1 select-none">
                                        <span className="group-open:rotate-90 transition-transform">▶</span>
                                        View professional example purposes
                                    </summary>
                                    <div className="mt-2 p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-[10px] text-gray-700 animate-in fade-in slide-in-from-top-1">
                                        <div className="font-black text-blue-900 mb-2 uppercase tracking-wider">Example Templates:</div>
                                        <ul className="space-y-2">
                                            <li className="flex gap-2">
                                                <span className="text-green-600 font-bold">✓</span>
                                                <span><strong>Business:</strong> "Expansion of retail inventory - purchasing 10 bags of maize plus vegetable stock for upcoming market season."</span>
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="text-green-600 font-bold">✓</span>
                                                <span><strong>Education:</strong> "Form 4 School Fees for [Child Name] at [School Name] - covering second term tuition and boarding."</span>
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="text-green-600 font-bold">✓</span>
                                                <span><strong>Medical:</strong> "Emergency hospital bill settlement at [Hospital] following accidental injury of family member."</span>
                                            </li>
                                        </ul>
                                        <div className="mt-2 pt-2 border-t border-blue-200 text-red-600 font-bold">
                                            ⚠️ Avoid vague entries like "Personal use" or "Emergency" as they may result in rejection.
                                        </div>
                                    </div>
                                </details>
                            </div>

                            {/* Guarantors (conditional) */}
                            {currentRule.requiresGuarantors && (
                                <div className="space-y-3">
                                    <label className="block text-xs font-black text-gray-500 uppercase flex items-center justify-between">
                                        Guarantors (Required for {loanType}) *
                                        <button
                                            type="button"
                                            className="text-gray-400 hover:text-gray-600"
                                            title="Guarantors must have savings > 50% of loan amount and no arrears."
                                        >
                                            <FaInfoCircle className="text-[10px]" />
                                        </button>
                                    </label>

                                    {/* Eligibility Rules */}
                                    <div className="bg-yellow-50 p-2 rounded-lg border border-yellow-200 mb-2">
                                        <p className="text-[10px] text-yellow-800 font-bold mb-1">✅ Guarantor Eligibility:</p>
                                        <ul className="text-[9px] text-yellow-800 list-disc list-inside">
                                            <li title="Members must have enough collateral (50% of the loan amount being borrowed).">Savings ≥ 50% of loan amount</li>
                                            <li title="Members with active defaults or arrears are disqualified from guaranteeing others.">No outstanding arrears</li>
                                            <li title="Only active members who are not the direct borrower can guarantee.">Active member (not self)</li>
                                        </ul>
                                    </div>

                                    <select
                                        required={currentRule.requiresGuarantors}
                                        disabled={!hasMeeting || loadingMembers}
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-safaricom-green/20 outline-none disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                                        value={guarantor1Id}
                                        onChange={(e) => setGuarantor1Id(e.target.value)}
                                    >
                                        <option value="">-- Select Guarantor 1 --</option>
                                        {membersList.map(m => {
                                            const isEligible = m.savings >= (parseFloat(loanAmount) * 0.5) && (m.arrears || 0) === 0;
                                            return (
                                                <option key={m.id} value={m.id} disabled={!isEligible}>
                                                    {isEligible ? '✅' : '❌'} {m.name} (Savings: KES {m.savings?.toLocaleString()})
                                                </option>
                                            );
                                        })}
                                    </select>

                                    <select
                                        required={currentRule.requiresGuarantors}
                                        disabled={!hasMeeting || loadingMembers}
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-safaricom-green/20 outline-none disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                                        value={guarantor2Id}
                                        onChange={(e) => setGuarantor2Id(e.target.value)}
                                    >
                                        <option value="">-- Select Guarantor 2 --</option>
                                        {membersList.map(m => {
                                            const isEligible = m.savings >= (parseFloat(loanAmount) * 0.5) && (m.arrears || 0) === 0;
                                            return (
                                                <option key={m.id} value={m.id} disabled={!isEligible}>
                                                    {isEligible ? '✅' : '❌'} {m.name} (Savings: KES {m.savings?.toLocaleString()})
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* RIGHT: Repayment Preview & System Impact */}
                        <div className="space-y-6">
                            {/* Repayment Calculator - ENHANCED */}
                            <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-2xl border-2 border-gray-200">
                                <h4 className="text-sm font-black text-gray-900 flex items-center justify-between gap-2 mb-4">
                                    <div className="flex items-center gap-2">
                                        <FaCalculator className="text-safaricom-green" />
                                        Repayment Calculator
                                    </div>
                                    <button
                                        type="button"
                                        className="text-gray-400 hover:text-gray-600"
                                        title="Shows breakdown of total cost and monthly installments."
                                    >
                                        <FaInfoCircle className="text-[10px]" />
                                    </button>
                                </h4>

                                {repaymentPreview ? (
                                    <div className="space-y-4">
                                        {/* Monthly Payment Highlight */}
                                        {/* Monthly Payment Highlight - ENHANCED */}
                                        <div className="bg-gradient-to-br from-safaricom-green to-green-700 p-5 rounded-2xl text-white shadow-xl transform transition-transform hover:scale-[1.02]">
                                            <div className="text-[10px] opacity-80 uppercase font-black tracking-widest mb-2">Monthly Installment</div>
                                            <div className="text-4xl font-black mb-1">
                                                KES {repaymentPreview.monthlyRepayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </div>
                                            <div className="text-[10px] opacity-90 flex items-center gap-2">
                                                <FaCalendarAlt className="text-[8px]" />
                                                Due next meeting cycle
                                            </div>
                                        </div>

                                        {/* Affordability Analytics - NEW */}
                                        {member.savings > 0 && (
                                            <div className="bg-white p-4 rounded-xl border border-gray-200">
                                                <div className="text-[10px] font-black text-gray-700 mb-3 flex items-center justify-between">
                                                    <span>💰 AFFORDABILITY RATIOS</span>
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] ${(repaymentPreview.monthlyRepayment / member.savings) > 0.3 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                                                        }`}>
                                                        {((repaymentPreview.monthlyRepayment / member.savings) * 100).toFixed(1)}% Ratio
                                                    </span>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-[10px]">
                                                        <span className="text-gray-500">vs. Current Savings</span>
                                                        <span className="font-bold text-gray-900">{((repaymentPreview.monthlyRepayment / member.savings) * 100).toFixed(1)}%</span>
                                                    </div>
                                                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                        <div
                                                            className={`h-1.5 rounded-full ${(repaymentPreview.monthlyRepayment / member.savings) > 0.3 ? 'bg-orange-500' : 'bg-green-500'}`}
                                                            style={{ width: `${Math.min(100, (repaymentPreview.monthlyRepayment / member.savings) * 100)}%` }}
                                                        ></div>
                                                    </div>
                                                    {(repaymentPreview.monthlyRepayment / member.savings) > 0.3 && (
                                                        <div className="mt-2 p-2 bg-orange-50 rounded-lg text-[9px] text-orange-700 flex items-center gap-2">
                                                            <FaExclamationTriangle />
                                                            High payment-to-savings ratio undetected. Consider 12+ months.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Detailed Breakdown */}
                                        <div className="bg-white p-4 rounded-xl space-y-2">
                                            <RepaymentRow label="Principal" value={`KES ${repaymentPreview.principal.toLocaleString()}`} />
                                            <RepaymentRow
                                                label={`Interest (${interestRate}% p.m.)`}
                                                value={`+ KES ${repaymentPreview.totalInterest.toLocaleString()}`}
                                                highlightValue={true}
                                            />
                                            <div className="h-px bg-gray-200 my-2"></div>
                                            <RepaymentRow label="Total Repayable" value={`KES ${repaymentPreview.totalRepayable.toLocaleString()}`} bold={true} />
                                        </div>

                                        {/* Schedule */}
                                        <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-200">
                                            <div className="flex justify-between mb-1">
                                                <span>📅 First Payment:</span>
                                                <span className="font-bold text-gray-900">{repaymentPreview.firstPaymentDate}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>📅 Final Payment:</span>
                                                <span className="font-bold text-gray-900">{repaymentPreview.finalPaymentDate}</span>
                                            </div>
                                            <div className="text-[9px] text-center mt-2 text-gray-400">
                                                {duration} monthly installments
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

                            {/* System Impact Preview - ENHANCED */}
                            <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-3xl border-2 border-purple-100 shadow-inner">
                                <h4 className="text-[10px] font-black text-purple-900 uppercase flex items-center justify-between gap-2 mb-4 tracking-widest">
                                    <div className="flex items-center gap-2">
                                        <FaShieldAlt className="text-purple-600" /> System Impact Analysis
                                    </div>
                                    <button
                                        type="button"
                                        className="text-purple-400 hover:text-purple-600"
                                        title="Shows exactly how this loan will affect the member's account and group records."
                                    >
                                        <FaInfoCircle className="text-sm" />
                                    </button>
                                </h4>

                                <div className="space-y-4">
                                    <ImpactCard
                                        icon={<FaMoneyBillWave className="text-green-600" />}
                                        title="Member Ledger"
                                        value={loanAmount ? `+ KES ${parseFloat(loanAmount).toLocaleString()}` : 'N/A'}
                                        subtitle="Disbursement to Account"
                                        details={loanAmount ? `New Loan Balance: KES ${(member.activeLoans + parseFloat(loanAmount)).toLocaleString()}` : "Pending calculation"}
                                        color="green"
                                    />
                                    <ImpactCard
                                        icon={<FaHandHoldingUsd className="text-orange-600" />}
                                        title="Cash Reconciliation"
                                        value={loanAmount ? `KES ${parseFloat(loanAmount).toLocaleString()}` : 'N/A'}
                                        subtitle="Meeting Outflow"
                                        details={`Source: Meeting #${activeMeeting?.session_number || 'N/A'} Cash Pool`}
                                        color="orange"
                                    />
                                    <ImpactCard
                                        icon={<FaChartLine className="text-blue-600" />}
                                        title="Repayment Stream"
                                        value={repaymentPreview ? `${duration} Installments` : 'N/A'}
                                        subtitle="Monthly Collection"
                                        details={repaymentPreview ? `End Date: ${repaymentPreview.finalPaymentDate}` : "Schedule not set"}
                                        color="blue"
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            {/* Action Buttons */}
                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="col-span-1 py-4 border-2 border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                                >
                                    <FaTimes /> Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!hasMeeting}
                                    className="col-span-2 py-4 bg-gradient-to-r from-safaricom-green to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-black rounded-2xl shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-2 text-lg transform hover:-translate-y-1"
                                >
                                    {hasMeeting ? (
                                        <>
                                            <FaCheckCircle /> Review & Confirm
                                        </>
                                    ) : (
                                        <>
                                            <FaLock /> Meeting Required
                                        </>
                                    )}
                                </button>
                            </div>

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

            <LoanAdvisoryPanel
                isOpen={showAdvisory}
                onClose={() => setShowAdvisory(false)}
                onSelectLoan={(product) => {
                    setLoanAmount(product.loan_amount.toString());
                    setDuration(product.repayment_period_months.toString());
                    setSelectedAdvisoryProduct(product);
                    toast.success(`✓ Applied terms for KES ${product.loan_amount.toLocaleString()}`);
                    setShowAdvisory(false);
                }}
            />
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

const RepaymentRow = ({ label, value, bold, highlightValue }) => (
    <div className="flex justify-between text-xs">
        <span className={bold ? 'font-black text-gray-900' : 'text-gray-500'}>{label}</span>
        <span className={`${bold ? 'font-black text-gray-900' : 'font-bold'} ${highlightValue ? 'text-orange-600' : 'text-gray-700'}`}>
            {value}
        </span>
    </div>
);

const ImpactCard = ({ icon, title, value, subtitle, details, color }) => {
    const colorClasses = {
        green: 'border-green-500 bg-green-50 text-green-700',
        orange: 'border-orange-500 bg-orange-50 text-orange-700',
        blue: 'border-blue-500 bg-blue-50 text-blue-700'
    };

    const currentClasses = colorClasses[color] || colorClasses.blue;

    return (
        <div className={`bg-white p-4 rounded-2xl border-l-4 shadow-sm ${currentClasses.split(' ')[0]} flex items-start gap-4 transition-all hover:shadow-md`}>
            <div className={`p-3 ${currentClasses.split(' ')[1]} rounded-xl`}>
                {icon}
            </div>
            <div className="flex-1">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{title}</div>
                        <div className="text-lg font-black text-gray-900">{value}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-[9px] text-gray-500 font-bold">{subtitle}</div>
                    </div>
                </div>
                <div className={`mt-2 py-1 px-2 ${currentClasses.split(' ')[1]} rounded text-[9px] ${currentClasses.split(' ')[2]} font-bold inline-block`}>
                    {details}
                </div>
            </div>
        </div>
    );
};

export default LoanIssuanceModal;
