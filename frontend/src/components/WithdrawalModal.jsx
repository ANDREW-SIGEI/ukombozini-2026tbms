import React, { useState, useEffect } from 'react';
import { FaTimes, FaMoneyBillWave, FaExclamationTriangle, FaCheckCircle, FaShieldAlt, FaInfoCircle, FaLock } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../services/api';

const WithdrawalModal = ({ isOpen, onClose, member, groupId, groupName, activeMeeting, onSuccess }) => {
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [preview, setPreview] = useState(null);
    const [validationErrors, setValidationErrors] = useState([]);
    const [isValidating, setIsValidating] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    const hasMeeting = activeMeeting && activeMeeting.status === 'ACTIVE';
    const numAmount = parseFloat(amount) || 0;

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setAmount('');
            setReason('');
            setPreview(null);
            setValidationErrors([]);
            setShowConfirmation(false);
        }
    }, [isOpen]);

    // Validate on amount change (debounced)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (numAmount > 0 && member) {
                validateWithdrawal();
            } else {
                setPreview(null);
                setValidationErrors([]);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [amount, member]); // eslint-disable-line

    const validateWithdrawal = async () => {
        if (!member || numAmount <= 0) return;

        setIsValidating(true);
        try {
            const result = await api.validateWithdrawal({
                memberId: member.id,
                groupId: groupId,
                amount: numAmount,
                withdrawalType: 'savings_withdrawal'
            });

            if (result.valid) {
                setPreview(result.preview);
                setValidationErrors([]);
            } else {
                setPreview(null);
                setValidationErrors(result.validationErrors || ['Validation failed']);
            }
        } catch (error) {
            console.error('Validation error:', error);
            setValidationErrors(['Unable to validate withdrawal']);
        } finally {
            setIsValidating(false);
        }
    };

    const handleProceedToConfirm = (e) => {
        e.preventDefault();

        if (!member) {
            toast.error("⚠️ No member selected");
            return;
        }
        if (!hasMeeting) {
            toast.error("🔒 Cannot process withdrawal - No active meeting!");
            return;
        }
        if (numAmount <= 0) {
            toast.error("⚠️ Amount must be greater than zero");
            return;
        }
        if (validationErrors.length > 0) {
            toast.error(`⚠️ ${validationErrors[0]}`);
            return;
        }
        if (!preview) {
            toast.error("⚠️ Please wait for validation to complete");
            return;
        }

        setShowConfirmation(true);
    };

    const handleFinalSubmit = async () => {
        setIsProcessing(true);

        try {
            const result = await api.postWithdrawal({
                memberId: member.id,
                groupId: groupId,
                sessionId: activeMeeting?.id || null,
                amount: numAmount,
                withdrawalType: 'savings_withdrawal',
                reason: reason || 'Member withdrawal request'
            });

            if (result && result.success) {
                toast.success(`✅ Withdrawal processed: ${result.transaction_ref}`);
                onSuccess({
                    ...result,
                    memberName: member.name,
                    amount: numAmount
                });
                onClose();
            } else {
                toast.error(`❌ ${result?.error || 'Failed to process withdrawal'}`);
            }
        } catch (error) {
            console.error('Withdrawal error:', error);
            toast.error("❌ Failed to process withdrawal - please try again");
        } finally {
            setIsProcessing(false);
            setShowConfirmation(false);
        }
    };

    if (!isOpen) return null;

    // Confirmation Dialog
    if (showConfirmation && preview) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
                    <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 text-white">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-white/20 rounded-2xl">
                                <FaExclamationTriangle size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black">Confirm Withdrawal</h3>
                                <p className="text-xs opacity-80">This action cannot be undone</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 space-y-6">
                        <div className="bg-gray-50 p-6 rounded-2xl space-y-3">
                            <ConfirmRow label="Member" value={member.name} />
                            <ConfirmRow label="Group" value={groupName} />
                            <ConfirmRow label="Meeting" value={`#${activeMeeting?.session_number || 'N/A'}`} />
                            <div className="h-px bg-gray-200 my-3"></div>
                            <ConfirmRow label="Amount" value={`KES ${numAmount.toLocaleString()}`} highlight />
                            <ConfirmRow label="Balance After" value={`KES ${preview.savings_after.toLocaleString()}`} />
                        </div>

                        {preview.requires_approval && (
                            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r-lg">
                                <p className="text-xs text-yellow-800 font-bold">
                                    ⚠️ Large withdrawal - Requires senior officer approval
                                </p>
                            </div>
                        )}

                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                            <p className="text-xs text-red-800 font-bold">
                                ⚠️ This will immediately reduce member savings. Reversal requires admin approval.
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
                                disabled={isProcessing}
                                className="flex-1 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-2xl font-black hover:shadow-lg transition-all disabled:opacity-50"
                            >
                                {isProcessing ? 'Processing...' : '✅ Confirm Withdrawal'}
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
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden my-8">
                {/* Header */}
                <div className="bg-gradient-to-r from-red-600 to-orange-600 p-6 text-white relative">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-2xl font-black flex items-center gap-3">
                                <div className="p-3 bg-white/20 rounded-2xl shadow-lg">
                                    <FaMoneyBillWave />
                                </div>
                                Process Withdrawal
                            </h3>
                            <p className="text-xs text-white/80 mt-1">
                                High-risk operation - Balance will be reduced immediately
                            </p>
                        </div>
                        <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl transition-all">
                            <FaTimes size={20} />
                        </button>
                    </div>
                </div>

                {/* Member Info Banner */}
                {member && (
                    <div className="bg-gray-50 p-4 border-b">
                        <div className="flex justify-between items-center">
                            <div>
                                <div className="font-black text-gray-800">{member.name}</div>
                                <div className="text-xs text-gray-500">{groupName} • {member.phone}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-gray-500 uppercase font-bold">Available Balance</div>
                                <div className="text-xl font-black text-green-600">
                                    KES {(member.savings || member.savings_balance || 0).toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleProceedToConfirm} className="p-8">
                    <div className="space-y-6">
                        {/* Amount Input */}
                        <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-2xl border-2 border-gray-200">
                            <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-4 text-center">
                                Withdrawal Amount (KES) *
                            </label>
                            <input
                                required
                                type="number"
                                min="100"
                                step="0.01"
                                disabled={!hasMeeting}
                                className="w-full bg-transparent text-5xl font-black text-gray-900 text-center outline-none placeholder:text-gray-200 disabled:opacity-50"
                                placeholder="0"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                            {isValidating && (
                                <p className="text-center text-xs text-blue-500 mt-2 animate-pulse">
                                    Validating...
                                </p>
                            )}
                        </div>

                        {/* Validation Errors */}
                        {validationErrors.length > 0 && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl">
                                {validationErrors.map((err, i) => (
                                    <p key={i} className="text-xs text-red-800 font-bold flex items-center gap-2">
                                        <FaExclamationTriangle /> {err}
                                    </p>
                                ))}
                            </div>
                        )}

                        {/* Preview */}
                        {preview && (
                            <div className="bg-gradient-to-br from-orange-50 to-red-50 p-5 rounded-2xl border-2 border-orange-200">
                                <h4 className="text-xs font-black text-orange-900 uppercase flex items-center gap-2 mb-4">
                                    <FaShieldAlt /> Financial Impact Preview
                                </h4>
                                <div className="space-y-3">
                                    <PreviewRow
                                        label="Savings Balance"
                                        before={preview.savings_before}
                                        after={preview.savings_after}
                                        isDecrease
                                    />
                                    <PreviewRow
                                        label="Risk Score"
                                        before={preview.risk_score_before}
                                        after={preview.risk_score_after}
                                        isDecrease={false}
                                        isRisk
                                    />
                                    <div className="bg-white p-3 rounded-xl">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-500 font-bold">Reserve Held (10%)</span>
                                            <span className="font-black text-gray-700">
                                                KES {preview.reserve_held.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Reason */}
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">
                                Reason (Optional)
                            </label>
                            <input
                                type="text"
                                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                                placeholder="e.g., Emergency, School fees, Medical..."
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={!hasMeeting || validationErrors.length > 0 || !preview || isValidating}
                            className="w-full py-5 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 text-lg"
                        >
                            {hasMeeting ? (
                                validationErrors.length > 0 ? (
                                    <>
                                        <FaLock /> Cannot Withdraw
                                    </>
                                ) : (
                                    <>
                                        <FaCheckCircle /> Review & Confirm
                                    </>
                                )
                            ) : (
                                <>
                                    <FaLock /> Meeting Required
                                </>
                            )}
                        </button>

                        {!hasMeeting && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl">
                                <p className="text-xs text-red-800 font-bold flex items-center gap-2">
                                    <FaInfoCircle /> Withdrawals require an active meeting session
                                </p>
                            </div>
                        )}
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
        <span className={`font-black ${highlight ? 'text-2xl text-red-600' : 'text-sm text-gray-900'}`}>
            {value}
        </span>
    </div>
);

const PreviewRow = ({ label, before, after, isDecrease, isRisk }) => (
    <div className="bg-white p-4 rounded-xl border-2 border-gray-200">
        <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-500 uppercase">{label}</span>
            <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                    {isRisk ? before : `KES ${before.toLocaleString()}`}
                </span>
                <span className="text-gray-400">→</span>
                <span className={`text-sm font-black ${isDecrease ? 'text-red-600' : isRisk ? 'text-yellow-600' : 'text-green-600'}`}>
                    {isRisk ? after : `KES ${after.toLocaleString()}`}
                </span>
            </div>
        </div>
    </div>
);

export default WithdrawalModal;
