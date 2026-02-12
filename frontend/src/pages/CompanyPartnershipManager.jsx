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
import ApprovalQueue from '../components/ApprovalQueue';
import { useAuth } from '../context/AuthContext';

const CompanyPartnershipManager = () => {
    const { user, isAdmin, isDirector, isSupervisor } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [exposureData, setExposureData] = useState(null);
    const [matrixStatus, setMatrixStatus] = useState(null);
    const [scoreData, setScoreData] = useState(null);
    const [groups, setGroups] = useState([]);
    const [members, setMembers] = useState([]);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [supervisorOverride, setSupervisorOverride] = useState(false);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [commitmentHistory, setCommitmentHistory] = useState([]);
    const [productHistory, setProductHistory] = useState([]);
    const [autoCalculatedTopUp, setAutoCalculatedTopUp] = useState(0);
    // Member search state for searchable dropdown
    const [memberSearchQuery, setMemberSearchQuery] = useState('');
    const [selectedMember, setSelectedMember] = useState(null);
    const [showMemberDropdown, setShowMemberDropdown] = useState(false);
    const [offsetMemberSearchQuery, setOffsetMemberSearchQuery] = useState('');
    const [selectedOffsetMember, setSelectedOffsetMember] = useState(null);
    const [showOffsetMemberDropdown, setShowOffsetMemberDropdown] = useState(false);
    // Group search state for searchable dropdown
    const [groupSearchQuery, setGroupSearchQuery] = useState('');
    const [showGroupDropdown, setShowGroupDropdown] = useState(false);

    const { register: registerTopUp, handleSubmit: handleSubmitTopUp, reset: resetTopUp, setValue: setValueTopUp } = useForm();
    const { register: registerCommitment, handleSubmit: handleSubmitCommitment, reset: resetCommitment, setValue: setValueCommitment } = useForm();
    const { register: registerProduct, handleSubmit: handleSubmitProduct, reset: resetProduct, setValue: setValueProduct } = useForm();
    const { register: registerOffset, handleSubmit: handleSubmitOffset, reset: resetOffset, setValue: setValueOffset } = useForm();

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

    // 2. Load Exposure, Matrix & Pending Requests when Group changes
    useEffect(() => {
        if (selectedGroupId) {
            loadGroupPartnershipData(selectedGroupId);
            loadGroupMembers(selectedGroupId);
            loadPendingRequests();

            // Auto-generate Batch Reference for Security Deposit
            const batchRef = `Monthly Security Batch #${selectedGroupId}-${Date.now().toString().slice(-4)}`;
            setValueCommitment('notes', batchRef);
        }
    }, [selectedGroupId, setValueCommitment]);

    const loadGroupPartnershipData = async (groupId) => {
        try {
            setLoading(true);
            const [exposure, matrix, commitments, products] = await Promise.all([
                api.getGroupExposure(groupId),
                api.getMatrixStatus(groupId),
                api.getGroupCommitments(groupId),
                api.getGroupProducts(groupId)
            ]);
            setExposureData(exposure);
            setMatrixStatus(matrix);
            setCommitmentHistory(commitments || []);
            setProductHistory(products || []);
            // Derive scoreData from matrix for backward compatibility or use matrix directly
            setScoreData({
                score: matrix.score,
                label: matrix.currentTier.tier_name.toUpperCase(),
                reasons: matrix.isMaxTier ? ["Elite performance achieved."] : [`Unlock ${matrix.nextTier.tier_name} Tier at ${matrix.nextTier.min_score} points.`]
            });
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

    const loadPendingRequests = async () => {
        try {
            const requests = await api.getPendingTopUpRequests();
            setPendingRequests(requests);
        } catch (error) {
            console.error("Pending Requests Load Fail", error);
        }
    };

    // 💰 Submit Top-Up REQUEST (Not immediate)
    const onTopUpRequestSubmit = async (data) => {
        if (!data.commitmentAmount || parseFloat(data.commitmentAmount) <= 0) {
            return toast.error("Please enter a valid deposit amount to base the top-up on.");
        }
        if (!selectedGroupId) {
            return toast.error("No group selected.");
        }

        try {
            setLoading(true);
            const result = await api.requestTopUp({ ...data, groupId: selectedGroupId });
            toast.success(result.message);
            resetTopUp();
            setAutoCalculatedTopUp(0);
            loadPendingRequests();
        } catch (error) {
            // Error handled by api.js
        } finally {
            setLoading(false);
        }
    };

    // ✅ Admin Approves Request
    const handleApproveRequest = async (requestId) => {
        try {
            setLoading(true);
            const result = await api.approveTopUp(requestId);
            toast.success(result.message);
            loadPendingRequests();
            loadGroupPartnershipData(selectedGroupId);
        } catch (error) {
            // Error handled by api.js
        } finally {
            setLoading(false);
        }
    };

    // ❌ Admin Rejects Request
    const handleRejectRequest = async (requestId) => {
        const reason = prompt("Enter rejection reason (optional):");
        try {
            setLoading(true);
            await api.rejectTopUp(requestId, reason);
            toast.info("Request rejected.");
            loadPendingRequests();
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
            loadPendingRequests();
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
            loadGroupPartnershipData(selectedGroupId);
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

    // Filtered members for Product Financing searchable dropdown
    const filteredProductMembers = useMemo(() => {
        if (!memberSearchQuery.trim()) return members.slice(0, 10); // Show first 10 if empty
        return members.filter(m =>
            m.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
            m.phone?.includes(memberSearchQuery)
        ).slice(0, 15); // Limit to 15 results for performance
    }, [members, memberSearchQuery]);

    // Filtered members for Offset section
    const filteredOffsetMembers = useMemo(() => {
        if (!offsetMemberSearchQuery.trim()) return members.slice(0, 10);
        return members.filter(m =>
            m.name.toLowerCase().includes(offsetMemberSearchQuery.toLowerCase()) ||
            m.phone?.includes(offsetMemberSearchQuery)
        ).slice(0, 15);
    }, [members, offsetMemberSearchQuery]);

    // Filtered groups for searchable dropdown
    const filteredGroups = useMemo(() => {
        if (!groupSearchQuery.trim()) return groups.slice(0, 10);
        return groups.filter(g =>
            g.name.toLowerCase().includes(groupSearchQuery.toLowerCase()) ||
            g.id.toString().includes(groupSearchQuery)
        ).slice(0, 15);
    }, [groups, groupSearchQuery]);

    // Get selected group object
    const selectedGroup = useMemo(() => {
        return groups.find(g => g.id == selectedGroupId);
    }, [groups, selectedGroupId]);

    const tabs = [
        { id: 'overview', label: 'Overview', icon: <FaBriefcase />, color: 'blue' },
        { id: 'capital', label: 'Capital Injection', icon: <FaMoneyBillTrendUp />, color: 'blue' },
        { id: 'approval-queue', label: 'Approval Queue', icon: <FaCircleCheck />, color: 'green', adminOnly: true },
        { id: 'products', label: 'Product Financing', icon: <FaTv />, color: 'purple' },
        { id: 'offset', label: 'Clear Debt (Offset)', icon: <FaUnlockKeyhole />, color: 'orange', adminOnly: true },
    ].filter(tab => !tab.adminOnly || isAdmin || isDirector);

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
                                UKOMBOZINI Partnership Hub
                                {matrixStatus && (
                                    <span className={`ml-4 px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest border-2 shadow-lg animate-pulse ${matrixStatus.currentTier.color_code === 'gold' ? 'bg-yellow-400 text-yellow-950 border-yellow-200' :
                                        matrixStatus.currentTier.color_code === 'platinum' ? 'bg-slate-300 text-slate-900 border-white' :
                                            matrixStatus.currentTier.color_code === 'blue' ? 'bg-blue-500 text-white border-blue-300' :
                                                matrixStatus.currentTier.color_code === 'emerald' ? 'bg-emerald-500 text-white border-emerald-300' :
                                                    'bg-gray-500 text-white border-gray-300'
                                        }`}>
                                        Tier: {matrixStatus.currentTier.tier_name}
                                    </span>
                                )}
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
                            {/* Show selected group OR search input */}
                            {selectedGroup && !showGroupDropdown ? (
                                // Selected Group Display - Click to change
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowGroupDropdown(true);
                                        setGroupSearchQuery('');
                                    }}
                                    className="w-full md:w-80 p-3 pl-4 pr-10 border-2 border-gray-100 rounded-xl bg-gray-50 font-bold text-gray-700 hover:border-blue-500 hover:bg-blue-50 transition-all outline-none flex items-center gap-3 text-left"
                                >
                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center text-white text-sm font-black shadow">
                                        {selectedGroup.name.charAt(0)}
                                    </div>
                                    <span className="flex-1 font-black text-gray-800">{selectedGroup.name}</span>
                                    <span className="text-xs text-blue-500 font-bold">Change ▼</span>
                                </button>
                            ) : (
                                // Search Input
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={groupSearchQuery}
                                        onChange={(e) => {
                                            setGroupSearchQuery(e.target.value);
                                            setShowGroupDropdown(true);
                                        }}
                                        onFocus={() => setShowGroupDropdown(true)}
                                        placeholder="Type group name to search..."
                                        autoFocus={showGroupDropdown}
                                        className="w-full md:w-80 p-3 pl-4 pr-10 border-2 border-blue-300 rounded-xl bg-white font-bold text-gray-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                                    />
                                    <FaMagnifyingGlass className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400" />
                                </div>
                            )}

                            {/* Dropdown Results */}
                            {showGroupDropdown && (
                                <div className="absolute z-50 w-full md:w-80 mt-2 bg-white border-2 border-gray-100 rounded-2xl shadow-2xl max-h-72 overflow-y-auto">
                                    {/* Cancel search option */}
                                    {selectedGroup && (
                                        <button
                                            type="button"
                                            onClick={() => setShowGroupDropdown(false)}
                                            className="w-full p-3 bg-gray-50 border-b border-gray-200 text-xs font-black text-gray-500 hover:bg-gray-100 transition-colors text-center"
                                        >
                                            ✕ Cancel - Keep "{selectedGroup.name}"
                                        </button>
                                    )}

                                    {filteredGroups.length === 0 ? (
                                        <div className="p-6 text-center text-gray-400 font-bold">
                                            <FaHandshake className="text-3xl mx-auto mb-2 opacity-30" />
                                            {groupSearchQuery ? 'No groups found' : 'Start typing to search...'}
                                        </div>
                                    ) : (
                                        <>
                                            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                                                <span className="text-[10px] font-black text-gray-400 uppercase">
                                                    {groupSearchQuery ? `Found ${filteredGroups.length} groups` : `Showing ${filteredGroups.length} of ${groups.length} groups`}
                                                </span>
                                            </div>
                                            {filteredGroups.map(g => (
                                                <button
                                                    key={g.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedGroupId(g.id);
                                                        setGroupSearchQuery('');
                                                        setShowGroupDropdown(false);
                                                    }}
                                                    className={`w-full flex items-center gap-4 p-4 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-b-0 ${selectedGroupId == g.id ? 'bg-blue-50' : ''}`}
                                                >
                                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center text-white font-black shadow-lg">
                                                        {g.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 text-left">
                                                        <p className="font-black text-gray-800">{g.name}</p>
                                                        <p className="text-xs font-bold text-gray-400">ID: {g.id}</p>
                                                    </div>
                                                    {selectedGroupId == g.id && (
                                                        <span className="px-3 py-1 rounded-full text-[10px] font-black bg-blue-600 text-white">
                                                            Current
                                                        </span>
                                                    )}
                                                </button>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                        {/* Click outside to close */}
                        {showGroupDropdown && (
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowGroupDropdown(false)}
                            />
                        )}
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
                        {matrixStatus && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 rounded-full border border-purple-100">
                                <FaShieldHalved className="text-purple-600 text-xs" />
                                <span className="text-xs font-black text-purple-700 uppercase">
                                    Limit: {matrixStatus.funding.multiplier}x Deposits
                                </span>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

                            <div className="bg-purple-50/50 p-8 rounded-3xl border-2 border-purple-100 hover:border-purple-300 transition-colors group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-white rounded-2xl shadow-sm text-purple-600 group-hover:scale-110 transition-transform">
                                        <FaTv size={24} />
                                    </div>
                                    <span className="text-[10px] font-black text-purple-600 bg-purple-100 px-2 py-1 rounded-full uppercase">Assets</span>
                                </div>
                                <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Active Asset Financing</p>
                                <p className="text-4xl font-black text-purple-900 mt-2">
                                    <span className="text-sm font-bold mr-1">KES</span>
                                    {exposureData?.portfolio?.totalProductFinance?.toLocaleString() || '0'}
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

                            {/* Matrix Insights Card */}
                            <div className="md:col-span-3 bg-gradient-to-r from-gray-900 to-blue-900 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
                                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-black flex items-center gap-2">
                                            <FaBriefcase className="text-blue-400" />
                                            Partnership Matrix Insights
                                        </h3>
                                        <p className="text-blue-200 text-sm font-medium">
                                            {matrixStatus?.isMaxTier
                                                ? "You have reached the maximum tier. Enjoy elite benefits!"
                                                : `You are in ${matrixStatus?.currentTier.tier_name} Tier. Reach ${matrixStatus?.nextTier.min_score}% to unlock ${matrixStatus?.nextTier.tier_name}.`}
                                        </p>
                                    </div>
                                    <div className="flex gap-10">
                                        <div className="text-center">
                                            <p className="text-[10px] font-black text-blue-300 uppercase">Funding Capacity</p>
                                            <p className="text-2xl font-black">KES {matrixStatus?.funding.limit.toLocaleString()}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[10px] font-black text-blue-300 uppercase">Interest Rate</p>
                                            <p className="text-2xl font-black">{matrixStatus?.currentTier.interest_rate}% APR</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[10px] font-black text-blue-300 uppercase">Auto-Approval</p>
                                            <p className="text-2xl font-black">{matrixStatus?.currentTier.auto_approval_limit > 0 ? `KES ${matrixStatus.currentTier.auto_approval_limit.toLocaleString()}` : "NONE"}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute left-0 bottom-0 h-1 bg-blue-500 transition-all duration-1000" style={{ width: `${matrixStatus?.score || 0}%` }}></div>
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

                {/* 2. UNIFIED CAPITAL INJECTION (DEPOSIT + TOP-UP) */}
                {activeTab === 'capital' && (
                    <div className="p-4 md:p-8 space-y-10 animate-fade-in">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                            {/* Step A: Record physical commitment */}
                            <div className="bg-white border-2 border-emerald-50 rounded-[2.5rem] p-8 md:p-10 shadow-xl shadow-emerald-900/5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                                    <FaShieldHalved size={120} />
                                </div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="p-4 bg-emerald-100 rounded-3xl text-emerald-600 shadow-inner">
                                            <FaShieldHalved size={32} />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-gray-800 tracking-tight">1. Record Security Deposit</h2>
                                            <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">Physical Cash Inbound</p>
                                        </div>
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
                                                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-emerald-300 font-bold text-sm">SECURE</span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black text-gray-400 uppercase mb-2 ml-1">Deposit Reference / Date</label>
                                            <textarea
                                                {...registerCommitment('notes')}
                                                className="w-full bg-gray-50 border-2 border-gray-100 p-5 rounded-2xl font-medium text-gray-700 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                                placeholder="e.g Monthly Security Batch #102"
                                                rows="2"
                                            ></textarea>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className={`w-full font-black py-5 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 ${loading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-emerald-600/30'
                                                }`}
                                        >
                                            {loading && <FaCircleNotch className="animate-spin" />}
                                            {loading ? 'RECORDING...' : ((isAdmin || isDirector) ? 'RECORD SECURITY DEPOSIT' : 'SUBMIT DEPOSIT RECORD')}
                                        </button>
                                    </form>
                                </div>
                            </div>

                            {/* Step B: Request matching top-up */}
                            <div className="bg-white border-2 border-blue-50 rounded-[2.5rem] p-8 md:p-10 shadow-xl shadow-blue-900/5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                                    <FaMoneyBillTrendUp size={120} />
                                </div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="p-4 bg-blue-100 rounded-3xl text-blue-600 shadow-inner">
                                            <FaMoneyBillTrendUp size={32} />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-gray-800 tracking-tight">2. Request Company Top-Up</h2>
                                            <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">Strict 5x Institutional Injection</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleSubmitTopUp(onTopUpRequestSubmit)} className="space-y-6">
                                        <div className="relative">
                                            <div className="flex justify-between items-center mb-2 ml-1">
                                                <label className="block text-xs font-black text-gray-400 uppercase">Original Deposit Basis (KES)</label>
                                                {matrixStatus?.funding?.currentCommitment > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setValueTopUp('commitmentAmount', matrixStatus.funding.currentCommitment);
                                                            setAutoCalculatedTopUp(matrixStatus.funding.currentCommitment * 5);
                                                        }}
                                                        className="text-[10px] font-black text-blue-600 hover:underline uppercase"
                                                    >
                                                        Use Max (KES {matrixStatus.funding.currentCommitment.toLocaleString()})
                                                    </button>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <input
                                                    {...registerTopUp('commitmentAmount', {
                                                        required: true,
                                                        onChange: (e) => setAutoCalculatedTopUp(parseFloat(e.target.value) * 5)
                                                    })}
                                                    type="number"
                                                    className="w-full bg-gray-50 border-2 border-gray-100 p-5 rounded-2xl text-2xl font-black text-blue-900 outline-none focus:border-blue-500 focus:bg-white focus:ring-8 focus:ring-blue-500/5 transition-all"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-blue-50/50 border-2 border-blue-100 p-6 rounded-[2rem] flex items-center justify-between">
                                            <div>
                                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none mb-2">Calculated Top-Up (5x)</p>
                                                <p className="text-3xl font-black text-blue-900">KES {(autoCalculatedTopUp || 0).toLocaleString()}</p>
                                            </div>
                                            <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-blue-600/30">
                                                🚀
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={loading || !autoCalculatedTopUp}
                                            className={`w-full font-black py-5 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 ${loading || !autoCalculatedTopUp ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-blue-600/30'
                                                }`}
                                        >
                                            {loading && <FaCircleNotch className="animate-spin" />}
                                            {loading ? 'SUBMITTING...' : 'REQUEST TOP-UP AUTHORIZATION'}
                                        </button>
                                    </form>

                                </div>
                            </div>
                        </div>

                        {/* Unified History View */}
                        <div className="bg-white border-2 border-gray-50 rounded-[3rem] shadow-xl p-8 md:p-10">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                                <div className="flex items-center gap-5">
                                    <div className="p-4 bg-gray-100 rounded-3xl text-gray-600">
                                        <FaRotate size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-gray-800">Capital History</h3>
                                        <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">Audit Trail of Deposits & Top-Up Requests</p>
                                    </div>
                                </div>
                                <div className="flex bg-gray-100 p-1.5 rounded-2xl">
                                    <button className="px-6 py-2 bg-white rounded-xl shadow-sm text-xs font-black text-gray-800 uppercase tracking-widest">Consolidated View</button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                                {/* Commitment History */}
                                <div>
                                    <h4 className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></div>
                                        Physical Deposits
                                    </h4>
                                    <div className="overflow-x-auto rounded-3xl border-2 border-emerald-50">
                                        <table className="w-full text-left">
                                            <thead className="bg-emerald-50/50">
                                                <tr>
                                                    <th className="p-4 text-[10px] font-black text-emerald-800 uppercase">Date</th>
                                                    <th className="p-4 text-[10px] font-black text-emerald-800 uppercase">Amount</th>
                                                    <th className="p-4 text-[10px] font-black text-emerald-800 uppercase">Ref</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-emerald-50">
                                                {commitmentHistory.length > 0 ? (
                                                    commitmentHistory.map((c, i) => (
                                                        <tr key={i} className="hover:bg-emerald-50/30 transition-colors">
                                                            <td className="p-4 text-xs font-bold text-gray-500">{new Date(c.created_at).toLocaleDateString()}</td>
                                                            <td className="p-4 text-xs font-black text-emerald-900 border-l-4 border-emerald-500">KES {c.amount.toLocaleString()}</td>
                                                            <td className="p-4 text-xs text-gray-400 italic truncate max-w-[150px]">{c.notes}</td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr><td colSpan="3" className="p-8 text-center text-xs font-bold text-gray-300 uppercase">No Deposits</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Top-Up Request History */}
                                <div>
                                    <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div>
                                        Top-Up Requests
                                    </h4>
                                    <div className="overflow-x-auto rounded-3xl border-2 border-blue-50">
                                        <table className="w-full text-left">
                                            <thead className="bg-blue-50/50">
                                                <tr>
                                                    <th className="p-4 text-[10px] font-black text-blue-800 uppercase">Amount</th>
                                                    <th className="p-4 text-[10px] font-black text-blue-800 uppercase">Wait Basis</th>
                                                    <th className="p-4 text-[10px] font-black text-blue-800 uppercase text-center">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-blue-50">
                                                {pendingRequests.filter(r => r.group_id == selectedGroupId).length > 0 ? (
                                                    pendingRequests.filter(r => r.group_id == selectedGroupId).map((r, i) => (
                                                        <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                                                            <td className="p-4 text-xs font-black text-blue-900">KES {r.topup_amount.toLocaleString()}</td>
                                                            <td className="p-4 text-xs font-bold text-gray-400">5x of {r.commitment_amount.toLocaleString()}</td>
                                                            <td className="p-4 text-center">
                                                                <span className={`px-3 py-1 rounded-xl text-[8px] font-black uppercase ${r.status === 'PENDING' ? 'bg-orange-100 text-orange-600' :
                                                                    r.status === 'APPROVED' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                                                                    }`}>
                                                                    {r.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr><td colSpan="3" className="p-8 text-center text-xs font-bold text-gray-300 uppercase">No Active Requests</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2.5 APPROVAL QUEUE (NEW COMPONENT) */}
                {activeTab === 'approval-queue' && (
                    <ApprovalQueue
                        pendingRequests={pendingRequests}
                        loading={loading}
                        onApprove={handleApproveRequest}
                        onReject={handleRejectRequest}
                    />
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
                                        {/* Hidden input for form validation */}
                                        <input type="hidden" {...registerProduct('memberId', { required: true })} value={selectedMember?.id || ''} />

                                        {/* Searchable Input */}
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={memberSearchQuery}
                                                onChange={(e) => {
                                                    setMemberSearchQuery(e.target.value);
                                                    setShowMemberDropdown(true);
                                                    if (!e.target.value) {
                                                        setSelectedMember(null);
                                                        setValueProduct('memberId', '');
                                                    }
                                                }}
                                                onFocus={() => setShowMemberDropdown(true)}
                                                placeholder={selectedMember ? '' : 'Type member name or phone...'}
                                                className="w-full bg-gray-50 border-2 border-gray-100 p-4 pr-12 rounded-2xl font-bold text-gray-700 focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-500/10 transition-all outline-none"
                                            />
                                            <FaMagnifyingGlass className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />

                                            {/* Selected Member Badge */}
                                            {selectedMember && (
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-purple-100 px-3 py-1.5 rounded-xl">
                                                    <FaUserTie className="text-purple-600 text-sm" />
                                                    <span className="font-black text-purple-800 text-sm">{selectedMember.name}</span>
                                                    <span className={`text-xs font-bold ${selectedMember.active_asset_balance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                                        {selectedMember.active_asset_balance > 0 ? `Debt: KES ${selectedMember.active_asset_balance.toLocaleString()}` : '✓ Clean'}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedMember(null);
                                                            setMemberSearchQuery('');
                                                            setValueProduct('memberId', '');
                                                        }}
                                                        className="ml-1 text-purple-400 hover:text-purple-600 font-black"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Dropdown Results */}
                                        {showMemberDropdown && !selectedMember && (
                                            <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-100 rounded-2xl shadow-2xl max-h-72 overflow-y-auto">
                                                {filteredProductMembers.length === 0 ? (
                                                    <div className="p-6 text-center text-gray-400 font-bold">
                                                        <FaUserTie className="text-3xl mx-auto mb-2 opacity-30" />
                                                        {memberSearchQuery ? 'No members found' : 'Type to search members...'}
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                                                            <span className="text-[10px] font-black text-gray-400 uppercase">
                                                                Showing {filteredProductMembers.length} of {members.length} members
                                                            </span>
                                                        </div>
                                                        {filteredProductMembers.map(m => (
                                                            <button
                                                                key={m.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedMember(m);
                                                                    setMemberSearchQuery('');
                                                                    setValueProduct('memberId', m.id);
                                                                    setShowMemberDropdown(false);
                                                                }}
                                                                className="w-full flex items-center gap-4 p-4 hover:bg-purple-50 transition-colors border-b border-gray-50 last:border-b-0"
                                                            >
                                                                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 font-black">
                                                                    {m.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="flex-1 text-left">
                                                                    <p className="font-black text-gray-800">{m.name}</p>
                                                                    <p className="text-xs font-bold text-gray-400">{m.phone || 'No phone'}</p>
                                                                </div>
                                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black ${m.active_asset_balance > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                                    {m.active_asset_balance > 0 ? `Debt: KES ${m.active_asset_balance.toLocaleString()}` : 'Clean'}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {/* Click outside to close */}
                                    {showMemberDropdown && (
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setShowMemberDropdown(false)}
                                        />
                                    )}
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

                                <div className={`p-5 rounded-2xl border-2 transition-all duration-500 ${matrixStatus?.currentTier.tier_name === 'Probation' ? 'bg-red-50 border-red-200' : 'bg-purple-50 border-purple-100'
                                    }`}>
                                    <div className="flex gap-3">
                                        {matrixStatus?.currentTier.tier_name === 'Probation' ? <FaTriangleExclamation className="text-red-500" /> : <FaCircleInfo className="text-purple-500" />}
                                        <div>
                                            <p className={`text-[10px] font-black uppercase ${matrixStatus?.currentTier.tier_name === 'Probation' ? 'text-red-600' : 'text-purple-600'
                                                }`}>
                                                {matrixStatus?.currentTier.tier_name === 'Probation' ? 'Action Restricted' : 'Financing Guard'}
                                            </p>
                                            <p className="text-xs font-bold text-gray-700 mt-1">
                                                {matrixStatus?.currentTier.tier_name === 'Probation'
                                                    ? 'Group risk too high. Issuance requires Director approval.'
                                                    : `Standard ${matrixStatus?.currentTier.interest_rate}% Interest Rate will be applied.`}
                                            </p>
                                        </div>
                                    </div>

                                    {matrixStatus?.currentTier.tier_name === 'Probation' && (
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
                                disabled={loading || (matrixStatus?.currentTier.tier_name === 'Probation' && !supervisorOverride)}
                                className={`md:col-span-2 font-black py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 ${loading || (matrixStatus?.currentTier.tier_name === 'Probation' && !supervisorOverride)
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/20 active:scale-[0.98]'
                                    }`}
                            >
                                {loading && <FaCircleNotch className="animate-spin" />}
                                {loading ? 'DISPATCHING...' : (matrixStatus?.currentTier.tier_name === 'Probation' && !supervisorOverride) ? 'LOCKED: PROBATION TIER' : 'AUTHORIZE FINANCING & DISPATCH'}
                            </button>
                        </form>

                        {/* PRODUCT HISTORY TABLE */}
                        <div className="mt-16">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-black text-gray-800">Financing History</h3>
                                <span className="px-4 py-1 bg-purple-100 text-purple-700 rounded-full text-[10px] font-black uppercase">Active Assets</span>
                            </div>

                            {productHistory.length === 0 ? (
                                <div className="bg-gray-50 rounded-3xl p-10 text-center border-2 border-dashed border-gray-200">
                                    <p className="text-gray-400 font-bold">No active financing records for this group.</p>
                                </div>
                            ) : (
                                <div className="overflow-hidden border-2 border-gray-100 rounded-3xl bg-white shadow-sm">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 border-b-2 border-gray-100">
                                                <th className="p-4 text-[10px] font-black text-gray-400 uppercase">Member</th>
                                                <th className="p-4 text-[10px] font-black text-gray-400 uppercase">Product</th>
                                                <th className="p-4 text-[10px] font-black text-gray-400 uppercase text-right">Total Value</th>
                                                <th className="p-4 text-[10px] font-black text-gray-400 uppercase text-right">Monthly</th>
                                                <th className="p-4 text-[10px] font-black text-gray-400 uppercase">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y-2 divide-gray-50 font-bold text-sm">
                                            {productHistory.map((item) => (
                                                <tr key={item.id} className="hover:bg-purple-50/30 transition-colors">
                                                    <td className="p-4 text-gray-900">{item.member_name}</td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                                                                <FaTv size={12} />
                                                            </div>
                                                            {item.product_name}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-right text-gray-900">KES {item.total_value.toLocaleString()}</td>
                                                    <td className="p-4 text-right text-purple-600">KES {item.monthly_installment.toLocaleString()}</td>
                                                    <td className="p-4">
                                                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md text-[9px] font-black uppercase">
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
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
