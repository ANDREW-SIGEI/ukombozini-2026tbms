import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    FaUserPlus, FaMagnifyingGlass, FaClockRotateLeft, FaUser, FaCircleInfo,
    FaFileInvoice, FaMoneyBillWave, FaClock, FaSpinner,
    FaChartLine, FaTriangleExclamation, FaCircleCheck,
    FaPenToSquare, FaHandHoldingDollar, FaCoins, FaLock,
    FaFilePdf, FaFileExcel, FaCalendarDays, FaWifi
} from 'react-icons/fa6';
import { toast } from 'react-toastify';
import { api } from '../services/api';
import { useTransactions } from '../context/TransactionContext';
import { useAuth } from '../context/AuthContext';
import SmartTransactionPanel from '../components/SmartTransactionPanel';
import offlineManager from '../services/OfflineManager';

const RELATIONSHIP_OPTIONS = [
    'Spouse', 'Parent', 'Child', 'Sibling', 'Grandparent', 'Grandchild', 'Cousin', 'Business Partner', 'Other'
];

const Members = () => {
    const { user, isAuditor } = useAuth();
    const navigate = useNavigate();
    const { activeSession } = useTransactions();
    const [searchTerm, setSearchTerm] = useState('');
    const [showEditModal, setShowEditModal] = useState(false);
    const [editFormData, setEditFormData] = useState({
        id: '', name: '', phone: '', national_id: '', groupId: '', status: 'active',
        nextOfKinName: '', nextOfKinPhone: '', nextOfKinRelationship: ''
    });
    const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);

    useEffect(() => {
        const handleStatus = () => setIsOfflineMode(!navigator.onLine);
        window.addEventListener('online', handleStatus);
        window.addEventListener('offline', handleStatus);
        return () => {
            window.removeEventListener('online', handleStatus);
            window.removeEventListener('offline', handleStatus);
        };
    }, []);

    const [searchSuggestions, setSearchSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState('');
    const [members, setMembers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMember, setSelectedMember] = useState(null);
    const [showTransactionPanel, setShowTransactionPanel] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);


    // ZONE D: Profile Drill-Down State
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [profileData, setProfileData] = useState(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('overview'); // overview, savings, loans, risk

    // NEW: Member Statement Export State
    const [statementStartDate, setStatementStartDate] = useState('');
    const [statementEndDate, setStatementEndDate] = useState('');

    const [newMember, setNewMember] = useState({
        name: '',
        phone: '',
        groupId: '',
        opening_balance_savings: 0,
        opening_balance_reason: '', // Audit reason
        opening_balance_ltl: 0,    // Existing Long Term Loan
        opening_balance_stl: 0,    // Existing Short Term Loan
        nextOfKinName: '',
        nextOfKinPhone: '',
        nextOfKinRelationship: '',
        nextOfKinMemberId: '',
        national_id: ''
    });
    const [phoneError, setPhoneError] = useState('');

    // ZONE B: Filter States (Thinking Tools)
    const [filterStatus, setFilterStatus] = useState('All'); // All, Healthy, Stable, Risk
    const [filterHasLoan, setFilterHasLoan] = useState(false); // Toggle

    // INTELLIGENCE LOGIC 🧠
    const calculateRiskScore = (member) => {
        let score = 0;
        const savings = member.current_savings || 0;
        const loan = member.active_loan_balance || 0;

        // Rule 1: High Leverage (Loan > Savings) -> +40
        if (loan > savings) score += 40;

        // Rule 2: Active Debt Exposure -> +10
        if (loan > 0) score += 10;

        // Rule 3: Low/Inactive Savings (Below Min 500) -> +10
        if (savings < 500) score += 10;

        // Rule 4: Critical Exposure (> 10k negative) -> +30
        if ((savings - loan) < -10000) score += 30;

        return Math.min(score, 100);
    };

    const getRiskInfo = (score) => {
        if (score <= 30) return { level: 'Healthy', color: 'green', badge: 'bg-green-100 text-green-700 border-green-200' };
        if (score <= 60) return { level: 'Stable', color: 'amber', badge: 'bg-amber-100 text-amber-700 border-amber-200' };
        return { level: 'At Risk', color: 'red', badge: 'bg-red-100 text-red-700 border-red-200' };
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [membersData, groupsData] = await Promise.all([
                api.getMembers(),
                api.getGroups()
            ]);

            if (membersData) {
                setMembers(membersData);
                // Proactive Caching for Offline Access
                await offlineManager.cacheMembers(membersData);
            }
            if (groupsData) setGroups(groupsData);
        } catch (error) {
            console.error("Fetch failed, checking offline cache:", error);

            // Try Loading from Offline Cache
            const cachedMembers = await offlineManager.getCachedMembers();
            if (cachedMembers && cachedMembers.length > 0) {
                setMembers(cachedMembers);
                toast.info("📱 Operating from local cache (Offline)");
            } else {
                toast.error("Failed to load members data");
            }
        } finally {
            setLoading(false);
        }
    };

    // Calculate Net Position & Intelligence for each member
    const membersWithIntelligence = useMemo(() => {
        return members.map(member => {
            const savings = member.current_savings || 0;
            const activeLoans = member.active_loan_balance || 0;
            const netPosition = savings - activeLoans;
            // Prioritize backend-calculated longitudinal risk score
            const riskScore = (member.risk_score !== null && member.risk_score !== undefined)
                ? member.risk_score
                : calculateRiskScore(member);
            const riskInfo = getRiskInfo(riskScore);

            return {
                ...member,
                full_name: member.name,
                savings,
                activeLoans,
                netPosition,
                riskScore,
                riskInfo
            };
        });
    }, [members]);

    // Filter members with Intelligence
    const filteredMembers = useMemo(() => {
        return membersWithIntelligence.filter(member => {
            const matchesSearch =
                member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                member.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                member.group_role?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesGroup = selectedGroup ? member.group_id?.toString() === selectedGroup : true;

            // Smart Filters
            const matchesStatus = filterStatus === 'All' ? true : member.riskInfo.level === filterStatus;
            const matchesLoan = filterHasLoan ? member.activeLoans > 0 : true;

            return matchesSearch && matchesGroup && matchesStatus && matchesLoan;
        });
    }, [membersWithIntelligence, searchTerm, selectedGroup, filterStatus, filterHasLoan]);

    // Auto-suggest logic
    useEffect(() => {
        if (searchTerm.length > 1) {
            const matches = membersWithIntelligence
                .filter(m =>
                    m.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    m.phone?.includes(searchTerm)
                )
                .slice(0, 5); // Limit to 5 suggestions
            setSearchSuggestions(matches);
            setShowSuggestions(true);
        } else {
            setSearchSuggestions([]);
            setShowSuggestions(false);
        }
    }, [searchTerm, membersWithIntelligence]);

    const handleSelectSuggestion = (member) => {
        setSearchTerm(member.full_name);
        setShowSuggestions(false);
    };

    // ZONE A: Live Intelligence Strip Stats
    const systemIntelligence = useMemo(() => {
        const base = filteredMembers;

        return {
            totalMembers: base.length,
            activeSavers: base.filter(m => m.savings > 0).length,
            activeBorrowers: base.filter(m => m.activeLoans > 0).length,
            atRiskCount: base.filter(m => m.riskInfo && m.riskInfo.level === 'At Risk').length,
            netExposure: base.reduce((sum, m) => sum + m.netPosition, 0)
        };
    }, [filteredMembers]);

    const validatePhone = (phone) => {
        // Kenyan phone regex: Starts with 07 or 01, followed by 8 digits
        const phoneRegex = /^0(7|1)\d{8}$/;
        return phoneRegex.test(phone);
    };

    const handlePhoneChange = (e) => {
        let phone = e.target.value;

        // Smart Handling:
        // 1. Auto-correct 'O' or 'o' to '0'
        phone = phone.replace(/[Oo]/g, '0');

        // 2. Remove all non-numeric characters to prevent invalid input
        phone = phone.replace(/[^0-9]/g, '');

        setNewMember({ ...newMember, phone });

        if (phone) {
            if (!validatePhone(phone)) {
                if (phone.length !== 10) {
                    setPhoneError(`Must be exactly 10 digits (Current: ${phone.length})`);
                } else if (!/^0(7|1)/.test(phone)) {
                    setPhoneError('Must start with 07 or 01');
                } else {
                    setPhoneError('Invalid format');
                }
            } else {
                setPhoneError('');
            }
        } else {
            setPhoneError('');
        }
    };

    const handleAddMember = async (e) => {
        e.preventDefault();
        if (isAuditor) {
            toast.warning("🛡️ Auditor Mode: Record creation is blocked.");
            return;
        }

        if (!validatePhone(newMember.phone)) {
            toast.error('Please enter a valid Kenyan phone number (e.g., 0712345678)');
            return;
        }

        if (!newMember.name || !newMember.phone || !newMember.groupId) {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            const payload = {
                full_name: newMember.name,
                phone: newMember.phone,
                group_id: parseInt(newMember.groupId),
                opening_balance_savings: parseFloat(newMember.opening_balance_savings || 0),
                opening_balance_reason: newMember.opening_balance_reason,
                opening_balance_ltl: parseFloat(newMember.opening_balance_ltl || 0),
                opening_balance_stl: parseFloat(newMember.opening_balance_stl || 0),
                next_of_kin_name: newMember.nextOfKinName,
                next_of_kin_phone: newMember.nextOfKinPhone,
                next_of_kin_relationship: newMember.nextOfKinRelationship,
                next_of_kin_member_id: newMember.nextOfKinMemberId ? parseInt(newMember.nextOfKinMemberId) : null,
                national_id: newMember.national_id
            };

            await api.createMember(payload);
            toast.success(`✅ ${newMember.name} added successfully!`);
            setShowAddModal(false);
            setNewMember({
                name: '', phone: '', groupId: '', opening_balance_savings: 0,
                opening_balance_reason: '', opening_balance_ltl: 0, opening_balance_stl: 0,
                nextOfKinName: '', nextOfKinPhone: '', nextOfKinRelationship: '', nextOfKinMemberId: '',
                national_id: ''
            });
            fetchData(); // Refresh list
        } catch (error) {
            console.error(error);
            toast.error("Failed to add member");
        }
    };

    const handleDeleteMember = async (id, name) => {
        if (isAuditor) {
            toast.warning("🛡️ Auditor Mode: Record deletion is blocked.");
            return;
        }
        if (window.confirm(`Are you sure you want to delete member ${name}? This action cannot be undone if they have no financial history.`)) {
            try {
                const response = await api.deleteMember(id);
                if (response.success) {
                    toast.success("Member record removed successfully");
                    fetchData();
                }
            } catch (error) {
                console.error("Delete Member Error:", error);
            }
        }
    };

    const openEditModal = (member) => {
        setEditFormData({
            id: member.id,
            name: member.name,
            phone: member.phone,
            groupId: member.group_id,
            status: member.status || 'active',
            nextOfKinName: member.next_of_kin_name || '',
            nextOfKinPhone: member.next_of_kin_phone || '',
            nextOfKinRelationship: member.next_of_kin_relationship || '',
            national_id: member.national_id || ''
        });
        setShowEditModal(true);
    };

    const handleEditMember = async (e) => {
        e.preventDefault();
        if (isAuditor) {
            toast.warning("🛡️ Auditor Mode: Record modification is blocked.");
            return;
        }
        try {
            await api.updateMember(editFormData.id, {
                name: editFormData.name,
                phone: editFormData.phone,
                groupId: editFormData.groupId,
                status: editFormData.status,
                next_of_kin_name: editFormData.nextOfKinName,
                next_of_kin_phone: editFormData.nextOfKinPhone,
                next_of_kin_relationship: editFormData.nextOfKinRelationship,
                national_id: editFormData.national_id
            });
            toast.success("✅ Profile updated successfully!");
            setShowEditModal(false);
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error("Failed to update profile.");
        }
    };

    const getStatusBadge = (netPosition) => {
        if (netPosition > 5000) {
            return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold flex items-center gap-1">
                <FaCircleCheck /> Healthy
            </span>;
        } else if (netPosition >= 0) {
            return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold flex items-center gap-1">
                <FaCircleInfo /> Stable
            </span>;
        } else {
            return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold flex items-center gap-1">
                <FaTriangleExclamation /> At Risk
            </span>;
        }
    };



    const openTransactionPanel = (member) => {
        if (isAuditor) {
            toast.warning("🛡️ Auditor Mode: Financial operations are blocked.");
            return;
        }
        setSelectedMember(member);
        setShowTransactionPanel(true);
    };


    const handleMemberClick = async (member) => {
        setSelectedMember(member);
        setShowProfileModal(true);
        setActiveTab('overview');
        setProfileLoading(true);

        try {
            // Fetch financial history
            const [transactions, loans, riskReport] = await Promise.all([
                api.getTransactions(member.id),
                api.getLoans(member.id),
                api.getMemberRisk(member.id)
            ]);

            setProfileData({
                member: member,
                transactions: transactions || [],
                loans: loans || [],
                risk: riskReport
            });
        } catch (error) {
            console.error("Failed to load profile details", error);
            toast.error("Could not load full profile details");
        } finally {
            setProfileLoading(false);
        }
    };

    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                            Member Directory
                            {isOfflineMode && (
                                <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase rounded-full border border-amber-200">
                                    <FaWifi className="opacity-50" /> Offline Mode
                                </span>
                            )}
                        </h2>
                        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-1 ml-1 flex items-center gap-2">
                            {filteredMembers.length} Active Members
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            if (isAuditor) {
                                toast.warning("🛡️ Auditor Mode: Record creation is blocked.");
                                return;
                            }
                            setShowAddModal(true);
                        }}
                        className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold transition-colors shadow-md ${isAuditor ? 'bg-gray-400 cursor-not-allowed' : 'bg-safaricom-green text-white hover:bg-green-700'}`}
                    >
                        <FaUserPlus /> Register New Member
                    </button>
                </div>

                {/* ZONE A: Live Intelligence Strip */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-white border border-gray-200 p-4 rounded-2xl shadow-sm">
                    <div className="text-center md:text-left md:pl-4 border-r border-gray-100 last:border-0 border-r-0">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Members</div>
                        <div className="text-2xl font-black text-gray-800">{systemIntelligence.totalMembers}</div>
                    </div>
                    <div className="text-center md:text-left md:pl-4 border-r border-gray-100 last:border-0">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Active Savers</div>
                        <div className="text-2xl font-black text-safaricom-green">{systemIntelligence.activeSavers}</div>
                    </div>
                    <div className="text-center md:text-left md:pl-4 border-r border-gray-100 last:border-0">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Borrowers</div>
                        <div className="text-2xl font-black text-blue-600">{systemIntelligence.activeBorrowers}</div>
                    </div>
                    <div className="text-center md:text-left md:pl-4 border-r border-gray-100 last:border-0">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">At Risk</div>
                        <div className="text-2xl font-black text-red-500 flex items-center justify-center md:justify-start gap-2">
                            {systemIntelligence.atRiskCount}
                            {systemIntelligence.atRiskCount > 0 && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full animate-pulse">ACTION REQ</span>}
                        </div>
                    </div>
                    <div className="text-center md:text-left md:pl-4">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Net Exposure</div>
                        <div className={`text-2xl font-black ${systemIntelligence.netExposure >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {systemIntelligence.netExposure < 0 ? '-' : ''}KES {Math.abs(systemIntelligence.netExposure).toLocaleString()}
                        </div>
                    </div>
                </div>

                {/* ZONE B: Thinking Tools (Filters) */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        {/* Search */}
                        <div className="flex-1 w-full relative">
                            <FaMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name, phone or role..."
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-safaricom-green/50 font-bold text-gray-600"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onFocus={() => setShowSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            />
                            {/* Auto-suggestions Dropdown */}
                            {showSuggestions && searchSuggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-20 overflow-hidden">
                                    {searchSuggestions.map(suggestion => (
                                        <div
                                            key={suggestion.id}
                                            onClick={() => handleSelectSuggestion(suggestion)}
                                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 flex justify-between items-center"
                                        >
                                            <div>
                                                <div className="font-bold text-gray-700">{suggestion.full_name}</div>
                                                <div className="text-xs text-gray-500">{suggestion.phone}</div>
                                            </div>
                                            <div className="text-xs font-bold text-safaricom-green">
                                                {suggestion.groupName}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Group Filter */}
                        <select
                            value={selectedGroup}
                            onChange={(e) => setSelectedGroup(e.target.value)}
                            className="bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-600 focus:outline-none focus:border-safaricom-green/50 min-w-[200px]"
                        >
                            <option value="">All Groups</option>
                            {groups.map(group => (
                                <option key={group.id} value={group.id}>{group.group_name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Intelligent Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Status Tabs */}
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            {['All', 'Healthy', 'Stable', 'At Risk'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={`px-4 py-1.5 rounded-md text-xs font-black uppercase tracking-wide transition-all ${filterStatus === status
                                        ? 'bg-white text-gray-800 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>

                        <div className="w-px h-6 bg-gray-200 mx-2 hidden md:block"></div>

                        {/* Loan Toggle */}
                        <button
                            onClick={() => setFilterHasLoan(!filterHasLoan)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold border-2 transition-all flex items-center gap-2 ${filterHasLoan
                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                                }`}
                        >
                            <FaMoneyBillWave /> Has Active Loan
                        </button>
                    </div>
                </div>

                {/* ZONE C: Intelligent Matrix Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-200 text-[10px] uppercase tracking-wider text-gray-500 font-black font-sans">
                                    <th className="px-6 py-4">Member / Group</th>
                                    <th className="px-6 py-4 text-right">Savings (KES)</th>
                                    <th className="px-6 py-4 text-right">Active Loan</th>
                                    <th className="px-6 py-4 text-right">Net Position</th>
                                    <th className="px-6 py-4 text-center">Risk Score</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <FaSpinner className="animate-spin text-3xl text-safaricom-green" />
                                                <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Running Audits...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredMembers.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center justify-center gap-4">
                                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-300 text-2xl">
                                                    <FaMagnifyingGlass />
                                                </div>
                                                <div className="text-center">
                                                    <h3 className="text-lg font-black text-gray-700">No Records Match Filters</h3>
                                                    <p className="text-sm text-gray-400 font-bold max-w-xs mx-auto mt-1">
                                                        Targeted filters returned no results. Try adjusting the scope.
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredMembers.map((member) => {
                                        const initials = member.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

                                        return (
                                            <tr key={member.id} className="group hover:bg-gray-50/80 transition-all duration-200">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shadow-sm group-hover:scale-110 transition-transform ${member.riskInfo.level === 'Healthy' ? 'bg-green-100 text-green-700' :
                                                            member.riskInfo.level === 'Stable' ? 'bg-amber-100 text-amber-700' :
                                                                'bg-red-100 text-red-700'
                                                            }`}>
                                                            {initials}
                                                        </div>
                                                        <div>
                                                            <div className="font-black text-gray-800 text-sm group-hover:text-blue-600 transition-colors flex items-center gap-2">
                                                                {member.name}
                                                            </div>
                                                            <div className="text-[10px] font-bold text-gray-400 flex items-center gap-1 uppercase">
                                                                {member.groupName}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="font-mono font-bold text-gray-700">
                                                        {(member.savings || 0).toLocaleString()}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className={`font-mono font-bold ${(member.activeLoans || 0) > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                                                        {(member.activeLoans || 0).toLocaleString()}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className={`font-mono font-black ${member.netPosition >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                        {member.netPosition >= 0 ? '+' : ''}{member.netPosition.toLocaleString()}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <span className={`text-xs font-black ${member.riskScore <= 30 ? 'text-green-600' :
                                                            member.riskScore <= 60 ? 'text-amber-600' :
                                                                'text-red-600'
                                                            }`}>
                                                            {member.riskScore}/100
                                                        </span>
                                                        <div className="w-12 h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                                                            <div
                                                                className={`h-full ${member.riskScore <= 30 ? 'bg-green-500' :
                                                                    member.riskScore <= 60 ? 'bg-amber-500' :
                                                                        'bg-red-500'
                                                                    }`}
                                                                style={{ width: `${member.riskScore}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${member.riskInfo.badge}`}>
                                                        {member.riskInfo.level}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleMemberClick(member); }}
                                                            className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-bold text-[10px] uppercase hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                                                        >
                                                            <FaFileInvoice /> Profile
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (isAuditor) {
                                                                    toast.warning("🛡️ Auditor Mode: Financial operations are blocked.");
                                                                    return;
                                                                }
                                                                setSelectedMember(member);
                                                                setShowTransactionPanel(true);
                                                            }}
                                                            className="px-3 py-1.5 bg-safaricom-green text-white rounded-lg font-bold text-[10px] uppercase hover:bg-green-700 transition-colors shadow-sm flex items-center gap-1.5"
                                                        >
                                                            <FaMoneyBillWave /> New Trans
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>




                {/* Add Member Modal */}
                {
                    showAddModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
                            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-200 overflow-hidden border border-white/20">
                                {/* Gradient Header */}
                                <div className="bg-gradient-to-r from-safaricom-green to-green-800 p-6 flex justify-between items-center text-white">
                                    <h3 className="text-xl font-black flex items-center gap-2 text-shadow-sm">
                                        <FaUserPlus className="text-white/80" /> Register New Member
                                    </h3>
                                    <button
                                        onClick={() => setShowAddModal(false)}
                                        className="text-white/60 hover:text-white hover:bg-white/10 rounded-full w-8 h-8 flex items-center justify-center transition-all text-xl"
                                    >
                                        ×
                                    </button>
                                </div>

                                <div className="p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
                                    <form onSubmit={handleAddMember} className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Full Name *</label>
                                            <input
                                                type="text"
                                                value={newMember.name}
                                                onChange={(e) => {
                                                    // Smart Formatting: Auto-capitalize Words
                                                    const val = e.target.value.replace(/\b\w/g, c => c.toUpperCase());
                                                    setNewMember({ ...newMember, name: val });
                                                }}
                                                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-safaricom-green/50 font-bold transition-all text-gray-800 placeholder-gray-300 hover:bg-white"
                                                placeholder="e.g. John Doe"
                                                required
                                            />
                                        </div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Phone Number *</label>
                                        <input
                                            type="tel"
                                            value={newMember.phone}
                                            onChange={handlePhoneChange}
                                            className={`w-full px-4 py-3 bg-gray-50 border-2 rounded-xl focus:outline-none font-bold ${phoneError ? 'border-red-300 focus:border-red-500' : 'border-gray-100 focus:border-safaricom-green/50'}`}
                                            placeholder="0712345678"
                                            required
                                        />
                                        {phoneError && (
                                            <p className="text-red-500 text-xs mt-1 font-bold flex items-center gap-1">
                                                <FaTriangleExclamation /> {phoneError}
                                            </p>
                                        )}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">National ID / Identity Number *</label>
                                            <input
                                                type="text"
                                                value={newMember.national_id}
                                                onChange={(e) => setNewMember({ ...newMember, national_id: e.target.value.replace(/\D/g, '') })}
                                                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-safaricom-green/50 font-bold"
                                                placeholder="e.g. 12345678"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Group *</label>
                                            <select
                                                value={newMember.groupId}
                                                onChange={(e) => setNewMember({ ...newMember, groupId: e.target.value })}
                                                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-safaricom-green/50 font-bold"
                                                required
                                            >
                                                <option value="">Select Group</option>
                                                {groups.map(group => (
                                                    <option key={group.id} value={group.id}>{group.group_name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
                                            <div className="flex items-center gap-2 text-blue-800">
                                                <FaUser className="text-sm" />
                                                <h4 className="text-xs font-black uppercase tracking-wide">Next of Kin Details</h4>
                                            </div>
                                            <div className="grid grid-cols-1 gap-3">
                                                <div className="flex gap-2">
                                                    <div className="flex-1">
                                                        <input
                                                            type="text"
                                                            value={newMember.nextOfKinName}
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/\b\w/g, c => c.toUpperCase());
                                                                setNewMember({ ...newMember, nextOfKinName: val });
                                                            }}
                                                            className="w-full px-4 py-2 bg-white border border-blue-100 rounded-lg text-sm font-bold"
                                                            placeholder="NoK Full Name"
                                                            disabled={!!newMember.nextOfKinMemberId}
                                                        />
                                                    </div>
                                                    <select
                                                        className="w-40 px-2 py-2 bg-white border border-blue-100 rounded-lg text-xs font-bold"
                                                        value={newMember.nextOfKinMemberId || ""}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (val === "") {
                                                                setNewMember({ ...newMember, nextOfKinMemberId: '', nextOfKinName: '', nextOfKinPhone: '' });
                                                            } else {
                                                                const m = members.find(mem => mem.id === parseInt(val));
                                                                setNewMember({
                                                                    ...newMember,
                                                                    nextOfKinMemberId: val,
                                                                    nextOfKinName: m.name,
                                                                    nextOfKinPhone: m.phone
                                                                });
                                                            }
                                                        }}
                                                    >
                                                        <option value="">Link Member...</option>
                                                        {members.map(m => (
                                                            <option key={m.id} value={m.id}>{m.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input
                                                        type="tel"
                                                        value={newMember.nextOfKinPhone}
                                                        onChange={(e) => setNewMember({ ...newMember, nextOfKinPhone: e.target.value })}
                                                        className="w-full px-4 py-2 bg-white border border-blue-100 rounded-lg text-sm font-bold"
                                                        placeholder="NoK Phone"
                                                        disabled={!!newMember.nextOfKinMemberId}
                                                    />
                                                    <select
                                                        value={newMember.nextOfKinRelationship}
                                                        onChange={(e) => setNewMember({ ...newMember, nextOfKinRelationship: e.target.value })}
                                                        className="w-full px-4 py-2 bg-white border border-blue-100 rounded-lg text-sm font-bold"
                                                        required={newMember.nextOfKinName?.length > 0}
                                                    >
                                                        <option value="">Relationship</option>
                                                        {RELATIONSHIP_OPTIONS.map(opt => (
                                                            <option key={opt} value={opt}>{opt}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Loan Eligibility Preview */}
                                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                            <label className="block text-xs font-bold text-blue-700 uppercase mb-2 flex items-center gap-1">
                                                <FaChartLine /> Projected Loan Eligibility
                                            </label>
                                            <div className="flex justify-between items-end">
                                                <div>
                                                    <span className="text-xs text-blue-600">Based on 3x Multiplier</span>
                                                </div>
                                                <div className="text-2xl font-black text-blue-800">
                                                    KES {((parseFloat(newMember.opening_balance_savings) || 0) * 3).toLocaleString()}
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-blue-500 font-bold mt-2 flex items-center gap-1">
                                                <FaTriangleExclamation /> Note: Eligibility activates only after 3 months of consistent saving.
                                            </p>
                                        </div>

                                        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 space-y-4">
                                            <div className="flex items-center gap-2 text-yellow-800">
                                                <FaLock className="text-sm" />
                                                <h4 className="text-xs font-black uppercase tracking-wide">Opening Balance Protocol</h4>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Savings Balance (BF)</label>
                                                    <input
                                                        type="number"
                                                        value={newMember.opening_balance_savings}
                                                        onChange={(e) => setNewMember({ ...newMember, opening_balance_savings: e.target.value })}
                                                        className="w-full px-4 py-3 bg-white border-2 border-yellow-100 rounded-xl focus:outline-none focus:border-yellow-400 font-bold text-gray-800"
                                                        placeholder="0"
                                                        min="0"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Audit Reason *</label>
                                                    <input
                                                        type="text"
                                                        value={newMember.opening_balance_reason}
                                                        onChange={(e) => {
                                                            const val = e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1);
                                                            setNewMember({ ...newMember, opening_balance_reason: val });
                                                        }}
                                                        className="w-full px-4 py-3 bg-white border-2 border-yellow-100 rounded-xl focus:outline-none focus:border-yellow-400 font-bold text-sm"
                                                        placeholder="e.g. Migrated from Paper Records"
                                                        required={parseFloat(newMember.opening_balance_savings) > 0 || parseFloat(newMember.opening_balance_ltl) > 0}
                                                    />
                                                </div>
                                            </div>

                                            {/* Existing Loans Migration */}
                                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-yellow-100">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Existing LTL (Long Term)</label>
                                                    <input
                                                        type="number"
                                                        value={newMember.opening_balance_ltl}
                                                        onChange={(e) => setNewMember({ ...newMember, opening_balance_ltl: e.target.value })}
                                                        className="w-full px-3 py-2 bg-white border border-yellow-100 rounded-lg text-sm font-bold text-red-600"
                                                        placeholder="0"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Existing STL (Short Term)</label>
                                                    <input
                                                        type="number"
                                                        value={newMember.opening_balance_stl}
                                                        onChange={(e) => setNewMember({ ...newMember, opening_balance_stl: e.target.value })}
                                                        className="w-full px-3 py-2 bg-white border border-yellow-100 rounded-lg text-sm font-bold text-red-600"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>

                                            <p className="text-[10px] text-yellow-700 font-bold italic">
                                                ⚠️ Warning: These values set the initial ledger state and cannot be changed later without Admin approval.
                                            </p>
                                        </div>
                                        <div className="flex gap-3 pt-4">
                                            <button
                                                type="button"
                                                onClick={() => setShowAddModal(false)}
                                                className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                className="flex-1 px-4 py-3 bg-safaricom-green text-white rounded-xl font-bold hover:bg-green-700 transition-colors shadow-md"
                                            >
                                                Register Member
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Edit Member Modal */}
                {
                    showEditModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                                        <FaPenToSquare className="text-blue-600" /> Edit Member Profile
                                    </h3>
                                    <button
                                        onClick={() => setShowEditModal(false)}
                                        className="text-gray-400 hover:text-red-500 text-xl"
                                    >
                                        ×
                                    </button>
                                </div>
                                <form onSubmit={handleEditMember} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Full Name</label>
                                        <input
                                            type="text"
                                            value={editFormData.name}
                                            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value.replace(/\b\w/g, c => c.toUpperCase()) })}
                                            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-blue-500 font-bold"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Phone Number</label>
                                        <input
                                            type="tel"
                                            value={editFormData.phone}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/[Oo]/g, '0').replace(/[^0-9]/g, '');
                                                setEditFormData({ ...editFormData, phone: val });
                                            }}
                                            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-blue-500 font-bold"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Group</label>
                                        <select
                                            value={editFormData.groupId}
                                            onChange={(e) => setEditFormData({ ...editFormData, groupId: e.target.value })}
                                            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-blue-500 font-bold"
                                            required
                                        >
                                            {groups.map(group => (
                                                <option key={group.id} value={group.id}>{group.group_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Status</label>
                                        <select
                                            value={editFormData.status}
                                            onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                                            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-blue-500 font-bold"
                                        >
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                            <option value="suspended">Suspended</option>
                                        </select>
                                    </div>

                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
                                        <div className="flex items-center gap-2 text-blue-800">
                                            <FaUser className="text-sm" />
                                            <h4 className="text-xs font-black uppercase tracking-wide">Next of Kin Details</h4>
                                        </div>
                                        <div className="grid grid-cols-1 gap-3">
                                            <input
                                                type="text"
                                                value={editFormData.nextOfKinName}
                                                onChange={(e) => setEditFormData({ ...editFormData, nextOfKinName: e.target.value.replace(/\b\w/g, c => c.toUpperCase()) })}
                                                className="w-full px-4 py-2 bg-white border border-blue-100 rounded-lg text-sm font-bold"
                                                placeholder="NoK Full Name"
                                            />
                                            <div className="grid grid-cols-2 gap-2">
                                                <input
                                                    type="tel"
                                                    value={editFormData.nextOfKinPhone}
                                                    onChange={(e) => setEditFormData({ ...editFormData, nextOfKinPhone: e.target.value })}
                                                    className="w-full px-4 py-2 bg-white border border-blue-100 rounded-lg text-sm font-bold"
                                                    placeholder="NoK Phone"
                                                />
                                                <input
                                                    type="text"
                                                    value={editFormData.nextOfKinRelationship}
                                                    onChange={(e) => setEditFormData({ ...editFormData, nextOfKinRelationship: e.target.value })}
                                                    className="w-full px-4 py-2 bg-white border border-blue-100 rounded-lg text-sm font-bold"
                                                    placeholder="Relationship"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowEditModal(false)}
                                            className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-md"
                                        >
                                            Save Changes
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )
                }

                {/* REAL: Profile Drill-Down Modal */}
                {
                    showProfileModal && profileData && (
                        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
                            <div className="bg-gray-50 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                                {/* Modal Header */}
                                <div className="bg-white border-b border-gray-200">
                                    <div className="p-6 flex justify-between items-start">
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-full bg-safaricom-green/10 text-safaricom-green flex items-center justify-center text-2xl font-black border-2 border-white shadow-sm">
                                                {profileData.member.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-black text-gray-800">{profileData.member.name}</h2>
                                                <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-gray-500 mt-1">
                                                    <span className="flex items-center gap-1"><FaUser className="text-gray-400" /> {profileData.member.groupName || 'Default Group'}</span>
                                                    <span className="hidden md:inline w-1 h-1 rounded-full bg-gray-300"></span>
                                                    <span>{profileData.member.phone}</span>
                                                    <span className="hidden md:inline w-1 h-1 rounded-full bg-gray-300"></span>
                                                    {getStatusBadge(profileData.member.netPosition || (profileData.member.savings - profileData.member.activeLoans))}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowProfileModal(false)}
                                            className="w-10 h-10 rounded-full bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-all"
                                        >
                                            <span className="text-2xl leading-none">&times;</span>
                                        </button>
                                    </div>

                                    {/* Tabs */}
                                    <div className="flex px-6 gap-6 overflow-x-auto custom-scrollbar">
                                        {['overview', 'savings', 'loans', 'risk'].map(tab => (
                                            <button
                                                key={tab}
                                                onClick={() => setActiveTab(tab)}
                                                className={`pb-4 px-2 text-sm font-black uppercase tracking-wider border-b-4 transition-colors whitespace-nowrap ${activeTab === tab
                                                    ? 'border-safaricom-green text-safaricom-green'
                                                    : 'border-transparent text-gray-400 hover:text-gray-600'
                                                    }`}
                                            >
                                                {tab.replace('-', ' ')}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Modal Content */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-gray-50/50">
                                    {profileLoading ? (
                                        <div className="flex flex-col items-center justify-center h-64">
                                            <FaSpinner className="animate-spin text-4xl text-safaricom-green mb-4" />
                                            <p className="font-bold text-gray-400">Loading Financial Profile...</p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* OVERVIEW TAB */}
                                            {activeTab === 'overview' && (
                                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                                    {/* Key Metrics */}
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                                                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Savings</div>
                                                            <div className="text-3xl font-black text-gray-800">KES {(profileData.member.savings || 0).toLocaleString()}</div>
                                                        </div>
                                                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                                                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Active Loans</div>
                                                            <div className="text-3xl font-black text-gray-800">KES {(profileData.member.activeLoans || 0).toLocaleString()}</div>
                                                        </div>
                                                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                                                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Net Position</div>
                                                            <div className={`text-3xl font-black ${(profileData.member.netPosition || 0) >= 0 ? 'text-safaricom-green' : 'text-red-500'}`}>
                                                                KES {(profileData.member.netPosition || 0).toLocaleString()}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                        {/* Personal Info */}
                                                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><FaUser /> Personal Details</h3>
                                                            <div className="space-y-3 text-sm">
                                                                <div className="flex justify-between border-b border-gray-50 pb-2">
                                                                    <span className="text-gray-500">Phone</span>
                                                                    <span className="font-bold text-gray-800">{profileData.member.phone}</span>
                                                                </div>
                                                                <div className="flex justify-between border-b border-gray-50 pb-2">
                                                                    <span className="text-gray-500">National ID</span>
                                                                    <span className="font-bold text-gray-800">{profileData.member.national_id || 'N/A'}</span>
                                                                </div>
                                                                <div className="flex justify-between border-b border-gray-50 pb-2">
                                                                    <span className="text-gray-500">Next of Kin</span>
                                                                    <span className="font-bold text-gray-800">{profileData.member.next_of_kin_name || 'N/A'}</span>
                                                                </div>
                                                                {profileData.member.next_of_kin_phone && (
                                                                    <div className="flex justify-between border-b border-gray-50 pb-2">
                                                                        <span className="text-gray-500">NoK Phone</span>
                                                                        <span className="font-bold text-gray-800">{profileData.member.next_of_kin_phone}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Actions & Export */}
                                                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
                                                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 font-black"><FaCircleCheck className="text-emerald-500" /> Actions & Reports</h3>

                                                            <div className="grid grid-cols-2 gap-3 mb-6">
                                                                <button onClick={() => { setShowProfileModal(false); openTransactionPanel(profileData.member); }} className="p-3 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"><FaCoins /> Deposit</button>
                                                                <button onClick={() => { setShowProfileModal(false); openTransactionPanel(profileData.member); }} className="p-3 bg-purple-50 text-purple-700 rounded-xl font-bold text-xs hover:bg-purple-100 transition-colors flex items-center justify-center gap-2"><FaMoneyBillWave /> Repay</button>
                                                            </div>

                                                            {/* Institutional Statement Section */}
                                                            <div className="mt-auto pt-6 border-t border-gray-50">
                                                                <div className="flex items-center gap-2 mb-4">
                                                                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                                                        <FaCalendarDays />
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="text-sm font-black text-gray-800">Account Statement</h4>
                                                                        <p className="text-[10px] font-bold text-gray-400 uppercase">Select Date Range</p>
                                                                    </div>
                                                                </div>

                                                                <div className="grid grid-cols-2 gap-3 mb-4">
                                                                    <div>
                                                                        <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block">Start Date</label>
                                                                        <input
                                                                            type="date"
                                                                            value={statementStartDate}
                                                                            onChange={(e) => setStatementStartDate(e.target.value)}
                                                                            className="w-full text-xs font-bold p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block">End Date</label>
                                                                        <input
                                                                            type="date"
                                                                            value={statementEndDate}
                                                                            onChange={(e) => setStatementEndDate(e.target.value)}
                                                                            className="w-full text-xs font-bold p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => api.downloadMemberStatement(profileData.member.id, statementStartDate, statementEndDate)}
                                                                        className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-sm"
                                                                    >
                                                                        <FaFilePdf /> Official PDF
                                                                    </button>
                                                                    <button
                                                                        onClick={() => api.downloadMemberExcel(profileData.member.id, statementStartDate, statementEndDate)}
                                                                        className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-sm"
                                                                    >
                                                                        <FaFileExcel /> Analysis Excel
                                                                    </button>
                                                                </div>
                                                                <p className="text-[9px] text-center text-gray-400 mt-3 font-bold uppercase tracking-widest">Single Source of Truth Certified</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* SAVINGS TAB */}
                                            {activeTab === 'savings' && (
                                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                                                    <table className="w-full text-left">
                                                        <thead className="bg-gray-50 border-b border-gray-100">
                                                            <tr>
                                                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase">Date</th>
                                                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase">Reference</th>
                                                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase text-right">Credit</th>
                                                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase text-right">Debit</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50">
                                                            {profileData.transactions.filter(t => t.type === 'Savings' || t.type === 'Withdrawal').length > 0 ? (
                                                                profileData.transactions.filter(t => t.type === 'Savings' || t.type === 'Withdrawal').map(t => (
                                                                    <tr key={t.id} className="hover:bg-gray-50/50 group">
                                                                        <td className="px-6 py-4 text-sm font-bold text-gray-500">{new Date(t.date).toLocaleDateString()}</td>
                                                                        <td className="px-6 py-4 text-sm font-bold text-gray-800">
                                                                            <div className="flex items-center gap-2">
                                                                                {t.type} {t.meeting_id ? `#${t.meeting_id}` : ''}
                                                                                <button
                                                                                    onClick={() => api.downloadReceiptPDF(t.id)}
                                                                                    title="Download Digital Receipt"
                                                                                    className="opacity-0 group-hover:opacity-100 p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-all"
                                                                                >
                                                                                    <FaFilePdf size={10} />
                                                                                </button>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-6 py-4 text-sm font-bold text-emerald-600 text-right">{t.amount > 0 ? `+${t.amount.toLocaleString()}` : '-'}</td>
                                                                        <td className="px-6 py-4 text-sm font-bold text-red-500 text-right">{t.amount < 0 ? `${Math.abs(t.amount).toLocaleString()}` : '-'}</td>
                                                                    </tr>
                                                                ))
                                                            ) : (
                                                                <tr>
                                                                    <td colSpan="4" className="px-6 py-8 text-center text-gray-400 font-bold">No savings history found</td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}

                                            {/* LOANS TAB */}
                                            {activeTab === 'loans' && (
                                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                                    {profileData.loans.length > 0 ? (
                                                        profileData.loans.map(loan => (
                                                            <div key={loan.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                                                                <div className="flex items-center justify-between gap-4 mb-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide ${loan.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{loan.status}</span>
                                                                        <span className="text-sm font-bold text-gray-800">{loan.loan_type} Loan #{loan.id}</span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => api.downloadLoanStatementPDF(loan.id)}
                                                                        className="p-2 bg-gray-50 text-gray-500 hover:text-blue-600 rounded-xl transition-all border border-gray-100 hover:border-blue-100 flex items-center gap-2 text-[10px] font-black uppercase"
                                                                    >
                                                                        <FaFilePdf /> Statement
                                                                    </button>
                                                                </div>
                                                                <p className="text-xs text-gray-400 font-bold">Issued: {new Date(loan.date_issued).toLocaleDateString()}</p>
                                                                <div className="flex gap-8 text-right">
                                                                    <div>
                                                                        <div className="text-[10px] font-black text-gray-400 uppercase">Principal</div>
                                                                        <div className="font-bold text-gray-800">KES {loan.principal_amount.toLocaleString()}</div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-[10px] font-black text-gray-400 uppercase">Balance</div>
                                                                        <div className="font-bold text-blue-600">KES {((loan.principal_amount * (1 + loan.interest_rate / 100)) - (loan.paid_amount || 0)).toLocaleString()}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                                                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-300 text-2xl"><FaHandHoldingDollar /></div>
                                                            <p className="text-gray-400 font-bold">No loan history</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* RISK TAB */}
                                            {activeTab === 'risk' && (
                                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                                    <div className="flex items-center gap-4 mb-8">
                                                        <div className="w-24 h-24 rounded-full border-8 border-gray-100 flex items-center justify-center relative">
                                                            <span className={`text-3xl font-black ${profileData.risk?.score > 60 ? 'text-red-500' : profileData.risk?.score > 30 ? 'text-amber-500' : 'text-green-500'}`}>
                                                                {profileData.risk?.score || 0}
                                                            </span>
                                                            <div className="absolute -bottom-2 text-[10px] font-bold text-gray-400 uppercase">Score</div>
                                                        </div>
                                                        <div>
                                                            <h3 className="text-xl font-black text-gray-800">Advanced Risk Report</h3>
                                                            <p className="text-sm text-gray-500">Longitudinal analysis of behavioral and financial markers.</p>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <div className="space-y-4">
                                                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <span className="text-xs font-bold text-gray-500 uppercase">Leverage Ratio</span>
                                                                    <span className={`font-black ${(profileData.risk?.ratio || 0) > 3 ? 'text-red-500' : 'text-green-600'}`}>
                                                                        {(profileData.risk?.ratio || 0).toFixed(1)}x Savings
                                                                    </span>
                                                                </div>
                                                                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                                                    <div className={`h-full ${profileData.risk?.ratio > 3 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, (profileData.risk?.ratio || 0) * 25)}%` }}></div>
                                                                </div>
                                                            </div>

                                                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                                                <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase">
                                                                    <span>Recent Penalties</span>
                                                                    <span className={profileData.risk?.penalties > 0 ? 'text-amber-600' : 'text-green-600'}>
                                                                        {profileData.risk?.penalties || 0} (6 Months)
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="bg-slate-900 rounded-2xl p-6 text-white space-y-4">
                                                            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Behavioral Intelligence</h4>
                                                            {profileData.risk?.alerts?.length > 0 ? (
                                                                <div className="space-y-3">
                                                                    {profileData.risk.alerts.map((alert, i) => (
                                                                        <div key={i} className="flex gap-3">
                                                                            <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${alert.severity === 'HIGH' ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`}></div>
                                                                            <div>
                                                                                <p className="text-xs font-bold">{alert.type.replace('_', ' ')}</p>
                                                                                <p className="text-[10px] text-slate-400">{alert.msg}</p>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col items-center justify-center py-6 opacity-40">
                                                                    <FaCircleCheck className="text-3xl mb-2 text-green-400" />
                                                                    <p className="text-[10px] font-black tracking-widest">CLEAR RECORD</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Withdrawal Modal */}
            </div >
            {/* Smart Transaction Panel (Side Drawer) */}
            <SmartTransactionPanel
                isOpen={showTransactionPanel}
                onClose={() => setShowTransactionPanel(false)}
                member={selectedMember}
                onRefresh={fetchData}
            />
        </>
    );
};

export default Members;
