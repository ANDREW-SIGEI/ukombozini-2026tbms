import React, { useState, useEffect } from 'react';
import { FaBalanceScale, FaArrowCircleUp, FaArrowCircleDown, FaLock, FaUnlock, FaCheckCircle, FaExclamationTriangle, FaFilePdf, FaHistory } from 'react-icons/fa';
import { mockGroups, mockLedgerEntries } from '../data/mockData';
import { toast } from 'react-toastify';

const Reconciliation = () => {
    const [isLocked, setIsLocked] = useState(false);
    const [physicalCash, setPhysicalCash] = useState('');
    const [mobileMoney, setMobileMoney] = useState('');
    const [bankDeposit, setBankDeposit] = useState('');

    // System Totals (Mocked logic)
    const openingBalance = mockGroups[0].openingBalance;
    const cashIn = mockLedgerEntries
        .filter(e => e.type === 'Credit')
        .reduce((acc, curr) => acc + curr.amount, 0);
    const cashOut = mockLedgerEntries
        .filter(e => e.type === 'Debit')
        .reduce((acc, curr) => acc + curr.amount, 0);

    const expectedClosing = openingBalance + cashIn - cashOut;
    const declaredTotal = (parseFloat(physicalCash) || 0) + (parseFloat(mobileMoney) || 0) + (parseFloat(bankDeposit) || 0);
    const variance = declaredTotal - expectedClosing;
    const isBalanced = Math.abs(variance) < 1;

    const handleApprove = () => {
        if (!isBalanced) {
            toast.error("Cannot approve with variance. Please resolve discrepancies first.");
            return;
        }
        setIsLocked(true);
        toast.success("Daily Report Approved & Locked Successfully!");
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-20">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                        <FaBalanceScale className="text-safaricom-green" />
                        Daily Reconciliation
                    </h2>
                    <p className="text-gray-500 font-medium">Victory Women Group • Jan 10, 2026</p>
                </div>
                <div className={`px-4 py-2 rounded-full flex items-center gap-2 font-bold text-sm ${isLocked ? 'bg-gray-100 text-gray-500' :
                        isBalanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                    {isLocked ? <FaLock /> : isBalanced ? <FaCheckCircle /> : <FaExclamationTriangle />}
                    {isLocked ? 'LOCKED' : isBalanced ? 'BALANCED' : 'VARIANCE DETECTED'}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: System Summary */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <FaBalanceScale size={80} />
                        </div>
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">System Totals (Read-Only)</h3>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                <span className="text-gray-500 font-medium text-sm">Opening Balance</span>
                                <span className="font-bold text-gray-900">KES {openingBalance.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                <span className="text-gray-500 font-medium text-sm">Total Cash In (Today)</span>
                                <span className="font-bold text-green-600">+ KES {cashIn.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                <span className="text-gray-500 font-medium text-sm">Total Cash Out (Today)</span>
                                <span className="font-bold text-red-600">- KES {cashOut.toLocaleString()}</span>
                            </div>
                            <div className="pt-4">
                                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Expected Closing</p>
                                <p className="text-4xl font-black text-gray-900">KES {expectedClosing.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    {!isLocked && (
                        <div className="p-6 bg-safaricom-dark text-white rounded-3xl space-y-4">
                            <div className="flex items-center gap-2 text-yellow-400">
                                <FaExclamationTriangle />
                                <span className="text-xs font-bold tracking-wider uppercase">Audit Security</span>
                            </div>
                            <p className="text-sm opacity-80 leading-relaxed font-medium">
                                Approval will finalize all member ledgers for today. No reversals are possible without Admin credentials.
                            </p>
                        </div>
                    )}
                </div>

                {/* Center & Right: Inputs & Comparison */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Declaration Form */}
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Officer Physical Declaration</h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-500">Physical Cash Counted</label>
                                <input
                                    disabled={isLocked}
                                    type="number"
                                    className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-safaricom-green/20 outline-none font-bold text-lg"
                                    placeholder="0"
                                    value={physicalCash}
                                    onChange={(e) => setPhysicalCash(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-500">Mobile Money Balance</label>
                                <input
                                    disabled={isLocked}
                                    type="number"
                                    className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-safaricom-green/20 outline-none font-bold text-lg"
                                    placeholder="0"
                                    value={mobileMoney}
                                    onChange={(e) => setMobileMoney(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-500">Other / Bank Deposit</label>
                                <input
                                    disabled={isLocked}
                                    type="number"
                                    className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-safaricom-green/20 outline-none font-bold text-lg"
                                    placeholder="0"
                                    value={bankDeposit}
                                    onChange={(e) => setBankDeposit(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Comparison Result */}
                        <div className={`mt-8 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${isBalanced ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'
                            }`}>
                            <div className="space-y-1">
                                <p className="text-xs font-bold uppercase tracking-wider opacity-60">Reconciliation Status</p>
                                <p className={`text-2xl font-black ${isBalanced ? 'text-green-700' : 'text-red-700'}`}>
                                    {isBalanced ? 'Matched Successfully' : 'Variance Detected'}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold uppercase tracking-wider opacity-60">Difference</p>
                                <p className={`text-2xl font-black ${isBalanced ? 'text-green-700' : 'text-red-700'}`}>
                                    {variance > 0 ? '+' : ''} KES {variance.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Discrepancy Breakdown Table (Only if variance) */}
                    {!isBalanced && (
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-red-200 overflow-hidden">
                            <h3 className="text-xs font-black text-red-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <FaExclamationTriangle /> Potential Discrepancies
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-xs text-gray-400 font-black uppercase">
                                            <th className="pb-4">Transaction Source</th>
                                            <th className="pb-4">Reference</th>
                                            <th className="pb-4 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        <tr className="text-sm font-medium">
                                            <td className="py-4 text-gray-600">Short-Term Loan Payout</td>
                                            <td className="py-4 text-gray-400">L-001</td>
                                            <td className="py-4 text-right text-gray-900 font-bold">KES 50,000</td>
                                        </tr>
                                        <tr className="text-sm font-medium">
                                            <td className="py-4 text-gray-600">Member Savings Entry</td>
                                            <td className="py-4 text-gray-400">TRX-101</td>
                                            <td className="py-4 text-right text-gray-900 font-bold">KES 5,000</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Final Actions */}
                    <div className="flex gap-4">
                        <button
                            onClick={handleApprove}
                            disabled={isLocked || !isBalanced}
                            className={`flex-1 py-4 px-8 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all ${isLocked ? 'bg-gray-100 text-gray-400' :
                                    !isBalanced ? 'bg-gray-50 text-gray-300' :
                                        'bg-safaricom-green hover:bg-safaricom-dark text-white shadow-xl shadow-green-900/20'
                                }`}
                        >
                            {isLocked ? <FaLock /> : <FaCheckCircle />}
                            {isLocked ? 'Ledger Approved & Locked' : 'Approve & Lock Daily Report'}
                        </button>
                        {isLocked && (
                            <button className="py-4 px-8 bg-black text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-gray-900 transition-all">
                                <FaFilePdf /> Export Cashbook
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reconciliation;
