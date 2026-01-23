import React, { useState, useEffect } from 'react';
import {
    FaArrowDown, FaArrowUp, FaBalanceScale, FaCheckCircle,
    FaExclamationCircle, FaPrint, FaLock, FaUsers,
    FaMoneyBillWave, FaCoins, FaHistory, FaHandHoldingUsd, FaUnlock
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../services/api';

const MeetingLedger = ({ sessionId, onClose }) => {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        fetchSummary();
    }, [sessionId]);

    const fetchSummary = async () => {
        setLoading(true);
        try {
            const res = await fetch(`http://localhost:5000/api/sessions/${sessionId}/summary`);
            const data = await res.json();
            setSummary(data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load session ledger");
        } finally {
            setLoading(false);
        }
    };

    const handleCloseSession = async () => {
        if (summary.net_cash !== 0) {
            toast.warning("Table does not balance! Please verify all cash inflows and outflows.");
            return;
        }

        setIsClosing(true);
        try {
            await api.closeMeeting(sessionId, {
                totalContributions: summary.breakdown.total_savings,
                totalLoanDisbursements: summary.breakdown.total_loans_issued,
                totalRepayments: summary.breakdown.total_stl_repayment + summary.breakdown.total_ltl_repayment
            });
            toast.success("✅ Meeting Session Balanced and Locked!");
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Failed to close session");
        } finally {
            setIsClosing(false);
        }
    };

    if (loading) return <div className="p-8 text-center font-bold text-gray-500 animate-pulse">Calculating Ledger Balances...</div>;

    const { breakdown, total_inflow, total_outflow, net_cash } = summary;

    return (
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-5xl w-full mx-auto border border-gray-100 animate-in fade-in zoom-in duration-300">
            {/* Header */}
            <div className="bg-gradient-to-r from-safaricom-green to-green-700 p-8 text-white relative">
                <div className="flex justify-between items-start relative z-10">
                    <div>
                        <h2 className="text-3xl font-black mb-1">Meeting Financial Ledger</h2>
                        <p className="text-green-100 font-bold opacity-80 uppercase tracking-widest text-xs">Session ID: #{sessionId}</p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-md p-4 rounded-2xl text-right">
                        <p className="text-[10px] font-black uppercase opacity-60">Status</p>
                        <p className="text-xl font-black flex items-center gap-2">
                            <FaUnlock className="text-sm" /> ACTIVE
                        </p>
                    </div>
                </div>
                {/* Decorative background circle */}
                <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
            </div>

            <div className="p-8">
                {/* Balance Card */}
                <div className={`mb-8 p-6 rounded-3xl border-2 flex flex-col md:flex-row items-center justify-between gap-6 ${net_cash === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl ${net_cash === 0 ? 'bg-safaricom-green text-white' : 'bg-red-500 text-white'}`}>
                            {net_cash === 0 ? <FaCheckCircle /> : <FaExclamationCircle />}
                        </div>
                        <div>
                            <h3 className={`text-xl font-black ${net_cash === 0 ? 'text-safaricom-green' : 'text-red-600'}`}>
                                {net_cash === 0 ? "Table Balanced" : "Table Variance Detected"}
                            </h3>
                            <p className="text-gray-500 font-bold text-sm">
                                {net_cash === 0 ? "Every shilling is accounted for." : "The total inflows do not match total outflows."}
                            </p>
                        </div>
                    </div>
                    <div className="text-center md:text-right">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Net Position</p>
                        <p className={`text-4xl font-black ${net_cash === 0 ? 'text-safaricom-green' : 'text-red-600'}`}>
                            KES {net_cash.toLocaleString()}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* INFLOWS */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <FaArrowDown className="text-blue-500" /> Cash Inflows (Collected)
                        </h4>
                        <div className="bg-gray-50 rounded-2xl p-6 space-y-4 border border-gray-100">
                            {[
                                { label: 'Member Savings', value: breakdown.total_savings, icon: <FaCoins />, color: 'text-green-600' },
                                { label: 'STL Repayments', value: breakdown.total_stl_repayment, icon: <FaMoneyBillWave />, color: 'text-blue-600' },
                                { label: 'LTL Repayments', value: breakdown.total_ltl_repayment, icon: <FaHistory />, color: 'text-purple-600' },
                                { label: 'Interest & Fees', value: breakdown.total_interest, icon: <FaBalanceScale />, color: 'text-orange-600' },
                                { label: 'Fines & Penalties', value: breakdown.total_fines, icon: <FaExclamationCircle />, color: 'text-red-500' },
                            ].map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-3">
                                        <div className={`${item.color} bg-white w-8 h-8 rounded-lg shadow-sm flex items-center justify-center`}>
                                            {item.icon}
                                        </div>
                                        <span className="font-bold text-gray-700">{item.label}</span>
                                    </div>
                                    <span className="font-black text-gray-900">KES {item.value.toLocaleString()}</span>
                                </div>
                            ))}
                            <div className="pt-4 border-t border-gray-200 flex justify-between items-center">
                                <span className="font-black text-gray-800">TOTAL INFLOW</span>
                                <span className="text-xl font-black text-blue-600 underline">KES {total_inflow.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* OUTFLOWS */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <FaArrowUp className="text-red-500" /> Cash Outflows (Disbursed)
                        </h4>
                        <div className="bg-gray-50 rounded-2xl p-6 space-y-4 border border-gray-100">
                            {[
                                { label: 'Withdrawals Paid', value: breakdown.total_withdrawals, icon: <FaMoneyBillWave />, color: 'text-red-500' },
                                { label: 'Loans Issued (STL)', value: breakdown.total_loans_issued, icon: <FaHandHoldingUsd />, color: 'text-orange-500' },
                            ].map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-3">
                                        <div className={`${item.color} bg-white w-8 h-8 rounded-lg shadow-sm flex items-center justify-center`}>
                                            {item.icon}
                                        </div>
                                        <span className="font-bold text-gray-700">{item.label}</span>
                                    </div>
                                    <span className="font-black text-gray-900">KES {item.value.toLocaleString()}</span>
                                </div>
                            ))}
                            <div className="h-[148px]"></div> {/* Spacer to level with Inflows */}
                            <div className="pt-4 border-t border-gray-200 flex justify-between items-center">
                                <span className="font-black text-gray-800">TOTAL OUTFLOW</span>
                                <span className="text-xl font-black text-red-600 underline">KES {total_outflow.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-12 flex gap-4">
                    <button
                        onClick={() => window.print()}
                        className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                    >
                        <FaPrint /> Print Report
                    </button>
                    <button
                        onClick={handleCloseSession}
                        disabled={isClosing || net_cash !== 0}
                        className={`flex-[2] py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-xl ${net_cash === 0 && !isClosing
                            ? 'bg-safaricom-green text-white hover:bg-safaricom-dark active:scale-95'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                            }`}
                    >
                        {isClosing ? 'LOKING SESSION...' : <><FaLock /> Sync & Close Session</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MeetingLedger;
