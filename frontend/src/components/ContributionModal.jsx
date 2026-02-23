import React, { useState, useEffect, useMemo } from 'react';
import { FaTimes, FaPiggyBank, FaSearch, FaCheckCircle, FaShieldAlt, FaInfoCircle, FaLock, FaBan, FaExclamationTriangle, FaCalendarAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../services/api';
import offlineManager from '../services/offlineManager';

// 🔐 CONTRIBUTION TYPE RULES ENGINE
const CONTRIBUTION_RULES = {
    'Monthly Saving': {
        affectsSavings: true,
        affectsCash: true,
        affectsLoanEligibility: true,
        expectedAmount: 2000,
        description: 'Regular monthly savings - builds loan capacity',
        icon: '💰',
        color: 'green'
    },
    'Special Contribution': {
        affectsSavings: true,
        affectsCash: true,
        affectsLoanEligibility: false,
        expectedAmount: null,
        description: 'Additional savings - No loan eligibility impact',
        icon: '⭐',
        color: 'blue'
    },
    'Welfare': {
        affectsSavings: false,
        affectsCash: true,
        affectsLoanEligibility: false,
        expectedAmount: 500,
        description: 'Welfare fund only - No savings impact',
        icon: '🤝',
        color: 'purple'
    },
    'Project': {
        affectsSavings: false,
        affectsCash: true,
        affectsLoanEligibility: false,
        expectedAmount: null,
        description: 'Project fund only - No savings impact',
        icon: '🏗️',
        color: 'orange'
    },
    'Application Fee': {
        affectsSavings: false,
        affectsCash: true,
        affectsLoanEligibility: false,
        expectedAmount: 500,
        description: 'One-time application fee - No savings impact',
        icon: '📝',
        color: 'gray'
    },
    'Appreciation Fee': {
        affectsSavings: false,
        affectsCash: true,
        affectsLoanEligibility: false,
        expectedAmount: 100,
        description: 'Thank you fee - No savings impact',
        icon: '🙏',
        color: 'pink'
    }
};

const ContributionModal = ({ isOpen, onClose, selectedGroupId, selectedGroupName, members = [], member: initialMember, activeMeeting, onSuccess }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMember, setSelectedMember] = useState(initialMember || null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [type, setType] = useState('Monthly Saving');
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Physical Cash');
    const [loanDetails, setLoanDetails] = useState(null);
    const [sendingSMS, setSendingSMS] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    // Meeting status check
    const hasMeeting = activeMeeting && activeMeeting.status === 'ACTIVE';
    const meetingDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    // Filter members by group context
    const membersInGroup = useMemo(() => {
        return members.filter(m => m.group_id === selectedGroupId || m.groupId === selectedGroupId);
    }, [selectedGroupId, members]);

    // Live search for member dropdown
    const filteredMembers = useMemo(() => {
        if (!searchTerm) return membersInGroup;
        return membersInGroup.filter(m =>
            m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.phone.includes(searchTerm)
        );
    }, [searchTerm, membersInGroup]);

    // Auto-fill expected amount when member or type changes
    useEffect(() => {
        if (selectedMember && type) {
            const rule = CONTRIBUTION_RULES[type];
            if (rule.expectedAmount) {
                setAmount(rule.expectedAmount.toString());
            }
        }
    }, [selectedMember, type]);

    useEffect(() => {
        if (initialMember) {
            setSelectedMember(initialMember);
            // Auto-fill expected amount for initial member
            const rule = CONTRIBUTION_RULES[type];
            if (rule.expectedAmount) {
                setAmount(rule.expectedAmount.toString());
            }
        }
    }, [initialMember, type]);

    // Check for active loans (Simplified for now - can be expanded with real API)
    useEffect(() => {
        if (selectedMember) {
            setLoanDetails(null); // Will be populated by real summary API if needed
        }
    }, [selectedMember]);

    if (!isOpen) return null;

    // Get current contribution rule
    const currentRule = CONTRIBUTION_RULES[type];

    // Calculate impacts
    const numAmount = parseFloat(amount) || 0;
    const newSavingsBalance = selectedMember && currentRule.affectsSavings
        ? selectedMember.savings + numAmount
        : selectedMember?.savings || 0;
    const newLoanEligibility = currentRule.affectsLoanEligibility
        ? newSavingsBalance * 3
        : (selectedMember?.savings || 0) * 3;

    const handleProceedToConfirm = (e) => {
        e.preventDefault();

        // Validation
        if (!selectedMember) {
            toast.error("⚠️ Please select a member first");
            return;
        }

        if (!hasMeeting) {
            toast.error("🔒 Cannot post contribution - No active meeting!");
            return;
        }

        if (isNaN(numAmount) || numAmount <= 0) {
            toast.error("⚠️ Amount must be greater than zero");
            return;
        }

        // Show confirmation
        setShowConfirmation(true);
    };

    const handleFinalSubmit = async () => {
        // Map UI type names to backend normalized types
        const typeMapping = {
            'Monthly Saving': 'savings',
            'Special Contribution': 'savings',
            'Welfare': 'welfare',
            'Project': 'project',
            'Application Fee': 'registration',
            'Appreciation Fee': 'appreciation'
        };

        const contributionData = {
            memberId: selectedMember.id,
            groupId: selectedGroupId,
            sessionId: activeMeeting?.id || null,
            contributionType: typeMapping[type] || 'savings',
            amount: numAmount,
            paymentMethod: paymentMethod,
            description: `${type} - Meeting #${activeMeeting?.session_number || 'N/A'}`
        };

        try {
            setSendingSMS(true);

            let result;
            if (!navigator.onLine) {
                const offlineId = await offlineManager.saveOfflineTransaction({
                    type: 'contribution',
                    data: contributionData
                });
                result = { success: true, transaction_ref: `OFFLINE-${offlineId}`, offline: true };
                toast.warning(`⚡ Offline: Contribution queued for sync!`);
            } else {
                // Call backend API for atomic posting
                result = await api.postContribution(contributionData);
            }

            if (result && result.success) {
                if (!result.offline) {
                    toast.success(`✅ Contribution posted: ${result.transaction_ref}`);
                }

                // Build allocation object for parent callback
                const allocation = {
                    ...contributionData,
                    memberName: selectedMember.name,
                    type: type,
                    created_at: new Date().toISOString(),
                    date: new Date().toISOString().split('T')[0],
                    meetingReference: activeMeeting?.session_number,
                    reference: result.transaction_ref,
                    ledgerId: result.ledger_id || `OFFLINE-${result.transaction_ref}`,
                    contributionRule: currentRule,
                    offline: result.offline
                };

                onSuccess(allocation);
                setShowConfirmation(false);
                onClose();
            } else {
                toast.error(`❌ ${result?.error || 'Failed to post contribution'}`);
            }
        } catch (error) {
            console.error('Contribution posting error:', error);
            toast.error("❌ Failed to process contribution - please try again");
        } finally {
            setSendingSMS(false);
        }
    };

    // Confirmation Dialog
    if (showConfirmation) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
                    <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-6 text-white">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-white/20 rounded-2xl">
                                <FaExclamationTriangle size={24} />
                            </div>
                            <h3 className="text-xl font-black">Confirm Contribution</h3>
                        </div>
                    </div>

                    <div className="p-8 space-y-6">
                        <div className="bg-gray-50 p-6 rounded-2xl space-y-3">
                            <ConfirmRow label="Member" value={selectedMember.name} />
                            <ConfirmRow label="Group" value={selectedGroupName} />
                            <ConfirmRow label="Meeting" value={`#${activeMeeting.session_number}`} />
                            <ConfirmRow label="Type" value={type} />
                            <ConfirmRow label="Payment" value={paymentMethod} />
                            <div className="h-px bg-gray-200 my-3"></div>
                            <ConfirmRow
                                label="Amount"
                                value={`KES ${numAmount.toLocaleString()}`}
                                highlight={true}
                            />
                        </div>

                        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                            <p className="text-xs text-blue-800 font-bold">
                                ⚠️ This action cannot be undone. Corrections require a reversal entry.
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
                                disabled={sendingSMS}
                                className="flex-1 py-4 bg-gradient-to-r from-safaricom-green to-green-600 text-white rounded-2xl font-black hover:shadow-lg transition-all disabled:opacity-50"
                            >
                                {sendingSMS ? 'Processing...' : '✅ Confirm & Post'}
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
            <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden my-8">
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
                                        {selectedGroupName} • Meeting #{activeMeeting.session_number} • {meetingDate} • Status: {activeMeeting.status}
                                    </div>
                                </div>
                            </div>
                            <div className="text-xs font-black bg-white/20 px-3 py-1 rounded-full uppercase">
                                Posting Enabled
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
                                    Posting disabled - Please select an active session first
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="bg-safaricom-dark p-6 text-white relative">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-2xl font-black flex items-center gap-3">
                                <div className="p-3 bg-safaricom-green rounded-2xl shadow-lg">
                                    <FaPiggyBank />
                                </div>
                                Record Contribution
                            </h3>
                            <p className="text-xs text-gray-300 mt-1">
                                UKOMBOZI Institutional Standard - Mistake-Proof Entry
                            </p>
                        </div>
                        <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl transition-all">
                            <FaTimes size={20} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleProceedToConfirm} className="p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* LEFT: Member & Type */}
                        <div className="space-y-6">
                            {/* Member Selector */}
                            <div className="relative">
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">
                                    Select Member *
                                </label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                        <FaSearch />
                                    </div>
                                    <input
                                        type="text"
                                        disabled={!hasMeeting}
                                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none font-bold text-gray-800 placeholder:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                        placeholder={hasMeeting ? "Type member name or phone..." : "Meeting required"}
                                        value={selectedMember ? selectedMember.name : searchTerm}
                                        onFocus={() => {
                                            setIsDropdownOpen(true);
                                            if (selectedMember) setSelectedMember(null);
                                        }}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                    {selectedMember && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                            <FaCheckCircle className="text-safaricom-green text-xl" />
                                        </div>
                                    )}
                                </div>

                                {/* Member Dropdown */}
                                {isDropdownOpen && hasMeeting && (
                                    <div className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-200 rounded-2xl shadow-2xl max-h-60 overflow-y-auto">
                                        {filteredMembers.length > 0 ? filteredMembers.map(m => (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedMember(m);
                                                    setIsDropdownOpen(false);
                                                    setSearchTerm('');
                                                }}
                                                className="w-full text-left p-4 hover:bg-safaricom-green/5 border-b border-gray-100 flex items-center justify-between group transition-all"
                                            >
                                                <div>
                                                    <div className="font-black text-gray-800">{m.name}</div>
                                                    <div className="text-xs text-gray-500">{m.phone}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] text-gray-400 uppercase font-bold">Savings</div>
                                                    <div className="font-black text-sm text-safaricom-dark">KES {m.savings.toLocaleString()}</div>
                                                </div>
                                            </button>
                                        )) : (
                                            <div className="p-6 text-center text-gray-400">
                                                <FaInfoCircle className="mx-auto mb-2" size={20} />
                                                <p className="text-sm font-bold">No members found</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Member Financial Summary */}
                            {selectedMember && (
                                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-2xl border-2 border-blue-200">
                                    <div className="flex items-center gap-2 mb-3">
                                        <FaInfoCircle className="text-blue-600" />
                                        <h4 className="text-xs font-black text-blue-900 uppercase">Member Financial Summary</h4>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <SummaryItem label="Current Savings" value={`KES ${selectedMember.savings.toLocaleString()}`} />
                                        <SummaryItem label="Expected Monthly" value="KES 2,000" />
                                        <SummaryItem label="Active Loans" value={`KES ${selectedMember.activeLoans.toLocaleString()}`} />
                                        <SummaryItem
                                            label="Arrears"
                                            value={selectedMember.arrears > 0 ? `KES ${selectedMember.arrears.toLocaleString()}` : 'None'}
                                            alert={selectedMember.arrears > 0}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Contribution Type with Rules */}
                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-3">
                                    Contribution Type *
                                    <span className="ml-2 text-[10px] font-normal text-gray-400">(Rules enforced automatically)</span>
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(CONTRIBUTION_RULES).map(([typeName, rule]) => (
                                        <button
                                            key={typeName}
                                            type="button"
                                            disabled={!hasMeeting}
                                            onClick={() => setType(typeName)}
                                            className={`relative p-3 rounded-xl text-left transition-all border-2 disabled:opacity-40 disabled:cursor-not-allowed ${type === typeName
                                                ? 'bg-safaricom-green/10 border-safaricom-green shadow-md'
                                                : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">{rule.icon}</span>
                                                <div className="flex-1">
                                                    <div className={`text-[11px] font-black ${type === typeName ? 'text-safaricom-green' : 'text-gray-700'}`}>
                                                        {typeName}
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
                                                <span className={currentRule.affectsSavings ? 'text-green-700 font-bold' : 'text-gray-400'}>
                                                    {currentRule.affectsSavings ? '✅' : '❌'} Savings
                                                </span>
                                                <span className={currentRule.affectsLoanEligibility ? 'text-green-700 font-bold' : 'text-gray-400'}>
                                                    {currentRule.affectsLoanEligibility ? '✅' : '❌'} Loan Eligibility
                                                </span>
                                                <span className={currentRule.affectsCash ? 'text-green-700 font-bold' : 'text-gray-400'}>
                                                    {currentRule.affectsCash ? '✅' : '❌'} Cash
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Method */}
                            <div>
                                <h3 className="text-xl font-bold text-gray-800 uppercase tracking-tight">UKOMBOZINI <span className="text-blue-600">CAPITAL</span></h3>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Payment Method *</label>
                                <div className="flex gap-2">
                                    {['Physical Cash', 'Bank Deposit', 'Mobile Money'].map(m => (
                                        <button
                                            key={m}
                                            type="button"
                                            disabled={!hasMeeting}
                                            onClick={() => setPaymentMethod(m)}
                                            className={`flex-1 py-3 px-2 rounded-xl text-[10px] font-black uppercase transition-all border-2 disabled:opacity-40 disabled:cursor-not-allowed ${paymentMethod === m
                                                ? 'bg-blue-600/10 border-blue-600 text-blue-600'
                                                : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                                                }`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: Amount & Preview */}
                        <div className="space-y-6">
                            {/* Amount Input */}
                            <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-2xl border-2 border-gray-200">
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-4 text-center">
                                    Amount (KES) *
                                </label>
                                <div className="relative">
                                    <input
                                        required
                                        type="number"
                                        min="1"
                                        step="0.01"
                                        disabled={!hasMeeting}
                                        className="w-full bg-transparent text-6xl font-black text-gray-900 text-center outline-none placeholder:text-gray-200 pt-12 disabled:opacity-50 disabled:cursor-not-allowed"
                                        placeholder="0"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                    />
                                </div>
                                {currentRule.expectedAmount && (
                                    <p className="text-center text-xs text-gray-500 mt-2">
                                        Expected: KES {currentRule.expectedAmount.toLocaleString()}
                                    </p>
                                )}
                                <div className="h-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent mt-4"></div>
                            </div>

                            {/* Enhanced System Impact Preview */}
                            <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-5 rounded-2xl border-2 border-purple-200">
                                <h4 className="text-xs font-black text-purple-900 uppercase flex items-center gap-2 mb-4">
                                    <FaShieldAlt /> System Impact Preview
                                </h4>

                                <div className="space-y-3">
                                    <ImpactRow
                                        icon="💰"
                                        label="Member Ledger"
                                        value={currentRule.affectsSavings ? `+KES ${numAmount.toLocaleString()}` : 'No Change'}
                                        sub={currentRule.affectsSavings ? `New balance: KES ${newSavingsBalance.toLocaleString()}` : 'Goes to fund account'}
                                        active={currentRule.affectsSavings}
                                    />
                                    <ImpactRow
                                        icon="📊"
                                        label="Cash Report"
                                        value={paymentMethod === 'Physical Cash' ? 'CASH IN' : 'BYPASS'}
                                        sub={paymentMethod === 'Physical Cash' ? `Meeting #${activeMeeting?.session_number || 'N/A'}` : 'Bank ledger'}
                                        active={paymentMethod === 'Physical Cash'}
                                    />
                                    <ImpactRow
                                        icon="🎯"
                                        label="Loan Eligibility"
                                        value={currentRule.affectsLoanEligibility ? `KES ${newLoanEligibility.toLocaleString()}` : 'No Change'}
                                        sub={currentRule.affectsLoanEligibility ? '3× Savings Multiplier' : 'Type does not qualify'}
                                        active={currentRule.affectsLoanEligibility}
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
                                        <FaBan /> Posting disabled - Please create or open a meeting first
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

export default ContributionModal;
