import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import { ShieldCheck, ShieldAlert, Lock, Unlock, History, AlertTriangle, Activity, FileText, Send, User } from 'lucide-react';
import RiskHeatmapWidget from '../components/RiskHeatmapWidget';
import OfficerScorecard from '../components/OfficerScorecard';

const GovernanceHub = () => {
    const [systemLockdown, setSystemLockdown] = useState(false);
    const [groups, setGroups] = useState([]);
    const [logs, setLogs] = useState([]);
    const [smsLogs, setSmsLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeLogTab, setActiveLogTab] = useState('audit');
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        loadData();
    }, [refreshTrigger]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [statusData, groupsData, logsData, smsData] = await Promise.all([
                api.getGovernanceStatus(),
                api.getGroups(),
                api.getAuditLogs(),
                api.getSMSLogs()
            ]);

            setSystemLockdown(statusData?.system_lockdown || false);
            setGroups(groupsData || []);
            setLogs(logsData || []);
            setSmsLogs(smsData || []);
        } catch (error) {
            console.error('Governance Data Load Error:', error);
            toast.error("Failed to load governance metrics");
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
        const isFrozen = group.is_frozen === 1;
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
        <div className="max-w-7xl mx-auto p-6 space-y-8 pb-20">
            <header className="flex justify-between items-center border-b pb-6">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                        <ShieldCheck className="w-8 h-8 text-emerald-600" />
                        Governance Hub
                    </h1>
                    <p className="text-gray-500 font-bold mt-1">Director Control Panel & Audit Oversight</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest">
                    <History className="w-4 h-4" />
                    Live Sync: {new Date().toLocaleTimeString()}
                </div>
            </header>

            {/* SYSTEM LOCKDOWN CARD */}
            <div className={`p-8 rounded-3xl border-2 transition-all ${systemLockdown ? 'bg-red-50 border-red-500 shadow-xl shadow-red-100' : 'bg-white border-gray-100'}`}>
                <div className="flex justify-between items-center flex-wrap gap-6">
                    <div className="flex items-center gap-6">
                        <div className={`p-5 rounded-2xl ${systemLockdown ? 'bg-red-100 animate-pulse' : 'bg-green-100'}`}>
                            {systemLockdown ? <ShieldAlert className="w-12 h-12 text-red-600" /> : <Activity className="w-12 h-12 text-green-600" />}
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 uppercase">Status: {systemLockdown ? 'EMERGENCY LOCKDOWN' : 'OPERATIONAL'}</h2>
                            <p className="text-gray-600 font-bold max-w-xl mt-2">
                                {systemLockdown
                                    ? "Global freeze enabled. All financial activities are currently suspended for security."
                                    : "System integrity verified. Automated controls and operational limits are effectively active."}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleSystemToggle}
                        className={`px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-3 transition-all shadow-md active:scale-95 ${systemLockdown
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-red-600 hover:bg-red-700 text-white'
                            }`}
                    >
                        {systemLockdown ? <><Unlock size={18} /> Lift Lockdown</> : <><Lock size={18} /> Initiate Lockdown</>}
                    </button>
                </div>
            </div>

            {/* RISK HEATMAP WIDGET */}
            <RiskHeatmapWidget />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* GROUPS MANAGEMENT */}
                <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                        <h3 className="text-lg font-black text-gray-800">Unit Governance</h3>
                        <span className="text-[10px] font-black uppercase bg-gray-200 px-3 py-1 rounded-full text-gray-600">
                            {groups.length} Surveillance Units
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50/50 text-left text-[10px] uppercase text-gray-400 font-black tracking-widest">
                                <tr>
                                    <th className="px-6 py-4">Group Identification</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Intervention</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {groups.map(group => {
                                    const isFrozen = group.is_frozen === 1;
                                    return (
                                        <tr key={group.id} className={`hover:bg-gray-50 transition-colors ${isFrozen ? 'bg-red-50/30' : ''}`}>
                                            <td className="px-6 py-4">
                                                <div className="font-black text-gray-800">{group.group_name}</div>
                                                {isFrozen && <div className="text-[10px] text-red-600 font-bold mt-1 flex items-center gap-1 uppercase tracking-tighter"><AlertTriangle size={10} /> {group.freeze_reason || 'Manual Suspension'}</div>}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isFrozen
                                                    ? <span className="px-3 py-1 rounded-lg text-[9px] font-black bg-red-100 text-red-700 flex items-center w-fit gap-1 uppercase"><Lock size={10} /> Suspended</span>
                                                    : <span className="px-3 py-1 rounded-lg text-[9px] font-black bg-emerald-100 text-emerald-700 flex items-center w-fit gap-1 uppercase"><Activity size={10} /> Active</span>
                                                }
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleGroupToggle(group)}
                                                    className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all border active:scale-95 ${isFrozen
                                                        ? 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                                                        : 'bg-red-50 border-red-100 text-red-600 hover:bg-red-100'
                                                        }`}
                                                >
                                                    {isFrozen ? 'Unfreeze' : 'Freeze Unit'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* LOGS HUB */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col h-[650px]">
                    <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                        <h3 className="text-base font-black text-gray-800">Operational Logs</h3>
                        <div className="flex bg-gray-200/50 p-1 rounded-xl">
                            <button
                                onClick={() => setActiveLogTab('audit')}
                                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 ${activeLogTab === 'audit' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <FileText size={12} /> Audit
                            </button>
                            <button
                                onClick={() => setActiveLogTab('sms')}
                                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 ${activeLogTab === 'sms' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <Send size={12} /> SMS
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-full opacity-40">
                                <Activity className="animate-pulse mb-2" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Streaming Metrics...</span>
                            </div>
                        ) : activeLogTab === 'audit' ? (
                            logs.length === 0 ? (
                                <div className="text-center text-gray-400 py-10 font-bold text-sm">No security trails found.</div>
                            ) : (
                                logs.map(log => (
                                    <div key={log.id} className="p-4 rounded-2xl bg-gray-50/50 border border-gray-100 text-sm hover:border-blue-200 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`font-black px-2 py-0.5 rounded-lg text-[10px] uppercase ${log.action.includes('FREEZE') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {log.action}
                                            </span>
                                            <span className="text-gray-400 text-[10px] font-bold">{new Date(log.timestamp).toLocaleDateString()}</span>
                                        </div>
                                        <div className="text-gray-900 font-black mb-1 text-xs">
                                            {log.target_type}: {log.target_id === 0 ? 'SYSTEM' : `#${log.target_id}`}
                                        </div>
                                        <p className="text-gray-600 text-[11px] font-medium leading-tight mb-2">
                                            {log.details.replace(/["{}]/g, '')}
                                        </p>
                                        <div className="flex justify-between items-center text-[9px] font-black text-gray-400 uppercase tracking-tighter border-t border-gray-100 pt-2">
                                            <span className="flex items-center gap-1"><User size={10} /> {log.officer_name || 'System Admin'}</span>
                                            <span>IP: {log.ip_address || 'Internal'}</span>
                                        </div>
                                    </div>
                                ))
                            )
                        ) : (
                            smsLogs.length === 0 ? (
                                <div className="text-center text-gray-400 py-10 font-bold text-sm">No transmission logs found.</div>
                            ) : (
                                smsLogs.map(sms => (
                                    <div key={sms.id} className="p-4 rounded-2xl bg-emerald-50/20 border border-emerald-100 text-sm hover:border-emerald-300 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`font-black px-2 py-0.5 rounded-lg text-[10px] uppercase ${sms.status === 'SENT' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                {sms.type?.split('_')[0]} Transaction
                                            </span>
                                            <span className="text-gray-400 text-[10px] font-bold">{new Date(sms.created_at).toLocaleTimeString()}</span>
                                        </div>
                                        <div className="text-gray-900 font-black mb-1 text-xs flex justify-between">
                                            <span>{sms.member_name || sms.phone}</span>
                                            <span className="text-emerald-600">KES {sms.cost?.toFixed(2)}</span>
                                        </div>
                                        <p className="text-gray-500 text-[11px] font-medium leading-tight mb-2 line-clamp-3 italic">
                                            "{sms.message}"
                                        </p>
                                        <div className="text-[9px] font-black text-emerald-600/60 uppercase tracking-widest pt-2 border-t border-emerald-50">
                                            Status: {sms.status}
                                        </div>
                                    </div>
                                ))
                            )
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
