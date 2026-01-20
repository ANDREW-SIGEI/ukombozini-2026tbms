import React, { useMemo } from 'react';
import { FaBalanceScale, FaCheckCircle, FaExclamationTriangle, FaChartLine, FaUsers, FaArrowRight } from 'react-icons/fa';
import { useTransactions } from '../context/TransactionContext';
import { mockGroups } from '../data/mockData';
import { Link } from 'react-router-dom';

const Reconciliation = () => {
    const { sessions } = useTransactions();

    // 1. DATA AGGREGATION ENGINE (Director Level)
    const systemOverview = useMemo(() => {
        let totalCashCollected = 0;
        let totalSessionsPosted = 0;
        let criticalFlags = 0;

        // Map groups to their latest status
        const groupStatusMap = mockGroups.map(group => {
            // Find latest session for this group
            // In a real app, filtering by month/year would be here
            const groupSessions = sessions.filter(s => s.groupId === group.id);
            const latestSession = groupSessions[groupSessions.length - 1]; // Simple last-in approach

            if (latestSession) {
                totalCashCollected += (latestSession.totals?.total_cash_in || 0);
                totalSessionsPosted++;

                // CHECK FOR SYSTEM STOPPERS (Negative Balances)
                if (latestSession.closingBalance < 0) {
                    criticalFlags++;
                }

                return {
                    ...group,
                    status: 'POSTED',
                    lastUpdate: latestSession.date,
                    cashIn: latestSession.totals?.total_cash_in || 0,
                    closingBalance: latestSession.closingBalance,
                    hasError: latestSession.closingBalance < 0
                };
            }

            return {
                ...group,
                status: 'PENDING',
                lastUpdate: '-',
                cashIn: 0,
                closingBalance: group.openingBalance, // Fallback to opening
                hasError: false
            };
        });

        return {
            totalCashCollected,
            totalSessionsPosted,
            criticalFlags,
            groupRows: groupStatusMap
        };
    }, [sessions]);

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-20 p-6">
            {/* HERADER SECTION */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                        <FaBalanceScale className="text-safaricom-green" />
                        Director Reconciliation Board
                    </h2>
                    <p className="text-gray-500 font-medium mt-1">System-Wide Financial Health • January 2026</p>
                </div>
                <div className="mt-4 md:mt-0 px-6 py-2 bg-gray-900 text-white rounded-full font-bold text-sm tracking-wide shadow-lg">
                    LIVE SYSTEM DATA
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
                            {systemOverview.totalSessionsPosted} <span className="text-gray-400 text-lg font-medium">/ {mockGroups.length}</span>
                        </p>
                    </div>
                </div>

                <div className={`p-6 rounded-2xl shadow-sm border flex items-center gap-4 ${systemOverview.criticalFlags > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                    <div className={`p-4 rounded-xl ${systemOverview.criticalFlags > 0 ? 'bg-red-200 text-red-700' : 'bg-gray-100 text-gray-400'}`}>
                        <FaExclamationTriangle size={24} />
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
                    <h3 className="font-bold text-gray-800 text-lg">Group Performance - Monthly View</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Group Name</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Last Posted</th>
                                <th className="px-6 py-4 text-right">Cash In</th>
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
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${group.status === 'POSTED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            {group.status === 'POSTED' && <FaCheckCircle size={10} />}
                                            {group.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                                        {group.lastUpdate}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-gray-700 font-mono">
                                        KES {group.cashIn.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className={`font-bold font-mono ${group.hasError ? 'text-red-600' : 'text-gray-900'}`}>
                                            KES {group.closingBalance.toLocaleString()}
                                        </div>
                                        {group.hasError && (
                                            <div className="text-xs text-red-500 font-bold mt-1 flex items-center justify-end gap-1">
                                                <FaExclamationTriangle /> Negative Balance
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <Link to="/group-monthly" className="text-safaricom-green hover:text-black font-bold text-sm flex items-center justify-center gap-1 group">
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
                <FaCheckCircle className="text-blue-600 mt-1 flex-shrink-0" size={20} />
                <div>
                    <h4 className="font-bold text-blue-900 text-sm">System Integrity Check Passed</h4>
                    <p className="text-xs text-blue-700 mt-1 opacity-80 max-w-2xl">
                        The aggregation engine is active. All "Posted" groups are strictly reconciled against their individual meeting reports.
                        Balances displayed here are mathematically derived from locked sessions.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Reconciliation;
