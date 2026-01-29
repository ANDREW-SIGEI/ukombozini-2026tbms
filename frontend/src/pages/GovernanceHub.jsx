import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import { ShieldCheck, ShieldAlert, Lock, Unlock, History, AlertTriangle, Activity } from 'lucide-react';
import RiskHeatmapWidget from '../components/RiskHeatmapWidget';
import OfficerScorecard from '../components/OfficerScorecard';

const GovernanceHub = () => {
    const [systemLockdown, setSystemLockdown] = useState(false);
    const [groups, setGroups] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        loadData();
    }, [refreshTrigger]);

    const loadData = async () => {
        try {
            const [statusData, groupsData, logsData] = await Promise.all([
                api.getGovernanceStatus(),
                api.getGroups(),
                api.getAuditLogs()
            ]);

            setSystemLockdown(statusData.system_lockdown);
            setGroups(groupsData);
            setLogs(logsData);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSystemToggle = async () => {
        const action = systemLockdown ? 'UNFREEZE' : 'FREEZE';
        const confirmMsg = systemLockdown
            ? "Are you sure you want to LIFT the System Lockdown? Operations will resume."
            : "⚠️ EMERGENCY: This will FREEZE the entire system. No financial actions will be allowed efficiently immediately. Confirm?";

        if (window.confirm(confirmMsg)) {
            try {
                await api.toggleFreeze('SYSTEM', 0, action, "Manual Director Override");
                toast.success(`System ${action === 'FREEZE' ? 'Locked' : 'Unlocked'} Successfully`);
                setRefreshTrigger(prev => prev + 1);
            } catch (err) {
                toast.error("Action Failed");
            }
        }
    };

    const handleGroupToggle = async (group) => {
        const isFrozen = group.is_frozen === 1; // SQLite boolean is 0/1
        const action = isFrozen ? 'UNFREEZE' : 'FREEZE';
        const reason = prompt(`Enter reason to ${action} group ${group.group_name}:`, "Administrative Action");

        if (reason) {
            try {
                await api.toggleFreeze('GROUP', group.id, action, reason);
                toast.success(`Group ${group.group_name} ${action}D`);
                setRefreshTrigger(prev => prev + 1);
            } catch (err) {
                toast.error("Action Failed");
            }
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8">
            <header className="flex justify-between items-center border-b pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <ShieldCheck className="w-8 h-8 text-emerald-600" />
                        Governance Hub
                    </h1>
                    <p className="text-gray-500 mt-1">Director Control Panel & Audit Oversight</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                    <History className="w-4 h-4" />
                    Last Updated: {new Date().toLocaleTimeString()}
                </div>
            </header>

            {/* SYSTEM LOCKDOWN CARD */}
            <div className={`p-8 rounded-2xl border-2 transition-all ${systemLockdown ? 'bg-red-50 border-red-500 shadow-xl shadow-red-100' : 'bg-white border-gray-200'}`}>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-6">
                        <div className={`p-4 rounded-full ${systemLockdown ? 'bg-red-100 animate-pulse' : 'bg-green-100'}`}>
                            {systemLockdown ? <ShieldAlert className="w-12 h-12 text-red-600" /> : <Activity className="w-12 h-12 text-green-600" />}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">System Status: {systemLockdown ? 'EMERGENCY LOCKDOWN' : 'OPERATIONAL'}</h2>
                            <p className="text-gray-600 max-w-xl mt-2">
                                {systemLockdown
                                    ? "All financial transactions (Loans, Withdrawals, Reports) are currently BLOCKED globaly."
                                    : "System is running normally. Financial controls are active but operations are permitted."}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleSystemToggle}
                        className={`px-8 py-4 rounded-xl font-bold text-lg flex items-center gap-3 transition-colors ${systemLockdown
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-red-600 hover:bg-red-700 text-white'
                            }`}
                    >
                        {systemLockdown ? <><Unlock /> LIFT LOCKDOWN</> : <><Lock /> INITIATE LOCKDOWN</>}
                    </button>
                </div>
            </div>

            {/* RISK HEATMAP WIDGET */}
            <RiskHeatmapWidget />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* GROUPS MANAGEMENT */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-gray-800">Group Governance</h3>
                        <span className="text-sm px-3 py-1 bg-gray-200 rounded-full font-medium">{groups.length} Active Groups</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 font-semibold">
                                <tr>
                                    <th className="px-6 py-4">Group Name</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {groups.map(group => {
                                    const isFrozen = group.is_frozen === 1;
                                    return (
                                        <tr key={group.id} className={`hover:bg-gray-50 ${isFrozen ? 'bg-red-50/50' : ''}`}>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{group.group_name}</div>
                                                {isFrozen && <div className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {group.freeze_reason}</div>}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isFrozen
                                                    ? <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 flex items-center w-fit gap-1"><Lock className="w-3 h-3" /> FROZEN</span>
                                                    : <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 flex items-center w-fit gap-1"><Activity className="w-3 h-3" /> ACTIVE</span>
                                                }
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleGroupToggle(group)}
                                                    className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${isFrozen
                                                        ? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                                        : 'bg-red-50 text-red-600 hover:bg-red-100'
                                                        }`}
                                                >
                                                    {isFrozen ? 'Unfreeze' : 'Freeze Group'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* AUDIT LOGS */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[600px]">
                    <div className="p-6 border-b border-gray-100 bg-gray-50">
                        <h3 className="text-lg font-bold text-gray-800">Recent Audit Logs</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {loading ? (
                            <div className="text-center text-gray-400 py-10">Loading logs...</div>
                        ) : logs.length === 0 ? (
                            <div className="text-center text-gray-400 py-10">No governance actions recorded.</div>
                        ) : (
                            logs.map(log => (
                                <div key={log.id} className="p-4 rounded-lg bg-gray-50 border border-gray-100 text-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`font-bold px-2 py-0.5 rounded text-xs ${log.action.includes('FREEZE') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                            }`}>
                                            {log.action}
                                        </span>
                                        <span className="text-gray-400 text-xs">{new Date(log.timestamp).toLocaleDateString()}</span>
                                    </div>
                                    <div className="text-gray-900 font-medium mb-1">
                                        {log.target_type}: {log.target_id === 0 ? 'SYSTEM' : `#${log.target_id}`}
                                    </div>
                                    <p className="text-gray-600 text-xs italic">
                                        "{log.details}"
                                    </p>
                                    <div className="mt-2 text-xs text-gray-400 border-t pt-2 flex items-center gap-1">
                                        <ShieldCheck className="w-3 h-3" /> By: {log.officer_name || `Admin #${log.performed_by}`}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* OFFICER PERFORMANCE SCORECARD */}
            <OfficerScorecard />
        </div>
    );
};

export default GovernanceHub;
