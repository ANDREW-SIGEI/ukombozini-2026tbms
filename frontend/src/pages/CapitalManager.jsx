import React, { useState, useEffect } from 'react';
import {
    FaBuildingColumns, FaMoneyBillTrendUp, FaHandHoldingHand,
    FaBoxArchive, FaShieldHalved, FaArrowUpRightFromSquare,
    FaPlus, FaFilter, FaFilePdf, FaTriangleExclamation,
    FaArrowRight, FaSpinner, FaCircleCheck, FaSackDollar
} from 'react-icons/fa6';
import { FaHistory } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const CapitalManager = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('summary');
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalInjected: 0,
        activeCommitments: 0,
        pendingRepayments: 0,
        productFinanceVolume: 0
    });
    const [allocationHistory, setAllocationHistory] = useState([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [groupsData, statsData] = await Promise.all([
                api.getGroups(),
                api.getPartnershipStats()
            ]);
            setGroups(groupsData || []);
            setStats(statsData || {
                totalInjected: 0,
                activeCommitments: 0,
                pendingRepayments: 0,
                productFinanceVolume: 0
            });
        } catch (error) {
            console.error("Fetch failed", error);
            toast.error("Failed to load capital metrics");
        } finally {
            setLoading(false);
        }
    };

    const TABS = [
        { id: 'summary', name: 'Capital Summary', icon: FaBuildingColumns },
        { id: 'injections', name: 'Capital Injections', icon: FaMoneyBillTrendUp },
        { id: 'commitments', name: 'Commitment Deposits', icon: FaHandHoldingHand },
        { id: 'product', name: 'Product Financing', icon: FaBoxArchive },
        { id: 'audit', name: 'Allocation Audit', icon: FaHistory }
    ];

    if (loading) return (
        <div className="h-full flex flex-col items-center justify-center space-y-4">
            <FaSpinner className="text-4xl text-safaricom-green animate-spin" />
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Hydrating Vault Metrics...</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* 🔽 HEADER: INSTITUTIONAL PULSE */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        Loan & Top-Up Manager
                        <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] uppercase font-bold rounded-full border border-slate-200">Institutional</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 font-medium">Control capital injections, commitment buffers, and institutional risk.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
                        <FaHistory /> Audit Logs
                    </button>
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all shadow-xl">
                        <FaPlus /> New Capital Injection
                    </button>
                </div>
            </header>

            {/* 🔽 STATS: THE VAULT NUMBERS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Injected Capital', val: stats.totalInjected, icon: FaMoneyBillTrendUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'Active Commitments', val: stats.activeCommitments, icon: FaShieldHalved, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Pending Repayments', val: stats.pendingRepayments, icon: FaArrowRight, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Product Finance Pool', val: stats.productFinanceVolume, icon: FaBoxArchive, color: 'text-rose-600', bg: 'bg-rose-50' }
                ].map((s, i) => (
                    <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5 group hover:border-slate-300 transition-all">
                        <div className={`w-14 h-14 rounded-2xl ${s.bg} ${s.color} flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform`}>
                            <s.icon />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">KES {s.val.toLocaleString()}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* 🔽 NAVIGATION TABS */}
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit border border-slate-200">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black transition-all
                            ${activeTab === tab.id
                                ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-200'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}
                        `}
                    >
                        <tab.icon /> {tab.name}
                    </button>
                ))}
            </div>

            {/* 🔽 MAIN CONTENT ZONE */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
                {activeTab === 'summary' && (
                    <div className="p-8 space-y-8">
                        <section className="flex items-center justify-between border-b border-slate-100 pb-6">
                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
                                <FaBuildingColumns className="text-slate-400" /> Group Portfolio Health
                            </h3>
                            <div className="flex gap-2">
                                <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 text-[10px] font-black rounded-full border border-green-100">
                                    <FaCircleCheck /> SYSTEM COMPLIANT
                                </span>
                            </div>
                        </section>

                        <div className="grid grid-cols-1 gap-4">
                            {groups.map(group => (
                                <div key={group.id} className="p-6 rounded-3xl bg-slate-50 border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-white hover:shadow-xl hover:border-slate-300 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-lg">
                                            {group.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-900">{group.name}</h4>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{group.region || 'Region North'} • Code: {group.id}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 flex-1 max-w-2xl">
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Cash at Hand</p>
                                            <p className="text-sm font-black text-slate-800">KES {(group.total_cash || 0).toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">HQ Inflow</p>
                                            <p className="text-sm font-black text-indigo-600">KES {(group.capital_injected || 50000).toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Security Bond</p>
                                            <p className="text-sm font-black text-emerald-600">KES {(group.commitment_deposit || 15000).toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Risk Rating</p>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden w-16">
                                                    <div className="h-full bg-safaricom-green w-4/5" />
                                                </div>
                                                <span className="text-[10px] font-black">LOW</span>
                                            </div>
                                        </div>
                                    </div>

                                    <button className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-900 hover:border-slate-900 transition-all opacity-0 group-hover:opacity-100">
                                        <FaArrowUpRightFromSquare />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'injections' && (
                    <div className="p-12 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center text-3xl shadow-inner">
                            <FaMoneyBillTrendUp />
                        </div>
                        <div className="max-w-md">
                            <h3 className="text-xl font-black text-slate-900">Capital Injection Portal</h3>
                            <p className="text-slate-500 text-sm mt-2">Manage the flow of capital from Ukombozini HQ into specific group accounts to increase meeting liquidity.</p>
                        </div>
                        <button className="px-8 py-4 bg-indigo-600 text-white rounded-3xl font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-3">
                            <FaPlus /> Initiate New Injection
                        </button>
                    </div>
                )}

                {activeTab === 'commitments' && (
                    <div className="p-12 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center text-3xl shadow-inner">
                            <FaShieldHalved />
                        </div>
                        <div className="max-w-md">
                            <h3 className="text-xl font-black text-slate-900">Commitment Deposit Tracker</h3>
                            <p className="text-slate-500 text-sm mt-2">Monitor group-level security deposits. These funds act as emergency collateral for the entire table.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 w-full max-w-lg mt-8">
                            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-left">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Escrow</p>
                                <p className="text-xl font-black text-emerald-600">KES 450,000</p>
                            </div>
                            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-left">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Claims</p>
                                <p className="text-xl font-black text-slate-900">NONE</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'product' && (
                    <div className="p-12 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center text-3xl shadow-inner">
                            <FaBoxArchive />
                        </div>
                        <div className="max-w-md">
                            <h3 className="text-xl font-black text-slate-900">Product Financing Control</h3>
                            <p className="text-slate-500 text-sm mt-2">Bridge technical inventory (Solar, Agri-inputs) with member loans. This module converts physical assets into ledger debits.</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl max-w-lg flex items-start gap-4 text-left">
                            <FaTriangleExclamation className="text-amber-600 text-2xl shrink-0 mt-1" />
                            <div>
                                <p className="text-xs font-black text-amber-800 uppercase tracking-widest">Integration Note</p>
                                <p className="text-xs font-bold text-amber-700 leading-relaxed mt-1">Product financing is currently linked to the **Central Inventory API**. Any local adjustments affect real-world stock levels.</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'audit' && (
                    <div className="p-8 space-y-6">
                        <header className="flex items-center justify-between border-b border-slate-100 pb-6">
                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
                                <FaHistory className="text-slate-400" /> Share Allocation Audit Trail
                            </h3>
                            <button
                                onClick={async () => {
                                    setLoading(true);
                                    try {
                                        const history = await api.getAllocationHistory();
                                        setAllocationHistory(history || []);
                                    } catch (e) { }
                                    setLoading(false);
                                }}
                                className="text-xs font-bold text-safaricom-green hover:underline"
                            >
                                Refresh Log
                            </button>
                        </header>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-y border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Session #</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Group</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Net Surplus</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Signed At</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {allocationHistory.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-20 text-center text-slate-400 font-bold italic">
                                                No allocation snapshots committed yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        allocationHistory.map(row => (
                                            <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 font-mono font-bold text-slate-900">{row.session_number}</td>
                                                <td className="px-6 py-4 font-bold text-slate-700">{row.group_name}</td>
                                                <td className="px-6 py-4 text-right font-black text-safaricom-green">KES {row.net_surplus.toLocaleString()}</td>
                                                <td className="px-6 py-4">
                                                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded-full border border-emerald-200">
                                                        {row.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                                                    {new Date(row.created_at || row.timestamp).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* 🔽 FOOTER: GOVERNANCE BANNER */}
            <footer className="bg-slate-900 rounded-3xl p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-xl">
                        🛡️
                    </div>
                    <div>
                        <h4 className="text-white font-black leading-tight">Institutional Integrity Guard</h4>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-0.5">Automated Risk Monitoring • 2026 TBMS CORE</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">System Authorized By</p>
                    <p className="text-white font-black text-sm">{user?.name || 'System Administrator'}</p>
                </div>
            </footer>
        </div>
    );
};

export default CapitalManager;
