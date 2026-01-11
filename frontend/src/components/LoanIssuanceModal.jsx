import React, { useState, useEffect } from 'react';
import { FaTimes, FaHandHoldingUsd, FaCalculator, FaCalendarAlt, FaPercentage, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { toast } from 'react-toastify';

const LoanIssuanceModal = ({ isOpen, onClose, member, onSuccess }) => {
    const [loanAmount, setLoanAmount] = useState('');
    const [duration, setDuration] = useState('6');
    const [interestRate, setInterestRate] = useState('2');
    const [repaymentPreview, setRepaymentPreview] = useState(null);

    const maxLoan = member ? member.balance * 3 : 0;

    useEffect(() => {
        if (loanAmount && duration && interestRate) {
            const principal = parseFloat(loanAmount);
            const months = parseInt(duration);
            const rate = parseFloat(interestRate) / 100;

            const totalInterest = principal * rate * months;
            const totalRepayable = principal + totalInterest;
            const monthlyRepayment = totalRepayable / months;

            setRepaymentPreview({
                principal,
                totalInterest,
                totalRepayable,
                monthlyRepayment
            });
        } else {
            setRepaymentPreview(null);
        }
    }, [loanAmount, duration, interestRate]);

    if (!isOpen || !member) return null;

    const handleSubmit = (e) => {
        e.preventDefault();

        if (parseFloat(loanAmount) > maxLoan) {
            toast.error(`Loan amount exceeds limit! Max possible: KES ${maxLoan.toLocaleString()}`);
            return;
        }

        const loanData = {
            id: `L-NEW-${Math.floor(1000 + Math.random() * 9000)}`,
            memberName: member.name,
            amount: parseFloat(loanAmount),
            interest: repaymentPreview?.totalInterest,
            dueDate: new Date(new Date().setMonth(new Date().getMonth() + parseInt(duration))).toISOString().split('T')[0],
            status: 'Active'
        };

        toast.success(`Loan of KES ${parseFloat(loanAmount).toLocaleString()} issued to ${member.name}`);
        onSuccess(loanData);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="bg-safaricom-green p-6 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-white/20 rounded-xl">
                            <FaHandHoldingUsd size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">Issue New Loan</h3>
                            <p className="text-xs opacity-80">Finalizing disbursement for {member.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="hover:rotate-90 transition-transform p-2">
                        <FaTimes size={20} />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-x divide-gray-100">
                    {/* Form Side */}
                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Member Details</label>
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-safaricom-green/10 text-safaricom-green flex items-center justify-center font-bold">
                                        {member.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">{member.name}</p>
                                        <p className="text-[10px] text-gray-400">Balance: KES {member.balance.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Loan Amount (KES)</label>
                                    <span className="text-[10px] font-bold text-safaricom-dark bg-safaricom-green/10 px-2 py-0.5 rounded">Limit: 3x Savings</span>
                                </div>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">KES</span>
                                    <input
                                        required
                                        type="number"
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none transition-all font-bold text-gray-900"
                                        placeholder="0.00"
                                        value={loanAmount}
                                        onChange={(e) => setLoanAmount(e.target.value)}
                                        max={maxLoan}
                                    />
                                </div>
                                {parseFloat(loanAmount) > 0 && (
                                    <p className={`text-[10px] mt-1 font-bold ${parseFloat(loanAmount) > maxLoan ? 'text-red-500' : 'text-gray-400'}`}>
                                        Max possible: KES {maxLoan.toLocaleString()}
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Duration</label>
                                    <select
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none transition-all"
                                        value={duration}
                                        onChange={(e) => setDuration(e.target.value)}
                                    >
                                        <option value="1">1 Month</option>
                                        <option value="3">3 Months</option>
                                        <option value="6">6 Months</option>
                                        <option value="12">12 Months</option>
                                        <option value="24">24 Months</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Interest (% p.m.)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none transition-all"
                                        value={interestRate}
                                        onChange={(e) => setInterestRate(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={!loanAmount || parseFloat(loanAmount) > maxLoan}
                            className="w-full py-4 bg-safaricom-green hover:bg-safaricom-dark text-white font-bold rounded-2xl shadow-xl shadow-green-900/20 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <FaCheckCircle />
                            Confirm & Disburse Loan
                        </button>
                    </form>

                    {/* Preview Side */}
                    <div className="bg-gray-50/50 p-8 flex flex-col justify-between">
                        <div>
                            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-6">
                                <FaCalculator className="text-safaricom-green" />
                                Repayment Summary
                            </h4>

                            {repaymentPreview ? (
                                <div className="space-y-6">
                                    <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-4">
                                        <div className="flex justify-between items-center pb-4 border-b border-gray-50">
                                            <span className="text-xs text-gray-500 font-medium">Monthly Repayment</span>
                                            <span className="text-xl font-black text-safaricom-dark">
                                                KES {repaymentPreview.monthlyRepayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </span>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-gray-400">Principal</span>
                                                <span className="font-bold text-gray-700">KES {repaymentPreview.principal.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-gray-400">Total Interest ({interestRate}% p.m.)</span>
                                                <span className="font-bold text-gray-700">KES {repaymentPreview.totalInterest.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-xs pt-2 border-t border-gray-50">
                                                <span className="text-gray-900 font-bold">Total Repayable</span>
                                                <span className="font-black text-gray-900">KES {repaymentPreview.totalRepayable.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 text-[10px] items-start p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-100">
                                        <FaExclamationTriangle className="mt-0.5 shrink-0" />
                                        <p className="font-medium leading-relaxed">
                                            By disbursing this loan, you confirm that the member has signed the agreement and group guarantors are verified.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-48 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-2xl">
                                    <FaCalculator size={32} className="mb-2 opacity-20" />
                                    <p className="text-xs font-bold uppercase tracking-widest">Enter details to calculate</p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                <FaCalendarAlt className="text-safaricom-green" />
                                Repayment Schedule
                            </div>
                            <p className="text-xs text-gray-500">
                                First repayment due on: <span className="font-bold text-gray-800">
                                    {new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoanIssuanceModal;
