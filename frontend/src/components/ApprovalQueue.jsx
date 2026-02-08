// Approval Queue Component (Admin Only)
// Shows pending top-up requests that need admin authorization
// Admins can approve (credits TRF) or reject requests

import React from 'react';
import { FaCircleCheck } from 'react-icons/fa6';

const ApprovalQueue = ({ pendingRequests, loading, onApprove, onReject }) => {
    return (
        <div className="p-6 md:p-10">
            <div className="text-center mb-10">
                <div className="inline-flex p-5 bg-green-100 rounded-3xl text-green-600 mb-4 shadow-inner">
                    <FaCircleCheck size={48} />
                </div>
                <h2 className="text-3xl font-black text-gray-800 tracking-tight">Top-Up Approval Queue</h2>
                <p className="text-gray-500 font-medium mt-2">Review and authorize pending top-up requests (Admin Only).</p>
            </div>

            {pendingRequests.length === 0 ? (
                <div className="text-center py-16">
                    <div className="text-8xl mb-4">📭</div>
                    <p className="text-gray-400 font-black uppercase">No Pending Requests</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {pendingRequests.map((req) => (
                        <div key={req.id} className="bg-white border-2 border-gray-100 rounded-3xl p-6 hover:shadow-xl transition-all">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                        <h3 className="text-xl font-black text-gray-900">{req.group_name}</h3>
                                        <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-[10px] font-black uppercase">Pending</span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Commitment</p>
                                            <p className="text-lg font-black text-blue-600">KES {req.commitment_amount.toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Top-Up (5x)</p>
                                            <p className="text-lg font-black text-green-600">KES {req.topup_amount.toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Requested By</p>
                                            <p className="text-sm font-bold text-gray-700">{req.requested_by_name}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Date</p>
                                            <p className="text-sm font-bold text-gray-700">{new Date(req.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    {req.notes && (
                                        <p className="text-xs text-gray-500 italic mt-3 bg-gray-50 p-3 rounded-xl">&quot;{req.notes}&quot;</p>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => onApprove(req.id)}
                                        disabled={loading}
                                        className="px-6 py-3 bg-green-600 text-white rounded-xl font-black shadow-lg hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        ✅ APPROVE
                                    </button>
                                    <button
                                        onClick={() => onReject(req.id)}
                                        disabled={loading}
                                        className="px-6 py-3 bg-red-600 text-white rounded-xl font-black shadow-lg hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        ❌ REJECT
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ApprovalQueue;
