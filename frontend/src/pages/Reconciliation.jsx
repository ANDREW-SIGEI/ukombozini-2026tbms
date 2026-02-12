import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaScaleBalanced, FaCircleCheck, FaTriangleExclamation, FaChartLine, FaUsers, FaArrowRight, FaClock } from 'react-icons/fa6';
import { useTransactions } from '../context/TransactionContext';
import { api } from '../services/api';

const Reconciliation = () => {
    const { sessions, groups } = useTransactions();
    const [auditSnapshots, setAuditSnapshots] = useState({});

    // Fetch snapshots for each group to check variance
    useEffect(() => {
        const fetchSnapshots = async () => {
            const today = new Date().toISOString().split('T')[0];
            const snapshots = {};
            for (const group of groups) {
                try {
                    const data = await api.getAuditSnapshot(today, group.id);
                    // Sum up the balances for the group
                    const groupTotal = data.reduce((sum, member) => sum + member.historical_savings + member.historical_project + member.historical_loan_balance, 0);
                    snapshots[group.id] = groupTotal;
                } catch (err) {
                    console.error(`Snapshot failed for group ${group.id}`, err);
                }
            }
            setAuditSnapshots(snapshots);
        };
        if (groups.length > 0) fetchSnapshots();
    }, [groups]);

    // 1. DATA AGGREGATION ENGINE (Director Level)
    const systemOverview = useMemo(() => {
        let totalCashCollected = 0;
        let totalSessionsPosted = 0;
        let criticalFlags = 0;

        const groupStatusMap = groups.map(group => {
            const groupSessions = sessions.filter(s => s.groupId === group.id || s.group_id === group.id);
            const latestSession = groupSessions[0];

            const lastPostDate = latestSession ? new Date(latestSession.date || latestSession.created_at) : null;
            const isStale = lastPostDate ? (new Date() - lastPostDate) > (7 * 24 * 60 * 60 * 1000) : true;

            if (latestSession) {
                totalCashCollected += (latestSession.totals?.total_cash_in || latestSession.total_contributions || 0);
                if (latestSession.status === 'POSTED') {
                    totalSessionsPosted++;
                }

                const bal = latestSession.closingBalance || latestSession.closing_balance || 0;
                if (bal < 0) criticalFlags++;

                // Variance check: Compare session closing balance with reconstructed ledger
                const snapshotBalance = auditSnapshots[group.id];
                const hasVariance = snapshotBalance !== undefined && Math.abs(snapshotBalance - bal) > 1;

                return {
                    ...group,
                    status: latestSession.status || 'POSTED',
                    lastUpdate: latestSession.date || latestSession.created_at,
                    cashIn: latestSession.totals?.total_cash_in || latestSession.total_contributions || 0,
                    closingBalance: bal,
                    hasError: bal < 0,
                    isStale: isStale,
                    hasVariance: hasVariance,
                    varianceAmount: snapshotBalance ? (snapshotBalance - bal) : 0
                };
            }

            return {
                ...group,
                status: 'PENDING',
                lastUpdate: '-',
                cashIn: 0,
                closingBalance: group.openingBalance || 0,
                hasError: false,
                isStale: true,
                hasVariance: false
            };
        });

        return {
            totalCashCollected,
            totalSessionsPosted,
            criticalFlags,
            groupRows: groupStatusMap
        };
    }, [sessions, groups, auditSnapshots]);

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-20 p-6">
            {/* HEADER SECTION */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                        <FaScaleBalanced className="text-blue-600" />
                        Director Reconciliation Board
                    </h2>
                    <p className="text-gray-500 font-medium mt-1">System-Wide Financial Health • {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                </div>
                <div className="mt-4 md:mt-0 flex gap-2">
                    <div className="px-6 py-2 bg-gray-900 text-white rounded-full font-bold text-sm tracking-wide shadow-lg uppercase">
                        Ledger Integrity: Active
                    </div>
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="p-4 bg-green-100 text-green-700 rounded-xl">
                        <FaChartLine size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Cash Collected</p>
                        <p className="text-2xl font-black text-gray-900">KES {systemOverview.totalCashCollected.toLocaleString()}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="p-4 bg-blue-100 text-blue-700 rounded-xl">
                        <FaUsers size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Groups Posted</p>
                        <p className="text-2xl font-black text-gray-900">
                            {systemOverview.totalSessionsPosted} <span className="text-gray-400 text-lg font-medium">/ {groups.length}</span>
                        </p>
                    </div>
                </div>

                <div className={`p-6 rounded-2xl shadow-sm border flex items-center gap-4 ${systemOverview.criticalFlags > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                    <div className={`p-4 rounded-xl ${systemOverview.criticalFlags > 0 ? 'bg-red-200 text-red-700' : 'bg-gray-100 text-gray-400'}`}>
                        <FaTriangleExclamation size={24} />
                    </div>
                    <div>
                        <p className={`text-xs font-bold uppercase tracking-widest ${systemOverview.criticalFlags > 0 ? 'text-red-600' : 'text-gray-400'}`}>Critical Flags</p>
                        <p className={`text-2xl font-black ${systemOverview.criticalFlags > 0 ? 'text-red-700' : 'text-gray-900'}`}>
                            {systemOverview.criticalFlags} <span className="text-sm font-medium opacity-70">Requires Action</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* MAIN TABLE */}
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 text-lg">Group Performance - Integrity View</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Group Name</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Audit Status</th>
                                <th className="px-6 py-4 text-right">Closing Position</th>
                                <th className="px-6 py-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {systemOverview.groupRows.map((group) => (
                                <tr key={group.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-gray-800">
                                        {group.name}
                                        <div className="text-xs text-gray-400 font-normal">{group.location}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 w-fit ${group.status === 'POSTED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                {group.status === 'POSTED' && <FaCircleCheck size={10} />}
                                                {group.status}
                                            </span>
                                            {group.isStale && (
                                                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-bold inline-flex items-center gap-1 w-fit">
                                                    <FaClock size={10} /> STALE POSTING
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {group.hasVariance ? (
                                            <div className="flex flex-col">
                                                <span className="text-red-600 text-xs font-bold flex items-center gap-1">
                                                    <FaTriangleExclamation /> LEDGER VARIANCE
                                                </span>
                                                <span className="text-[10px] text-gray-400 italic">Reconstruction Gap: KES {group.varianceAmount.toLocaleString()}</span>
                                            </div>
                                        ) : (
                                            <span className="text-green-600 text-xs font-bold flex items-center gap-1">
                                                <FaCircleCheck /> VERIFIED
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className={`font-bold font-mono ${group.hasError ? 'text-red-600' : 'text-gray-900'}`}>
                                            KES {group.closingBalance.toLocaleString()}
                                        </div>
                                        <div className="text-[10px] text-gray-400">As of {group.lastUpdate}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <Link to={`/groups/${group.id}/ledger`} className="text-blue-600 hover:text-black font-bold text-sm flex items-center justify-center gap-1 group">
                                            Audit <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* System Note */}
            <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl flex gap-4 items-start">
                <FaCircleCheck className="text-blue-600 mt-1 flex-shrink-0" size={20} />
                <div>
                    <h4 className="font-bold text-blue-900 text-sm">Automated Reconciliation Active</h4>
                    <p className="text-xs text-blue-700 mt-1 opacity-80 max-w-2xl">
                        The integrity engine compares current closing balances with a reconstructed ledger of all transactions.
                        <strong> Stale Posting</strong> indicates groups with no activity in over 7 days.
                        <strong> Ledger Variance</strong> highlights discrepancies between reports and transaction logs.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Reconciliation;
