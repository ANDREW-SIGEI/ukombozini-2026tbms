import React, { useState, useEffect } from 'react';
import {
    FaShieldAlt, FaThermometerHalf, FaBiohazard, FaLock, FaLockOpen,
    FaGlobe, FaUsers, FaExclamationTriangle, FaCheckCircle, FaChartLine,
    FaSync, FaHistory
} from 'react-icons/fa';
import { api } from '../services/api';
import { toast } from 'react-toastify';

const RiskCommandCenter = () => {
    const [riskData, setRiskData] = useState({ groups: [], stats: {} });
    const [governance, setGovernance] = useState({ system_lockdown: false });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('heatmap'); // 'heatmap', 'logs'
    const [auditLogs, setAuditLogs] = useState([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await api.getRiskDashboard();
            setRiskData(data); // { heatmap, alerts, scores }

            const gov = await api.getGovernanceStatus();
            if (gov) setGovernance(gov);

            const logs = await api.getAuditLogs();
            if (logs) setAuditLogs(logs);
        } catch (error) {
            console.error(error);
            toast.error("Failed to fetch risk data.");
        } finally {
            setLoading(false);
        }
    };

    const handleFreeze = async (type, id, action, targetName) => {
        const reason = window.prompt(`Please provide a reason for ${action.toLowerCase()}ing ${targetName}:`);
        if (reason === null) return;

        try {
            const res = await api.toggleFreeze(type, id, action, reason);
            if (res.success) {
                toast.success(`${targetName} ${action.toLowerCase()}d successfully.`);
                fetchData();
            }
        } catch (error) {
            toast.error("Governance action failed.");
        }
    };

    const getRiskColor = (score) => {
        if (score < 30) return 'from-emerald-400 to-emerald-600';
        if (score < 70) return 'from-amber-400 to-amber-600';
        return 'from-red-400 to-red-600';
    };

    const getRiskText = (score) => {
        if (score < 30) return 'Stable';
        if (score < 70) return 'Elevated';
        return 'Critical';
    };

    // Altitude Meter Component (Liquidity)
    const AltitudeMeter = ({ liquidity, totalSavings }) => {
        const percentage = Math.max(0, Math.min(100, (liquidity / totalSavings) * 100));
        const color = percentage > 40 ? 'text-emerald-500' : percentage > 15 ? 'text-amber-500' : 'text-red-500';

        return (
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <FaThermometerHalf size={80} />
                </div>
                <div className="relative w-48 h-48">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="16" fill="transparent" className="text-gray-100" />
                        <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="16" fill="transparent" strokeDasharray={553} strokeDashoffset={553 - (553 * percentage) / 100} strokeLinecap="round" className={`${color} transition-all duration-1000 ease-out`} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className={`text-4xl font-black ${color}`}>{percentage.toFixed(0)}%</span>
                        <span className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Altitude</span>
                    </div>
                </div>
                <div className="mt-6 text-center">
                    <h3 className="text-gray-500 font-bold uppercase text-xs tracking-widest mb-1">System Liquidity</h3>
                    <p className="text-2xl font-black text-gray-800">KES {liquidity?.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-gray-400 mt-1">OF KES {totalSavings?.toLocaleString()} TOTAL SAVINGS</p>
                </div>
            </div>
        );
    };

    if (loading && !riskData?.groups?.length) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh]">
                <FaSync className="animate-spin text-4xl text-safaricom-green mb-4" />
                <p className="font-bold text-gray-500">Syncing with Governance Core...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Top Bar / Governance Status */}
            <div className={`p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg border-2 ${governance.system_lockdown ? 'bg-red-600 border-red-700 text-white' : 'bg-emerald-600 border-emerald-700 text-white'}`}>
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md">
                        {governance.system_lockdown ? <FaBiohazard size={24} /> : <FaShieldAlt size={24} />}
                    </div>
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tight">
                            System Status: {governance.system_lockdown ? 'LOCKDOWN' : 'OPERATIONAL'}
                        </h2>
                        <p className="text-white/80 text-xs font-bold uppercase tracking-widest">
                            {governance.system_lockdown ? 'All transaction endpoints are currently disabled system-wide.' : 'All systems are floating normally.'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => handleFreeze('SYSTEM', 0, governance.system_lockdown ? 'UNFREEZE' : 'FREEZE', 'ENTIRE SYSTEM')}
                    className={`px-6 py-3 rounded-xl font-black uppercase tracking-widest text-sm transition-all flex items-center gap-2 shadow-xl ${governance.system_lockdown ? 'bg-white text-red-600 hover:bg-red-50' : 'bg-red-500 text-white hover:bg-red-400 border border-red-400'}`}
                >
                    {governance.system_lockdown ? <><FaLockOpen /> Lift Lockdown</> : <><FaLock /> Emergency Freeze</>}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Liquidity Meter */}
                <AltitudeMeter liquidity={riskData?.stats?.total_liquidity} totalSavings={riskData?.stats?.total_savings} />

                {/* Dashboard Stats */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Total Active Loans</h3>
                                <p className="text-3xl font-black text-gray-800">KES {riskData?.stats?.total_loans?.toLocaleString()}</p>
                            </div>
                            <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl">
                                <FaChartLine size={24} />
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-500">Ratio:</span>
                            <span className="text-xs font-black text-blue-600">
                                {riskData?.stats?.total_savings > 0
                                    ? ((riskData.stats.total_loans / riskData.stats.total_savings) * 100).toFixed(1)
                                    : '0.0'}% of Capital
                            </span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Groups at Risk</h3>
                                <p className="text-3xl font-black text-red-600">{riskData?.stats?.system_at_risk || 0}</p>
                            </div>
                            <div className="p-3 bg-red-50 text-red-500 rounded-2xl">
                                <FaExclamationTriangle size={24} />
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-50">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic">Scores exceeding 70% threshold</p>
                        </div>
                    </div>

                    <div className="md:col-span-2 bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-3xl shadow-2xl text-white flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
                        <div className="flex-1">
                            <h3 className="text-emerald-400 font-black uppercase text-xs tracking-widest mb-2">Governance Note</h3>
                            <h2 className="text-2xl font-black leading-tight">Antigravity risk scoring monitors shortfall trends and loan compliance in real-time.</h2>
                            <p className="text-gray-400 mt-2 text-sm">Floating groups maintain a risk score below 30. Elevated scores trigger automated oversight alerts for Field Officers.</p>
                        </div>
                        <FaShieldAlt size={80} className="text-white/10 hidden md:block" />
                    </div>
                </div>
            </div>

            {/* Heatmap / Activity Tabs */}
            <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
                <div className="border-b flex">
                    <button
                        onClick={() => setActiveTab('heatmap')}
                        className={`px-8 py-5 font-black uppercase tracking-widest text-xs transition-all border-b-4 ${activeTab === 'heatmap' ? 'border-safaricom-green text-gray-900 bg-gray-50/50' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        <FaGlobe className="inline mr-2" /> Antigravity Heatmap
                    </button>
                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`px-8 py-5 font-black uppercase tracking-widest text-xs transition-all border-b-4 ${activeTab === 'logs' ? 'border-safaricom-green text-gray-900 bg-gray-50/50' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        <FaHistory className="inline mr-2" /> Audit & Governance Logs
                    </button>
                </div>

                <div className="p-8">
                    {activeTab === 'heatmap' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {riskData?.heatmap?.map(group => {
                                const metrics = JSON.parse(group.metrics_snapshot || '{}');
                                const stats = metrics.stats || {};
                                const groupLiquidity = stats.total_savings - stats.total_debt;

                                return (
                                    <div key={group.group_id} className="relative group/card">
                                        <div className="bg-white rounded-3xl p-6 border-2 border-gray-50 shadow-md hover:shadow-2xl hover:border-blue-100 transition-all duration-300">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className={`p-2 rounded-lg bg-gradient-to-br ${getRiskColor(group.score)} text-white shadow-lg`}>
                                                    <FaUsers size={16} />
                                                </div>
                                                <div className="text-right">
                                                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${group.is_frozen === 1 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                        {group.is_frozen === 1 ? 'FROZEN' : 'ACTIVE'}
                                                    </span>
                                                </div>
                                            </div>
                                            <h3 className="font-black text-gray-800 text-lg truncate mb-1">{group.name}</h3>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Risk: {getRiskText(group.score)}</p>

                                            <div className="space-y-3">
                                                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full bg-gradient-to-r ${getRiskColor(group.score)} transition-all duration-1000`}
                                                        style={{ width: `${group.score}%` }}
                                                    ></div>
                                                </div>
                                                <div className="flex justify-between items-center text-[10px] font-bold">
                                                    <span className="text-gray-400 uppercase">Score</span>
                                                    <span className="text-gray-800 font-black">{group.score}/100</span>
                                                </div>
                                            </div>

                                            <div className="mt-6 pt-4 border-t border-gray-50 flex justify-between items-center">
                                                <div className="text-center">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Loans</p>
                                                    <p className="text-sm font-black text-gray-800">{stats.totalLoansCount || 0}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Liquidity</p>
                                                    <p className={`text-sm font-black ${groupLiquidity >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                        {groupLiquidity >= 0 ? `+${(groupLiquidity / 1000).toFixed(1)}k` : `${(groupLiquidity / 1000).toFixed(1)}k`}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mt-6">
                                                <button
                                                    onClick={() => handleFreeze('GROUP', group.group_id, group.is_frozen === 1 ? 'UNFREEZE' : 'FREEZE', group.name)}
                                                    className={`w-full py-2 rounded-xl text-xs font-black tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${group.is_frozen === 1 ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white' : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white'}`}
                                                >
                                                    {group.is_frozen === 1 ? <><FaLockOpen /> Restore</> : <><FaLock /> Freeze</>}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-gray-500 font-black uppercase text-[10px] tracking-widest border-b">
                                    <tr>
                                        <th className="px-6 py-4">Timestamp</th>
                                        <th className="px-6 py-4">Action</th>
                                        <th className="px-6 py-4">Category</th>
                                        <th className="px-6 py-4">Details</th>
                                        <th className="px-6 py-4">Officer</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 text-sm">
                                    {auditLogs.map((log, i) => (
                                        <tr key={i} className="hover:bg-gray-50/50">
                                            <td className="px-6 py-4 font-mono text-gray-500 text-xs">
                                                {new Date(log.created_at).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 font-black text-gray-800">
                                                {log.action}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 font-bold uppercase text-[9px]">
                                                    {log.category}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 truncate max-w-xs">
                                                {log.details ? <span>{typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}</span> : '-'}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-gray-700">
                                                {log.officer_name}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RiskCommandCenter;
