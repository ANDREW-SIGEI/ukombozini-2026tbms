import React, { useState } from 'react';
import { FaTimes, FaExclamationTriangle } from 'react-icons/fa';
import { toast } from 'react-toastify';

const STLLoanModal = ({ isOpen, onClose, member, onSuccess }) => {
    const [loanData, setLoanData] = useState({
        amount: '',
        purpose: '',
        duration_months: 1,
        interest_rate: 10
    });

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!loanData.amount || parseFloat(loanData.amount) <= 0) {
            toast.error('Please enter a valid loan amount');
            return;
        }

        try {
            const payload = {
                member_id: member.id,
                loan_type: 'STL',
                principal_amount: parseFloat(loanData.amount),
                interest_rate: parseFloat(loanData.interest_rate),
                duration_months: parseInt(loanData.duration_months),
                purpose: loanData.purpose,
                approved_by: 1, // Replace with actual user ID
                disbursed_by: 1
            };

            const res = await fetch('http://localhost:5000/api/loans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to issue loan');
            }

            const newLoan = await res.json();
            toast.success(`STL of KES ${parseFloat(loanData.amount).toLocaleString()} issued successfully!`);

            if (onSuccess) {
                onSuccess(newLoan);
            }

            setLoanData({
                amount: '',
                purpose: '',
                duration_months: 1,
                interest_rate: 10
            });
            onClose();
        } catch (error) {
            toast.error(error.message);
        }
    };

    if (!isOpen || !member) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 rounded-t-2xl text-white">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-2xl font-black mb-2">Issue Short-Term Loan (STL)</h3>
                            <p className="text-purple-100 text-sm font-medium">
                                Member: {member.name} • {member.phone}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <FaTimes className="text-xl" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Member Info Card */}
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border-2 border-purple-200">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-purple-600 font-bold text-xs uppercase">Current Savings</p>
                                <p className="text-xl font-black text-purple-900">KES {member.savings?.toLocaleString() || 0}</p>
                            </div>
                            <div>
                                <p className="text-purple-600 font-bold text-xs uppercase">Active Loans</p>
                                <p className="text-xl font-black text-purple-900">KES {member.activeLoans?.toLocaleString() || 0}</p>
                            </div>
                        </div>
                    </div>

                    {/* Loan Amount */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Loan Amount (KES) *
                        </label>
                        <input
                            type="number"
                            min="1"
                            step="0.01"
                            required
                            value={loanData.amount}
                            onChange={(e) => setLoanData({ ...loanData, amount: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-mono text-lg"
                            placeholder="0.00"
                        />
                    </div>

                    {/* Duration */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Duration (Months) *
                        </label>
                        <select
                            value={loanData.duration_months}
                            onChange={(e) => setLoanData({ ...loanData, duration_months: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-bold"
                        >
                            {[1, 2, 3, 6].map(month => (
                                <option key={month} value={month}>{month} Month{month > 1 ? 's' : ''}</option>
                            ))}
                        </select>
                    </div>

                    {/* Interest Rate */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Interest Rate (%) *
                        </label>
                        <input
                            type="number"
                            min="0"
                            step="0.1"
                            required
                            value={loanData.interest_rate}
                            onChange={(e) => setLoanData({ ...loanData, interest_rate: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-mono"
                            placeholder="10.0"
                        />
                    </div>

                    {/* Purpose */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Purpose
                        </label>
                        <textarea
                            rows="3"
                            value={loanData.purpose}
                            onChange={(e) => setLoanData({ ...loanData, purpose: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                            placeholder="Enter loan purpose..."
                        />
                    </div>

                    {/* Warning */}
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                        <div className="flex items-start gap-3">
                            <FaExclamationTriangle className="text-yellow-600 mt-1" />
                            <div className="text-sm text-yellow-800">
                                <p className="font-bold mb-1">Short-Term Loan Notice</p>
                                <p className="text-xs">
                                    This loan must be repaid within {loanData.duration_months} month{loanData.duration_months > 1 ? 's' : ''}.
                                    Ensure the member can afford the repayment schedule.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-black hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg shadow-purple-900/20"
                        >
                            Issue STL
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default STLLoanModal;
