import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { FaUndo, FaCheckCircle, FaTimesCircle, FaShieldAlt, FaHistory, FaSearch } from 'react-icons/fa';

const ReversalCenter = () => {
    const { user, isAuditor } = useAuth();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const data = await api.getReversalRequests();
            setRequests(data || []);

            // Calculate stats
            const s = { pending: 0, approved: 0, rejected: 0 };
            data.forEach(r => {
                if (r.status === 'PENDING') s.pending++;
                else if (r.status === 'APPROVED') s.approved++;
                else if (r.status === 'REJECTED') s.rejected++;
            });
            setStats(s);
        } catch (err) {
            console.error("Fetch Reversals Error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id) => {
        if (!window.confirm("CONFIRM APPROVAL: Are you sure you want to reverse this transaction and adjust institutional balances?")) return;

        setLoading(true);
        try {
            const res = await api.approveReversal(id);
            if (res.success) {
                toast.success("Transaction Reversed Successfully");
                fetchRequests();
            }
        } catch (err) {
            console.error("Approval Error:", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            {/* GOVERNANCE WATERMARK */}
            <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-30deg)', fontSize: '10rem', color: 'rgba(0,0,0,0.02)', fontWeight: 900, pointerEvents: 'none', zIndex: 0, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Operational Security
            </div>

            <div className="max-w-7xl mx-auto relative z-10">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                            <FaUndo className="text-orange-500" />
                            Institutional Reversal Center
                        </h1>
                        <p className="text-gray-500 font-medium mt-1">Dual-Control Audit & Transaction Correction Hub</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="bg-white p-4 px-6 rounded-2xl shadow-sm border border-gray-100 text-center">
                            <p className="text-[10px] font-black uppercase text-orange-400 tracking-widest">Pending</p>
                            <p className="text-xl font-black text-gray-900">{stats.pending}</p>
                        </div>
                        <div className="bg-white p-4 px-6 rounded-2xl shadow-sm border border-gray-100 text-center">
                            <p className="text-[10px] font-black uppercase text-green-400 tracking-widest">Approved</p>
                            <p className="text-xl font-black text-gray-900">{stats.approved}</p>
                        </div>
                    </div>
                </div>

                {/* SECURITY ALERT */}
                <div className="bg-orange-50 border border-orange-100 p-6 rounded-2xl mb-8 flex items-start gap-4">
                    <div className="bg-orange-500 text-white p-3 rounded-xl shadow-lg shadow-orange-500/20">
                        <FaShieldAlt size={20} />
                    </div>
                    <div>
                        <h3 className="text-orange-900 font-black uppercase text-xs tracking-widest mb-1">Dual-Control Protocol</h3>
                        <p className="text-orange-700 text-sm font-medium">Any reversal approved here will atomically adjust member balances, daily cash totals, and trigger a re-calculation of the associated Monthly Institutional Report. All actions are logged and permanently tied to your profile.</p>
                    </div>
                </div>

                {/* REQUESTS LIST */}
                <div className="bg-white rounded-3xl shadow-xl shadow-black/5 overflow-hidden border border-gray-100">
                    <div className="p-6 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-black text-gray-600 uppercase text-xs tracking-widest flex items-center gap-2">
                            <FaHistory /> Correction Audit Trail
                        </h3>
                        <button onClick={fetchRequests} className="text-safaricom-green font-bold text-xs uppercase tracking-widest hover:underline">Refresh Queue</button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50">
                                <tr>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Transaction Info</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Member/Group</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Reason for Correction</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Requester</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading && requests.length === 0 ? (
                                    <tr><td colSpan="6" className="p-20 text-center text-gray-400 font-bold uppercase tracking-widest animate-pulse">Syncing with Security Layer...</td></tr>
                                ) : requests.length === 0 ? (
                                    <tr><td colSpan="6" className="p-20 text-center text-gray-400 font-medium">No pending reversal requests in the queue.</td></tr>
                                ) : (
                                    requests.map((r) => (
                                        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-8 py-6">
                                                <div className="font-black text-gray-900">{r.transaction_type}</div>
                                                <div className="text-[10px] font-medium text-gray-400 uppercase tracking-widest truncate w-32">{r.transaction_id}</div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="font-bold text-gray-800">{r.member_name}</div>
                                                <div className="text-[10px] font-black text-safaricom-green uppercase tracking-tighter">ID: {r.memberId}</div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="text-gray-600 bg-gray-50 p-2 px-3 rounded-lg border border-gray-100 text-xs italic">
                                                    "{r.reason}"
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap">
                                                <div className="font-bold text-gray-700">{r.requester_name}</div>
                                                <div className="text-[10px] text-gray-400">{new Date(r.created_at).toLocaleString()}</div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${r.status === 'PENDING' ? 'bg-orange-100 text-orange-700' :
                                                        r.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {r.status}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                {r.status === 'PENDING' && (
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleApprove(r.id)}
                                                            className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 shadow-md shadow-green-500/20 transition-all"
                                                            title="Authorize Reversal"
                                                        >
                                                            <FaCheckCircle />
                                                        </button>
                                                        <button
                                                            className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 shadow-md shadow-red-500/20 transition-all"
                                                            title="Reject Request"
                                                        >
                                                            <FaTimesCircle />
                                                        </button>
                                                    </div>
                                                )}
                                                {r.status === 'APPROVED' && (
                                                    <span className="text-gray-300"><FaCheckCircle size={20} /></span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReversalCenter;
