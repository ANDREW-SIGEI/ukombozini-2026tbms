import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import {
    FaHandshake, FaMoneyBillTrendUp, FaShieldHalved, FaTv,
    FaBriefcase, FaArrowRight, FaRotate, FaUnlockKeyhole,
    FaFilePdf, FaCircleCheck, FaTriangleExclamation, FaCircleInfo,
    FaCircleNotch, FaMagnifyingGlass, FaUserTie
} from 'react-icons/fa6';
import { toast } from 'react-toastify';
import { saveAs } from 'file-saver';
import api from '../services/api';

const CompanyPartnershipManager = () => {
    const [activeTab, setActiveTab] = useState('overview');
    const [exposureData, setExposureData] = useState(null);
    const [scoreData, setScoreData] = useState(null);
    const [groups, setGroups] = useState([]);
    const [members, setMembers] = useState([]);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [supervisorOverride, setSupervisorOverride] = useState(false);

    const { register: registerTopUp, handleSubmit: handleSubmitTopUp, reset: resetTopUp } = useForm();
    const { register: registerCommitment, handleSubmit: handleSubmitCommitment, reset: resetCommitment } = useForm();
    const { register: registerProduct, handleSubmit: handleSubmitProduct, reset: resetProduct } = useForm();
    const { register: registerOffset, handleSubmit: handleSubmitOffset, reset: resetOffset } = useForm();

    // 1. Initial Load: Groups
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const fetchedGroups = await api.getGroups();
                setGroups(fetchedGroups);
                if (fetchedGroups.length > 0) {
                    setSelectedGroupId(fetchedGroups[0].id);
                }
            } catch (error) {
                toast.error("Failed to load groups");
            } finally {
                setInitialLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    // 2. Load Exposure & Score when Group changes
    useEffect(() => {
        if (selectedGroupId) {
            loadGroupPartnershipData(selectedGroupId);
            loadGroupMembers(selectedGroupId);
        }
    }, [selectedGroupId]);

    const loadGroupPartnershipData = async (groupId) => {
        try {
            setLoading(true);
            const [exposure, score] = await Promise.all([
                api.getPartnershipExposure(groupId),
                api.getRelationshipScore(groupId)
            ]);
            setExposureData(exposure);
            setScoreData(score);
        } catch (error) {
            console.error("Partnership Data Load Fail", error);
        } finally {
            setLoading(false);
        }
    };

    const loadGroupMembers = async (groupId) => {
        try {
            const fetchedMembers = await api.getMembersByGroup(groupId);
            setMembers(fetchedMembers);
        } catch (error) {
            console.error("Member Load Fail", error);
        }
    };

    // 💰 Submit Top-Up
    const onTopUpSubmit = async (data) => {
        try {
            setLoading(true);
            await api.addCompanyTopUp({ ...data, groupId: selectedGroupId });
            toast.success("Company Capital Injected Successfully! 🚀");
            resetTopUp();
            loadGroupPartnershipData(selectedGroupId);
        } catch (error) {
            // Error handled by api.js
        } finally {
            setLoading(false);
        }
    };

    // 🔒 Submit Commitment
    const onCommitmentSubmit = async (data) => {
        try {
            setLoading(true);
            await api.addCommitmentDeposit({ ...data, groupId: selectedGroupId });
            toast.success("Group Security Deposit Recorded! 🛡️");
            resetCommitment();
            loadGroupPartnershipData(selectedGroupId);
        } catch (error) {
            // Error handled by api.js
        } finally {
            setLoading(false);
        }
    };

    // 📺 Issue Product
    const onProductSubmit = async (data) => {
        try {
            setLoading(true);
            await api.issueProduct({ ...data });
            toast.success("Asset Financing Approved & Issued! 📺");
            resetProduct();
        } catch (error) {
            // Error handled by api.js
        } finally {
            setLoading(false);
        }
    };

    // 🛠️ Submit Offset (Auto-Clear)
    const onOffsetSubmit = async (data) => {
        try {
            setLoading(true);
            await api.applyPartnerOffset({ ...data });
            toast.success("Debt Cleared using Group Commitment! 🔓");
            resetOffset();
            loadGroupPartnershipData(selectedGroupId);
        } catch (error) {
            // Error handled by api.js
        } finally {
            setLoading(false);
        }
    };

    // 📄 Download Statement
    const downloadStatement = async () => {
        try {
            toast.info("Generating Professional Statement...");
            const blob = await api.downloadPartnershipStatement(selectedGroupId);
            if (blob) {
                saveAs(blob, `Partnership_Statement_Group_${selectedGroupId}.pdf`);
                toast.success("Statement Downloaded! 📁");
            }
        } catch (error) {
            toast.error("Download Failed");
        }
    };

    const filteredMembers = useMemo(() => {
        return members.filter(m =>
            m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.phone.includes(searchTerm)
        );
    }, [members, searchTerm]);

    const tabs = [
        { id: 'overview', label: 'Overview', icon: <FaBriefcase />, color: 'blue' },
        { id: 'topup', label: 'Company Top-Up', icon: <FaMoneyBillTrendUp />, color: 'blue' },
        { id: 'commitment', label: 'Commitment Deposit', icon: <FaShieldHalved />, color: 'green' },
        { id: 'products', label: 'Product Financing', icon: <FaTv />, color: 'purple' },
        { id: 'offset', label: 'Clear Debt (Offset)', icon: <FaUnlockKeyhole />, color: 'orange' },
    ];

    if (initialLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <FaCircleNotch className="text-4xl text-blue-600 animate-spin mb-4" />
                <p className="text-gray-500 font-medium">Initializing Partnership Manager...</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 pb-20 space-y-8 animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#001f3f] via-[#003366] to-[#001f3f] p-6 md:p-10 rounded-3xl text-white shadow-2xl relative overflow-hidden group">
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="p-3 bg-yellow-400/20 rounded-2xl backdrop-blur-md">
                            <FaHandshake className="text-3xl text-yellow-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                                Ukombozi Partnership Hub
                            </h1>
                            <p className="text-blue-250 font-medium opacity-80 mt-1">
                                Managing Capital, Security, and Asset Financing with AI-driven Insights.
                            </p>
                        </div>
                    </div>
                </div>
                {/* Decorative Elements */}
                <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 skew-x-12 transform translate-x-20 group-hover:translate-x-10 transition-transform duration-700"></div>
                <div className="absolute left-1/4 bottom-0 h-1 w-1/2 bg-gradient-to-r from-transparent via-yellow-400/30 to-transparent"></div>
            </div>

            {/* Selection & Quick Stats bar */}
            <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1 bg-white p-5 rounded-2xl shadow-lg border border-gray-100 flex flex-col md:flex-row items-center gap-6">
                    <div className="w-full md:w-auto">
                        <label className="block text-xs font-black text-gray-400 uppercase mb-2 ml-1">Select Partner Group</label>
                        <div className="relative">
                            <select
                                className="w-full md:w-80 p-3 pl-4 pr-10 border-2 border-gray-100 rounded-xl bg-gray-50 font-bold text-gray-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none appearance-none"
                                value={selectedGroupId}
                                onChange={(e) => setSelectedGroupId(e.target.value)}
                            >
                                {groups.map(g => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                            </select>
                            <FaMagnifyingGlass className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full border border-blue-100">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                            <span className="text-xs font-black text-blue-700 uppercase">Operational</span>
                        </div>
                        {exposureData?.netExposure < 0 && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full border border-green-100">
                                <FaShieldHalved className="text-green-600 text-xs" />
                                <span className="text-xs font-black text-green-700 uppercase">Fully Collateralized</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:w-80 bg-gradient-to-br from-indigo-900 to-blue-900 p-5 rounded-2xl shadow-xl text-white flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Net Exposure</span>
                        <FaRotate className={`text-blue-300 transform transition-transform duration-500 ${loading ? 'animate-spin' : ''}`} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-3xl font-black">
                            KES {Math.abs(exposureData?.netExposure || 0).toLocaleString()}
                        </span>
                        <span className={`text-[10px] font-bold ${(exposureData?.netExposure || 0) > 0 ? 'text-red-300' : 'text-green-300'} uppercase mt-1`}>
                            {(exposureData?.netExposure || 0) > 0 ? '⚠️ High Liability' : '✅ Security Surplus'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex space-x-2 bg-white/50 p-1.5 rounded-2xl border border-gray-100 overflow-x-auto no-scrollbar">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black transition-all duration-300 whitespace-nowrap ${activeTab === tab.id
                            ? 'bg-blue-600 text-white shadow-xl translate-y-[-2px]'
                            : 'text-gray-500 hover:bg-gray-100'
                            }`}
                    >
                        <span className={activeTab === tab.id ? 'scale-110' : ''}>{tab.icon}</span>
                        <span className="text-sm">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* CONTENT AREA */}
            <div className={`bg-white rounded-3xl shadow-xl border border-gray-100 min-h-[500px] transition-all duration-500 ${loading ? 'opacity-60 grayscale' : 'opacity-100'}`}>

                {/* 1. OVERVIEW */}
                {activeTab === 'overview' && (
                    <div className="p-6 md:p-10 space-y-10">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div>
                                <h2 className="text-2xl font-black text-gray-800">Operational Portfolio</h2>
                                <p className="text-gray-500 font-medium">Real-time status of capital and security for {groups.find(g => g.id == selectedGroupId)?.name}.</p>
                            </div>
                            <button onClick={downloadStatement} className="group relative flex items-center gap-3 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-red-500/20 transition-all hover:scale-[1.05] active:scale-[0.98]">
                                <FaFilePdf /> Download Partnership Statement
                                <div className="absolute inset-0 bg-white/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </button>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-blue-50/50 p-8 rounded-3xl border-2 border-blue-100 hover:border-blue-300 transition-colors group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-600 group-hover:scale-110 transition-transform">
                                        <FaMoneyBillTrendUp size={24} />
                                    </div>
                                    <span className="text-[10px] font-black text-blue-600 bg-blue-100 px-2 py-1 rounded-full uppercase">Capital</span>
                                </div>
                                <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Total Company Investment</p>
                                <p className="text-4xl font-black text-blue-900 mt-2">
                                    <span className="text-sm font-bold mr-1">KES</span>
                                    {exposureData?.portfolio?.totalTopUp?.toLocaleString() || '0'}
                                </p>
                            </div>

                            <div className="bg-emerald-50/50 p-8 rounded-3xl border-2 border-emerald-100 hover:border-emerald-300 transition-colors group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-white rounded-2xl shadow-sm text-emerald-600 group-hover:scale-110 transition-transform">
                                        <FaShieldHalved size={24} />
                                    </div>
                                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full uppercase">Security</span>
                                </div>
                                <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Group Commitments Held</p>
                                <p className="text-4xl font-black text-emerald-900 mt-2">
                                    <span className="text-sm font-bold mr-1">KES</span>
                                    {exposureData?.security?.totalCommitment?.toLocaleString() || '0'}
                                </p>
                            </div>

                            <div className="relative overflow-hidden bg-white p-8 rounded-3xl border-2 border-gray-100 group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full -translate-y-12 translate-x-12"></div>
                                <div className="relative z-10 flex flex-col h-full justify-between">
                                    <div>
                                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Relationship Health</p>
                                        <div className="flex items-center gap-3 mt-4">
                                            <div className="text-4xl font-black text-gray-800">{scoreData?.score || 0}%</div>
                                            <div className={`px-3 py-1 rounded-full text-[10px] font-black ${scoreData?.label === 'EXCELLENT' ? 'bg-green-100 text-green-600' :
                                                scoreData?.label === 'RISKY' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
                                                }`}>
                                                {scoreData?.label}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-1000 ${(scoreData?.score || 0) >= 80 ? 'bg-green-500' : (scoreData?.score || 0) >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                                    }`}
                                                style={{ width: `${scoreData?.score || 0}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recent History Table */}
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                                    <FaRotate className="text-blue-500" />
                                    Recent Capital Injections
                                </h3>
                            </div>
                            <div className="overflow-x-auto rounded-2xl border border-gray-100">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50/50">
                                        <tr className="border-b border-gray-100">
                                            <th className="p-4 text-xs font-black text-gray-400 uppercase">Date</th>
                                            <th className="p-4 text-xs font-black text-gray-400 uppercase">Amount</th>
                                            <th className="p-4 text-xs font-black text-gray-400 uppercase">Reference / Notes</th>
                                            <th className="p-4 text-xs font-black text-gray-400 uppercase text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {exposureData?.portfolio?.investments?.length > 0 ? (
                                            exposureData.portfolio.investments.map((inv, idx) => (
                                                <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                                    <td className="p-4 text-sm font-bold text-gray-600">
                                                        {new Date(inv.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="text-sm font-black text-blue-900">KES {inv.amount.toLocaleString()}</span>
                                                    </td>
                                                    <td className="p-4 text-sm text-gray-500 italic">
                                                        {inv.notes || 'No description provided'}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase ${inv.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                                            }`}>
                                                            {inv.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="4" className="p-10 text-center text-gray-400 font-medium">
                                                    No recent investments found for this group.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. TOP-UP MANAGER */}
                {activeTab === 'topup' && (
                    <div className="p-6 md:p-10 max-w-2xl mx-auto h-full flex flex-col justify-center">
                        <div className="text-center mb-10">
                            <div className="inline-flex p-5 bg-blue-100 rounded-3xl text-blue-600 mb-4 shadow-inner">
                                <FaMoneyBillTrendUp size={48} />
                            </div>
                            <h2 className="text-3xl font-black text-gray-800 tracking-tight">Inject Growth Capital</h2>
                            <p className="text-gray-500 font-medium mt-2">Scale the Group Table Capacity with Secured Company Funding.</p>
                        </div>

                        <form onSubmit={handleSubmitTopUp(onTopUpSubmit)} className="space-y-6">
                            <div className="relative group">
                                <label className="block text-xs font-black text-gray-400 uppercase mb-2 ml-1">Investment Amount (KES)</label>
                                <div className="relative">
                                    <input
                                        {...registerTopUp('amount', { required: true, min: 1000 })}
                                        type="number"
                                        className="w-full bg-gray-50 border-2 border-gray-100 p-5 rounded-2xl text-2xl font-black text-blue-900 outline-none focus:border-blue-500 focus:bg-white focus:ring-8 focus:ring-blue-500/5 transition-all"
                                        placeholder="0.00"
                                    />
                                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300 font-bold">KSH</span>
                                </div>
                            </div>

                            <div className="relative">
                                <label className="block text-xs font-black text-gray-400 uppercase mb-2 ml-1">Internal Reference / Notes</label>
                                <textarea
                                    {...registerTopUp('notes')}
                                    className="w-full bg-gray-50 border-2 border-gray-100 p-5 rounded-2xl font-medium text-gray-700 outline-none focus:border-blue-500 focus:bg-white transition-all"
                                    placeholder="Purpose of injection e.g Expansion support..."
                                    rows="3"
                                ></textarea>
                            </div>

                            <div className="bg-amber-50 rounded-2xl border-l-8 border-amber-400 p-5 flex gap-4 items-center">
                                <FaTriangleExclamation className="text-amber-500 shrink-0 mt-1" />
                                <p className="text-xs font-bold text-amber-800 leading-relaxed uppercase">
                                    Capital injections improve loan limits but increase company exposure.
                                    Ensure the Group Relationship Score is above 60% before large top-ups.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full font-black py-5 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 ${loading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-blue-600/30'
                                    }`}
                            >
                                {loading && <FaCircleNotch className="animate-spin" />}
                                {loading ? 'TRANSACTING...' : 'CONFIRM CAPITAL INJECTION'}
                            </button>
                        </form>
                    </div>
                )}

                {/* 3. COMMITMENT DEPOSIT */}
                {activeTab === 'commitment' && (
                    <div className="p-6 md:p-10 max-w-2xl mx-auto h-full flex flex-col justify-center">
                        <div className="text-center mb-10">
                            <div className="inline-flex p-5 bg-emerald-100 rounded-3xl text-emerald-600 mb-4 shadow-inner">
                                <FaShieldHalved size={48} />
                            </div>
                            <h2 className="text-3xl font-black text-gray-800 tracking-tight">Record Group Security</h2>
                            <p className="text-gray-500 font-medium mt-2">Non-refundable commitment deposit to secure partnership.</p>
                        </div>

                        <form onSubmit={handleSubmitCommitment(onCommitmentSubmit)} className="space-y-6">
                            <div className="relative">
                                <label className="block text-xs font-black text-gray-400 uppercase mb-2 ml-1">Deposit Amount (KES)</label>
                                <div className="relative">
                                    <input
                                        {...registerCommitment('amount', { required: true, min: 100 })}
                                        type="number"
                                        className="w-full bg-gray-50 border-2 border-gray-100 p-5 rounded-2xl text-2xl font-black text-emerald-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-8 focus:ring-emerald-500/5 transition-all"
                                        placeholder="0.00"
                                    />
                                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300 font-bold text-xl">LOCKED</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase mb-2 ml-1">Deposit Reference / Date</label>
                                <textarea
                                    {...registerCommitment('notes')}
                                    className="w-full bg-gray-50 border-2 border-gray-100 p-5 rounded-2xl font-medium text-gray-700 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                    placeholder="e.g Monthly Security Batch #102"
                                    rows="3"
                                ></textarea>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full font-black py-5 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 ${loading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-emerald-600/30'
                                    }`}
                            >
                                {loading && <FaCircleNotch className="animate-spin" />}
                                {loading ? 'RECORDING...' : 'SECURE DEPOSIT NOW'}
                            </button>
                        </form>
                    </div>
                )}

                {/* 4. PRODUCT FINANCING */}
                {activeTab === 'products' && (
                    <div className="p-6 md:p-10 max-w-4xl mx-auto">
                        <div className="text-center mb-10">
                            <div className="inline-flex p-5 bg-purple-100 rounded-3xl text-purple-600 mb-4">
                                <FaTv size={48} />
                            </div>
                            <h2 className="text-3xl font-black text-gray-800 tracking-tight">Asset Financing Dispatch</h2>
                            <p className="text-gray-500 font-medium mt-2">Finance hardware or household products for verified members.</p>
                        </div>

                        <form onSubmit={handleSubmitProduct(onProductSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6 md:col-span-2">
                                <div className="relative">
                                    <label className="block text-xs font-black text-gray-400 uppercase mb-2 ml-1">Search & Select Verified Member</label>
                                    <div className="relative">
                                        <select
                                            {...registerProduct('memberId', { required: true })}
                                            className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl font-black text-gray-700 appearance-none focus:border-purple-500 transition-all"
                                        >
                                            <option value="">-- Choose Member --</option>
                                            {members.map(m => (
                                                <option key={m.id} value={m.id}>{m.name} ({m.phone})</option>
                                            ))}
                                        </select>
                                        <FaUserTie className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase mb-2 ml-1">Product Description</label>
                                    <input {...registerProduct('productName', { required: true })} className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl font-bold" placeholder="e.g. Solar Home System X1" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase mb-2 ml-1">Total Value</label>
                                        <input {...registerProduct('totalValue', { required: true })} type="number" className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl font-black" placeholder="0" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase mb-2 ml-1">Deposit Paid</label>
                                        <input {...registerProduct('commitmentPaid', { required: true })} type="number" className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl font-black" placeholder="0" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase mb-2 ml-1">Monthly Installment</label>
                                    <input {...registerProduct('monthlyInstallment', { required: true })} type="number" className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl font-black text-purple-700" placeholder="0" />
                                </div>

                                <div className={`p-5 rounded-2xl border-2 transition-all duration-500 ${(scoreData?.score || 0) < 40 ? 'bg-red-50 border-red-200' : 'bg-purple-50 border-purple-100'
                                    }`}>
                                    <div className="flex gap-3">
                                        {(scoreData?.score || 0) < 40 ? <FaTriangleExclamation className="text-red-500" /> : <FaCircleInfo className="text-purple-500" />}
                                        <div>
                                            <p className={`text-[10px] font-black uppercase ${(scoreData?.score || 0) < 40 ? 'text-red-600' : 'text-purple-600'
                                                }`}>
                                                {(scoreData?.score || 0) < 40 ? 'Action Restricted' : 'Financing Guard'}
                                            </p>
                                            <p className="text-xs font-bold text-gray-700 mt-1">
                                                {(scoreData?.score || 0) < 40
                                                    ? 'Group risk too high. Issuance requires Director approval.'
                                                    : 'Standard 10% Interest Rate will be applied to the financed balance.'}
                                            </p>
                                        </div>
                                    </div>

                                    {(scoreData?.score || 0) < 40 && (
                                        <label className="mt-4 flex items-center gap-3 cursor-pointer bg-white p-2 rounded-xl border border-red-100 hover:bg-red-50 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={supervisorOverride}
                                                onChange={(e) => setSupervisorOverride(e.target.checked)}
                                                className="w-5 h-5 accent-red-600"
                                            />
                                            <span className="text-[10px] font-black uppercase text-red-600">Director Override Enabled</span>
                                        </label>
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || ((scoreData?.score || 0) < 40 && !supervisorOverride)}
                                className={`md:col-span-2 font-black py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 ${loading || ((scoreData?.score || 0) < 40 && !supervisorOverride)
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/20 active:scale-[0.98]'
                                    }`}
                            >
                                {loading && <FaCircleNotch className="animate-spin" />}
                                {loading ? 'DISPATCHING...' : (scoreData?.score || 0) < 40 && !supervisorOverride ? 'LOCKED: HIGH RISK' : 'AUTHORIZE FINANCING & DISPATCH'}
                            </button>
                        </form>
                    </div>
                )}

                {/* 5. AUTO OFFSET (CLEAR DEBT) */}
                {activeTab === 'offset' && (
                    <div className="p-6 md:p-10 max-w-2xl mx-auto h-full flex flex-col justify-center">
                        <div className="text-center mb-8">
                            <div className="inline-flex p-5 bg-amber-100 rounded-3xl text-amber-600 mb-4 ring-8 ring-amber-50">
                                <FaUnlockKeyhole size={48} />
                            </div>
                            <h2 className="text-3xl font-black text-gray-800 tracking-tight">Debt Clearance Engine</h2>
                            <p className="text-gray-500 font-medium mt-2">Deduct from Group Commitment to settle a specific member's debt.</p>
                        </div>

                        <form onSubmit={handleSubmitOffset(onOffsetSubmit)} className="space-y-6">
                            <div className="relative">
                                <label className="block text-xs font-black text-gray-400 uppercase mb-2 ml-1">Select Member to Benefit</label>
                                <select
                                    {...registerOffset('memberId', { required: true })}
                                    className="w-full bg-gray-50 border-2 border-gray-100 p-5 rounded-2xl font-black text-gray-700 outline-none focus:border-amber-500 transition-all"
                                >
                                    <option value="">-- Choose Member --</option>
                                    {members.map(m => (
                                        <option key={m.id} value={m.id}>{m.name} (Debt: ~{m.activeLoans?.toLocaleString()})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="relative">
                                <label className="block text-xs font-black text-gray-400 uppercase mb-2 ml-1">Amount to Offset (KES)</label>
                                <div className="relative">
                                    <input
                                        {...registerOffset('amount', { required: true, min: 1 })}
                                        type="number"
                                        className="w-full bg-gray-50 border-2 border-gray-100 p-5 rounded-2xl text-2xl font-black text-amber-900 outline-none focus:border-amber-500 transition-all"
                                        placeholder="0.00"
                                    />
                                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-black">KSH</span>
                                </div>
                                <p className="text-[10px] font-black text-blue-600 mt-2 px-1 uppercase tracking-tight">
                                    Current Group Security Pool: KES {exposureData?.security?.totalCommitment?.toLocaleString() || '0'}
                                </p>
                            </div>

                            <div className="p-5 bg-amber-50 border-2 border-amber-100 rounded-2xl">
                                <div className="flex gap-4">
                                    <FaTriangleExclamation className="text-amber-500 shrink-0 mt-1" />
                                    <div className="space-y-1">
                                        <p className="text-xs font-black text-amber-800 uppercase">Irreversible Transaction</p>
                                        <p className="text-[11px] font-bold text-amber-700 leading-normal">
                                            This action directly reduces the non-refundable security pool held by the group.
                                            Use strictly for bad-debt recovery or group-approved member exits.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || (exposureData?.security?.totalCommitment || 0) <= 0}
                                className={`w-full font-black py-5 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 ${loading || (exposureData?.security?.totalCommitment || 0) <= 0
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                                    }`}
                            >
                                {loading && <FaCircleNotch className="animate-spin" />}
                                {loading ? 'CALCULATING...' : (exposureData?.security?.totalCommitment || 0) <= 0 ? 'LOCKED: ZERO BALANCE' : 'CONFIRM IRREVERSIBLE OFFSET'}
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {/* AI Advisor Hover Widget (Optional/Floating) */}
            <div className="hidden lg:flex fixed bottom-10 right-10 bg-white/80 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-white/20 items-center gap-4 animate-bounce-slow">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                    <FaCircleInfo size={20} />
                </div>
                <div className="pr-4">
                    <p className="text-[10px] font-black text-blue-600 uppercase">Antigravity Advisor</p>
                    <p className="text-xs font-bold text-gray-700">
                        {exposureData?.netExposure > 0
                            ? "Recommend increasing Group Commitments."
                            : "Financial health is optimal for expansion."}
                    </p>
                </div>
            </div>

            <style jsx="true">{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.6s ease-out forwards;
                }
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                @keyframes bounce-slow {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                .animate-bounce-slow {
                    animation: bounce-slow 4s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};

export default CompanyPartnershipManager;
