import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    FaUserPlus, FaMagnifyingGlass, FaClockRotateLeft, FaUser, FaCircleInfo,
    FaFileInvoice, FaMoneyBillWave, FaClock, FaSpinner,
    FaChartLine, FaTriangleExclamation, FaCircleCheck,
    FaPenToSquare, FaHandHoldingDollar, FaCoins, FaLockOpen, FaArrowUp, FaLock,
    FaTrash
} from 'react-icons/fa6';
import { toast } from 'react-toastify';
import { api } from '../services/api';
import { useTransactions } from '../context/TransactionContext';
import { useAuth } from '../context/AuthContext';
import LoanIssuanceModal from '../components/LoanIssuanceModal';

const RELATIONSHIP_OPTIONS = [
    'Spouse', 'Parent', 'Child', 'Sibling', 'Grandparent', 'Grandchild', 'Cousin', 'Business Partner', 'Other'
];

const Members = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { activeSession } = useTransactions();
    const [searchTerm, setSearchTerm] = useState('');
    const [showEditModal, setShowEditModal] = useState(false);
    const [editFormData, setEditFormData] = useState({
        id: '', name: '', phone: '', groupId: '', status: 'active',
        nextOfKinName: '', nextOfKinPhone: '', nextOfKinRelationship: ''
    });
    // ... existing ...

    const [searchSuggestions, setSearchSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState('');
    const [members, setMembers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false); // Register
    const [showDepositModal, setShowDepositModal] = useState(false); // Deposit
    const [showRepaymentModal, setShowRepaymentModal] = useState(false); // Repayment
    const [showLoanModal, setShowLoanModal] = useState(false); // New Loan Modal
    const [selectedMember, setSelectedMember] = useState(null);
    const [depositAmount, setDepositAmount] = useState('');
    const [repaymentAmount, setRepaymentAmount] = useState('');
    const [showLedgerModal, setShowLedgerModal] = useState(false); // NEW Ledger Modal State

    // NEW: Loan Repayment State
    const [memberLoans, setMemberLoans] = useState([]);
    const [selectedLoan, setSelectedLoan] = useState(null);
    const [allocation, setAllocation] = useState({ penalty: 0, interest: 0, principal: 0 });

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
        nextOfKinMemberId: ''
    });
    const [phoneError, setPhoneError] = useState('');
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

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

            if (membersData) setMembers(membersData);
            if (groupsData) setGroups(groupsData);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load members data");
        } finally {
            setLoading(false);
        }
    };

    // Calculate Net Position for each member
    const membersWithNetPosition = useMemo(() => {
        return members.map(member => ({
            ...member,
            full_name: member.name, // Compatibility with existing code
            savings: member.current_savings || 0,
            activeLoans: member.active_loan_balance || 0,
            netPosition: (member.current_savings || 0) - (member.active_loan_balance || 0)
        }));
    }, [members]);

    // Filter members
    const filteredMembers = useMemo(() => {
        return membersWithNetPosition.filter(member => {
            const matchesSearch =
                member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                member.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                member.group_role?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesGroup = selectedGroup ? member.group_id?.toString() === selectedGroup : true;
            return matchesSearch && matchesGroup;
        });
    }, [membersWithNetPosition, searchTerm, selectedGroup]);

    // Auto-suggest logic
    useEffect(() => {
        if (searchTerm.length > 1) {
            const matches = membersWithNetPosition
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
    }, [searchTerm, membersWithNetPosition]);

    const handleSelectSuggestion = (member) => {
        setSearchTerm(member.full_name);
        setShowSuggestions(false);
    };

    // Group Statistics
    const groupStats = useMemo(() => {
        if (!selectedGroup) return null;

        const groupMembers = filteredMembers;
        return {
            totalMembers: groupMembers.length,
            totalSavings: groupMembers.reduce((sum, m) => sum + m.savings, 0),
            totalLoans: groupMembers.reduce((sum, m) => sum + m.activeLoans, 0),
            netPosition: groupMembers.reduce((sum, m) => sum + m.netPosition, 0)
        };
    }, [filteredMembers, selectedGroup]);

    const validatePhone = (phone) => {
        // Kenyan phone regex: Starts with 07 or 01, followed by 8 digits
        const phoneRegex = /^0(7|1)\d{8}$/;
        return phoneRegex.test(phone);
    };

    const handlePhoneChange = (e) => {
        const phone = e.target.value;
        setNewMember({ ...newMember, phone });

        if (phone && !validatePhone(phone)) {
            setPhoneError('Invalid phone number. Must be 10 digits starting with 07 or 01.');
        } else {
            setPhoneError('');
        }
    };

    const handleAddMember = async (e) => {
        // ... existing implementation ...
        e.preventDefault();

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
                next_of_kin_member_id: newMember.nextOfKinMemberId ? parseInt(newMember.nextOfKinMemberId) : null
            };

            await api.createMember(payload);
            toast.success(`✅ ${newMember.name} added successfully!`);
            setShowAddModal(false);
            setNewMember({
                name: '', phone: '', groupId: '', opening_balance_savings: 0,
                opening_balance_reason: '', opening_balance_ltl: 0, opening_balance_stl: 0,
                nextOfKinName: '', nextOfKinPhone: '', nextOfKinRelationship: '', nextOfKinMemberId: ''
            });
            fetchData(); // Refresh list
        } catch (error) {
            console.error(error);
            toast.error("Failed to add member");
        }
    };

    const handleDeleteMember = async (id, name) => {
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
            nextOfKinRelationship: member.next_of_kin_relationship || ''
        });
        setShowEditModal(true);
    };

    const handleEditMember = async (e) => {
        e.preventDefault();
        try {
            await api.updateMember(editFormData.id, {
                name: editFormData.name,
                phone: editFormData.phone,
                groupId: editFormData.groupId,
                status: editFormData.status,
                next_of_kin_name: editFormData.nextOfKinName,
                next_of_kin_phone: editFormData.nextOfKinPhone,
                next_of_kin_relationship: editFormData.nextOfKinRelationship
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



    const openRepaymentModal = async (member) => {
        setSelectedMember(member);
        setRepaymentAmount('');
        setMemberLoans([]);
        setSelectedLoan(null);
        setAllocation({ penalty: 0, interest: 0, principal: 0 });
        setShowRepaymentModal(true);

        // Fetch active loans
        try {
            const loans = await api.getLoans(member.id);
            const active = loans.filter(l => l.status === 'active' || l.status === 'Active');
            setMemberLoans(active);

            // Auto-select if only one
            if (active.length === 1) {
                handleSelectLoan(active[0]);
            }
        } catch (error) {
            console.error("Failed to fetch loans", error);
            toast.error("Could not load member loans.");
        }
    };

    const handleSelectLoan = (loan) => {
        setSelectedLoan(loan);
        // Calculate snapshot (mock logic if specific outstanding fields missing in backend)
        // Ideally backend returns: outstanding_principal, outstanding_interest, outstanding_penalty
        // Here we assume standard tracking or calculate roughly:
        // For UI Demo: 
        // Penalties = 0 (unless backend says otherwise)
        // Interest Due = (Principal * Rate/100) - PaidInterest (Assume 0 paid for now if not tracked)
        // This is a simplification. In production, 'loan' object must have these.
    };

    const handleAmountChange = (val) => {
        setRepaymentAmount(val);
        if (!selectedLoan) return;

        const amount = parseFloat(val) || 0;

        // Allocation Logic: Penalty -> Interest -> Principal
        // Mock Outstanding Values (Replace with Real from DB)
        const outstandingPenalty = selectedLoan.outstanding_penalty || 0;
        const outstandingInterest = selectedLoan.outstanding_interest || (selectedLoan.principal_amount * (selectedLoan.interest_rate / 100)); // Rough estimate
        const outstandingPrincipal = selectedLoan.principal_amount; // Assuming full principal is due

        let remaining = amount;

        const allocPenalty = Math.min(remaining, outstandingPenalty);
        remaining -= allocPenalty;

        const allocInterest = Math.min(remaining, outstandingInterest);
        remaining -= allocInterest;

        const allocPrincipal = remaining; // Rest goes to principal (even if overpayment, system handles as prepay)

        setAllocation({
            penalty: allocPenalty,
            interest: allocInterest,
            principal: allocPrincipal
        });
    };

    const handleRepayment = async (e) => {
        e.preventDefault();

        if (!selectedLoan) {
            toast.error("Please select a specific loan to repay.");
            return;
        }

        try {
            await api.postRepayment({
                memberId: selectedMember.id,
                sessionId: activeSession?.id || null,
                amount: parseFloat(repaymentAmount),
                paymentMethod: 'Cash', // Default for now
                meetingReference: activeSession?.id ? `Session #${activeSession.id}` : null,
                loanId: selectedLoan.id,
                loanType: selectedLoan.loan_type,
                breakdown: allocation,
                newBalance: (selectedLoan.principal_amount + (selectedLoan.principal_amount * (selectedLoan.interest_rate / 100))) - parseFloat(repaymentAmount) // Rough visual update
            });
            toast.success(`✅ Repayment of KES ${repaymentAmount} posted successfully!`);
            setShowRepaymentModal(false);
            setRepaymentAmount('');
            fetchData(); // Refresh main list
        } catch (error) {
            console.error(error);
            toast.error("Failed to post repayment");
        }
    };

    const openDepositModal = (member) => {
        setSelectedMember(member);
        setDepositAmount('');
        setShowDepositModal(true);
    };

    const handleDeposit = async (e) => {
        e.preventDefault();
        try {
            await api.postContribution({
                memberId: selectedMember.id,
                sessionId: activeSession?.id || null,
                type: 'Savings',
                amount: parseFloat(depositAmount),
                paymentMethod: 'Cash',
                meetingReference: activeSession?.id ? `Session #${activeSession.id}` : null,
                officerId: 1,
                affectsSavings: true,
                affectsLoanEligibility: true,
                affectsCash: true
            });
            toast.success(`Savings of KES ${depositAmount} recorded!`);
            setShowDepositModal(false);
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error("Failed to deposit.");
        }
    };

    const handleWithdrawal = async (e) => {
        e.preventDefault();
        if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) return;

        setIsProcessing(true);
        try {
            await api.postWithdrawal({
                memberId: selectedMember.id,
                sessionId: activeSession?.id || null,
                amount: parseFloat(withdrawAmount),
                description: `Manual Withdrawal ${activeSession?.id ? `(Session #${activeSession.id})` : ''}`
            });
            toast.success(`✅ Withdrawal of KES ${withdrawAmount} completed!`);
            setShowWithdrawModal(false);
            setWithdrawAmount('');
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error("Withdrawal failed. Check balance.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                        <FaUser className="text-safaricom-green" /> Members Directory
                    </h2>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                        {filteredMembers.length} Active Members
                    </p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 bg-safaricom-green text-white px-5 py-2 rounded-xl font-bold hover:bg-green-700 transition-colors shadow-md"
                >
                    <FaUserPlus /> Register New Member
                </button>
            </div>

            {/* Group Statistics Panel */}
            {groupStats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gradient-to-r from-safaricom-green to-green-700 p-6 rounded-2xl text-white">
                    <div className="text-center">
                        <div className="text-xs font-bold uppercase opacity-80">Total Members</div>
                        <div className="text-3xl font-black">{groupStats.totalMembers}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs font-bold uppercase opacity-80">Total Savings</div>
                        <div className="text-3xl font-black">KES {groupStats.totalSavings.toLocaleString()}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs font-bold uppercase opacity-80">Active Loans</div>
                        <div className="text-3xl font-black">KES {groupStats.totalLoans.toLocaleString()}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs font-bold uppercase opacity-80">Net Position</div>
                        <div className={`text-3xl font-black ${groupStats.netPosition >= 0 ? 'text-white' : 'text-red-200'}`}>
                            KES {groupStats.netPosition.toLocaleString()}
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-1 w-full relative">
                    <FaMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name or phone..."
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-safaricom-green/50 font-bold text-gray-600"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} // Delay to allow click
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

            {/* Premium Members List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-extrabold font-sans">
                                <th className="px-6 py-4">Member Profile</th>
                                <th className="px-6 py-4">Group Affiliation</th>
                                <th className="px-6 py-4 text-right">Savings (KES)</th>
                                <th className="px-6 py-4 text-right">Loan Balance</th>
                                <th className="px-6 py-4 text-right">Net Position</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-center">Quick Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <FaSpinner className="animate-spin text-3xl text-safaricom-green" />
                                            <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Loading Directory...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredMembers.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center gap-4">
                                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-300 text-2xl">
                                                <FaUser />
                                            </div>
                                            <div className="text-center">
                                                <h3 className="text-lg font-black text-gray-700">No Members Found</h3>
                                                <p className="text-sm text-gray-400 font-bold max-w-xs mx-auto mt-1">
                                                    Try adjusting your search filters or register a new member to get started.
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => setShowAddModal(true)}
                                                className="mt-2 px-6 py-2 bg-safaricom-green text-white rounded-xl font-bold hover:bg-green-700 transition-colors"
                                            >
                                                Register Member
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredMembers.map((member) => {
                                    const initials = member.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                                    const netPos = (member.savings || 0) - (member.activeLoans || 0);

                                    return (
                                        <tr key={member.id} className="group hover:bg-gray-50/80 transition-all duration-200">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-xs font-black text-gray-600 border-2 border-white shadow-sm group-hover:scale-110 transition-transform">
                                                        {initials}
                                                    </div>
                                                    <div>
                                                        <div className="font-black text-gray-800 text-sm group-hover:text-safaricom-green transition-colors flex items-center gap-2">
                                                            {member.name}
                                                            {member.group_role && member.group_role !== 'Member' && (
                                                                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider ${member.group_role === 'Chairman' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                                                                    member.group_role === 'Secretary' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                                                        'bg-orange-100 text-orange-700 border border-orange-200'
                                                                    }`}>
                                                                    {member.group_role}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                                            {member.phone}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {member.groupName ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                                        {member.groupName}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-bold text-gray-400 italic">Unassigned</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="font-mono font-bold text-gray-700">
                                                    {(member.savings || 0).toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className={`font-mono font-bold ${(member.activeLoans || 0) > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                                                    {(member.activeLoans || 0).toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className={`font-mono font-black ${netPos >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                    {netPos >= 0 ? '+' : ''}{netPos.toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {getStatusBadge(netPos)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => openDepositModal(member)}
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-colors"
                                                        title="Quick Deposit"
                                                    >
                                                        <FaCoins />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if ((member.activeLoans || 0) > 0) {
                                                                openRepaymentModal(member);
                                                            }
                                                        }}
                                                        disabled={(member.activeLoans || 0) <= 0}
                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${(member.activeLoans || 0) > 0
                                                            ? 'text-purple-600 hover:bg-purple-50 cursor-pointer'
                                                            : 'text-gray-300 cursor-not-allowed opacity-50'
                                                            }`}
                                                        title={(member.activeLoans || 0) > 0 ? "Quick Loaning / Repayment" : "No Active Loans to Repay"}
                                                    >
                                                        <FaHandHoldingDollar />
                                                    </button>
                                                    <button
                                                        onClick={() => { setSelectedMember(member); setShowLoanModal(true); }}
                                                        disabled={!activeSession}
                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${activeSession
                                                            ? 'text-safaricom-green hover:bg-green-50 cursor-pointer'
                                                            : 'text-gray-300 cursor-not-allowed opacity-50'
                                                            }`}
                                                        title={activeSession ? "Issue New Loan" : "No Active Meeting - Open one to issue loans"}
                                                    >
                                                        <FaMoneyBillWave />
                                                    </button>
                                                    <div className="w-px h-4 bg-gray-300 mx-1"></div>
                                                    <button
                                                        onClick={() => navigate(`/members/${member.id}`)}
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors"
                                                        title="View History"
                                                    >
                                                        <FaClockRotateLeft />
                                                    </button>
                                                    <button
                                                        onClick={() => openEditModal(member)}
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
                                                        title="Edit Details"
                                                    >
                                                        <FaPenToSquare />
                                                    </button>

                                                    {user?.role === 'admin' && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteMember(member.id, member.name);
                                                            }}
                                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
                                                            title="Delete Member"
                                                        >
                                                            <FaTrash size={12} />
                                                        </button>
                                                    )}
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
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                                <FaUserPlus className="text-safaricom-green" /> Register New Member
                            </h3>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="text-gray-400 hover:text-red-500 text-xl"
                            >
                                ×
                            </button>
                        </div>
                        <form onSubmit={handleAddMember} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Full Name *</label>
                                <input
                                    type="text"
                                    value={newMember.name}
                                    onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-safaricom-green/50 font-bold"
                                    placeholder="John Doe"
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
                                                onChange={(e) => setNewMember({ ...newMember, nextOfKinName: e.target.value })}
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
                                            onChange={(e) => setNewMember({ ...newMember, opening_balance_reason: e.target.value })}
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
                        </form >
                    </div >
                </div >
            )}

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
                                        onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-blue-500 font-bold"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Phone Number</label>
                                    <input
                                        type="tel"
                                        value={editFormData.phone}
                                        onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
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
                                            onChange={(e) => setEditFormData({ ...editFormData, nextOfKinName: e.target.value })}
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

            {
                showDepositModal && selectedMember && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                                    <FaCoins className="text-emerald-600" /> Quick Deposit
                                </h3>
                                <button onClick={() => setShowDepositModal(false)} className="text-gray-400 hover:text-red-500 text-xl">×</button>
                            </div>
                            <div className="mb-4">
                                <p className="text-sm text-gray-500 font-bold uppercase">Member</p>
                                <p className="text-lg font-black text-gray-800">{selectedMember.name}</p>
                            </div>
                            <form onSubmit={handleDeposit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Amount (KES)</label>
                                    <input
                                        type="number"
                                        value={depositAmount}
                                        onChange={(e) => setDepositAmount(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-emerald-500 font-bold text-2xl"
                                        placeholder="0.00"
                                        autoFocus
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl transition-all transform hover:scale-[1.02]"
                                >
                                    Confirm Deposit
                                </button>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Repayment Modal */}
            {
                showRepaymentModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl transform scale-100 transition-all flex flex-col max-h-[90vh]">

                            {/* Header */}
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                                <div>
                                    <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                                        <FaMoneyBillWave className="text-purple-600" /> Repay Loan
                                    </h3>
                                    <p className="text-xs text-purple-600 font-bold uppercase tracking-wider mt-1">{selectedMember?.name}</p>
                                </div>
                                <button onClick={() => setShowRepaymentModal(false)} className="bg-white p-2 rounded-full shadow-sm hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">×</button>
                            </div>

                            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">

                                {/* Step 1: Select Loan */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px]">1</div>
                                        Select Active Loan
                                    </label>

                                    {memberLoans.length === 0 ? (
                                        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-center">
                                            <p className="text-red-600 font-bold mb-1">No Active Loans Found</p>
                                            <p className="text-xs text-red-500">This member has no active loans to repay.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {memberLoans.map(loan => (
                                                <div
                                                    key={loan.id}
                                                    onClick={() => handleSelectLoan(loan)}
                                                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${selectedLoan?.id === loan.id
                                                        ? 'border-purple-600 bg-purple-50 shadow-md ring-1 ring-purple-600'
                                                        : 'border-gray-100 hover:border-purple-200 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide ${loan.loan_type === 'STL' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                                            }`}>
                                                            {loan.loan_type} Loan
                                                        </span>
                                                        <span className="text-xs font-bold text-gray-400">#{loan.id}</span>
                                                    </div>
                                                    <div className="flex justify-between items-end">
                                                        <div>
                                                            <p className="text-xs text-gray-500 mb-0.5">Principal</p>
                                                            <p className="font-bold text-gray-800">KES {loan.principal_amount?.toLocaleString()}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-xs text-gray-500 mb-0.5">Balance Check</p>
                                                            <p className="font-bold text-gray-800">
                                                                {/* Estimate Balance if not in loan object */}
                                                                KES {((loan.principal_amount * (1 + (loan.interest_rate / 100)))).toLocaleString()}
                                                                <span className="text-[10px] text-gray-400 font-normal"> (Est. Total)</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Step 2: Loan Snapshot (Read Only) */}
                                {selectedLoan && (
                                    <div className="animate-in slide-in-from-top-4 duration-300">
                                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="font-bold text-gray-700 flex items-center gap-2 text-sm">
                                                    <FaCircleInfo className="text-blue-500" /> Loan Snapshot
                                                </h4>
                                                <span className="text-xs font-mono bg-white px-2 py-1 rounded border border-gray-200">
                                                    Rate: {selectedLoan.interest_rate}%
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 text-xs">
                                                <div className="space-y-1">
                                                    <p className="text-gray-500">Interest Due</p>
                                                    <p className="font-bold text-gray-800">KES {selectedLoan.outstanding_interest?.toLocaleString() || (selectedLoan.principal_amount * (selectedLoan.interest_rate / 100)).toLocaleString()}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-gray-500">Principal Balance</p>
                                                    <p className="font-bold text-gray-800">KES {selectedLoan.principal_amount?.toLocaleString()}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-gray-500">Penalty Due</p>
                                                    {selectedLoan.outstanding_penalty > 0 ? (
                                                        <p className="font-bold text-red-600">KES {selectedLoan.outstanding_penalty.toLocaleString()}</p>
                                                    ) : (
                                                        <p className="font-bold text-green-600">None</p>
                                                    )}
                                                </div>
                                                <div className="space-y-1 pt-1 border-t border-gray-200 mt-1 col-span-2 flex justify-between items-center">
                                                    <p className="text-gray-500 font-bold">TOTAL OUTSTANDING</p>
                                                    <p className="font-black text-blue-700 text-sm">
                                                        KES {(selectedLoan.principal_amount + (selectedLoan.principal_amount * (selectedLoan.interest_rate / 100))).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Step 3: Repayment Input & Allocation */}
                                {selectedLoan && (
                                    <div className="animate-in slide-in-from-top-4 duration-500 space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px]">2</div>
                                                Enter Repayment Amount
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">KES</span>
                                                <input
                                                    type="number"
                                                    value={repaymentAmount}
                                                    onChange={(e) => handleAmountChange(e.target.value)}
                                                    className="w-full pl-14 pr-4 py-4 bg-white border-2 border-purple-100 rounded-xl focus:outline-none focus:border-purple-600 focus:ring-4 focus:ring-purple-500/10 font-bold text-2xl text-gray-800 shadow-sm transition-all placeholder-gray-200"
                                                    placeholder="0.00"
                                                    autoFocus
                                                />
                                            </div>
                                        </div>

                                        {/* Auto Allocation Preview */}
                                        {repaymentAmount > 0 && (
                                            <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                                                <p className="text-[10px] font-bold text-blue-600 uppercase mb-3 flex items-center gap-1">
                                                    <FaCircleCheck /> System Auto-Allocation
                                                </p>
                                                <div className="space-y-2">
                                                    {/* Penalty */}
                                                    <div className={`flex justify-between items-center text-xs p-2 rounded ${allocation.penalty > 0 ? 'bg-orange-100 text-orange-800' : 'text-gray-400'}`}>
                                                        <span>1. Penalty / Arrears</span>
                                                        <span className="font-bold">KES {allocation.penalty.toLocaleString()}</span>
                                                    </div>
                                                    {/* Interest */}
                                                    <div className={`flex justify-between items-center text-xs p-2 rounded ${allocation.interest > 0 ? 'bg-indigo-100 text-indigo-800' : 'text-gray-400'}`}>
                                                        <span>2. Interest</span>
                                                        <span className="font-bold">KES {allocation.interest.toLocaleString()}</span>
                                                    </div>
                                                    {/* Principal */}
                                                    <div className={`flex justify-between items-center text-xs p-2 rounded ${allocation.principal > 0 ? 'bg-green-100 text-green-800' : 'text-gray-400'}`}>
                                                        <span>3. Principal</span>
                                                        <span className="font-bold">KES {allocation.principal.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                            </div>

                            {/* Footer / Actions */}
                            <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                                <button
                                    onClick={handleRepayment}
                                    disabled={!selectedLoan || !repaymentAmount || parseFloat(repaymentAmount) <= 0}
                                    className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all transform ${!selectedLoan || !repaymentAmount || parseFloat(repaymentAmount) <= 0
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg hover:shadow-purple-500/30 hover:scale-[1.02]'
                                        }`}
                                >
                                    <FaCircleCheck /> Confirm Repayment
                                </button>
                                {selectedLoan && repaymentAmount > 0 && (
                                    <p className="text-center text-[10px] text-gray-400 mt-3">
                                        This action will update the loan ledger and group cash balance immediately.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
            {/* NEW: Member Ledger / Profile Modal */}
            {
                showLedgerModal && selectedMember && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
                        <div className="bg-gray-50 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                            {/* Modal Header */}
                            <div className="bg-white p-6 border-b border-gray-100 flex justify-between items-start">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-safaricom-green/10 text-safaricom-green flex items-center justify-center text-2xl font-black border-2 border-white shadow-sm">
                                        {selectedMember.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-800">{selectedMember.name}</h2>
                                        <div className="flex items-center gap-3 text-sm font-bold text-gray-500 mt-1">
                                            <span className="flex items-center gap-1"><FaUser className="text-gray-400" /> {selectedMember.groupName || 'Default Group'}</span>
                                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                            <span>{selectedMember.phone}</span>
                                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                            <span className={`${selectedMember.status === 'active' ? 'text-green-600' : 'text-red-500'} uppercase text-xs tracking-wider`}>{selectedMember.status || 'Active'}</span>
                                        </div>
                                        {selectedMember.next_of_kin_name && (
                                            <div className="mt-2 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg inline-flex items-center gap-2">
                                                <FaUser className="text-[10px]" /> Next of Kin: {selectedMember.next_of_kin_name} ({selectedMember.next_of_kin_relationship}) - {selectedMember.next_of_kin_phone}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowLedgerModal(false)}
                                    className="w-10 h-10 rounded-full bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-all"
                                >
                                    <span className="text-2xl leading-none">&times;</span>
                                </button>
                            </div>

                            {/* Modal Content - Scrollable */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">

                                {/* Financial Snapshot Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:border-green-200 transition-colors group">
                                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <FaCoins className="text-green-200 group-hover:text-green-500 transition-colors" /> Total Savings
                                        </div>
                                        <div className="text-2xl font-black text-gray-800">KES {(selectedMember.savings || 0).toLocaleString()}</div>
                                    </div>
                                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:border-orange-200 transition-colors group">
                                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <FaHandHoldingDollar className="text-orange-200 group-hover:text-orange-500 transition-colors" /> Outstanding Loan
                                        </div>
                                        <div className="text-2xl font-black text-gray-800">KES {(selectedMember.activeLoans || 0).toLocaleString()}</div>
                                    </div>
                                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:border-red-200 transition-colors group">
                                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <FaTriangleExclamation className="text-red-200 group-hover:text-red-500 transition-colors" /> Arrears / Fines
                                        </div>
                                        <div className="text-2xl font-black text-gray-800">KES {(selectedMember.arrears || 0).toLocaleString()}</div>
                                    </div>
                                    <div className="bg-gray-900 p-5 rounded-2xl shadow-lg border border-gray-800 relative overflow-hidden group">
                                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2 z-10 relative">
                                            <FaChartLine className="text-safaricom-green" /> Net Position
                                        </div>
                                        <div className={`text-2xl font-black z-10 relative ${((selectedMember.savings || 0) - (selectedMember.activeLoans || 0)) >= 0 ? 'text-safaricom-green' : 'text-red-400'}`}>
                                            KES {((selectedMember.savings || 0) - (selectedMember.activeLoans || 0)).toLocaleString()}
                                        </div>
                                        {/* Decor */}
                                        <div className="absolute right-0 top-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-white/10 transition-colors"></div>
                                    </div>
                                </div>

                                {/* Ledger / History Section */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    {/* Main Ledger Table */}
                                    <div className="lg:col-span-2">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-bold text-gray-800 text-lg">Detailed Ledger</h3>
                                            <button className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                                                Last 30 Days
                                            </button>
                                        </div>

                                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                            <table className="w-full text-left">
                                                <thead className="bg-gray-50 border-b border-gray-100">
                                                    <tr>
                                                        <th className="px-5 py-3 text-xs font-black text-gray-400 uppercase">Date</th>
                                                        <th className="px-5 py-3 text-xs font-black text-gray-400 uppercase">Description</th>
                                                        <th className="px-5 py-3 text-xs font-black text-gray-400 uppercase text-right">Credit</th>
                                                        <th className="px-5 py-3 text-xs font-black text-gray-400 uppercase text-right">Debit</th>
                                                        <th className="px-5 py-3 text-xs font-black text-gray-400 uppercase text-right">Balance</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {/* Mock Data for Visualization - Would be fetched from API in Prod */}
                                                    <tr>
                                                        <td className="px-5 py-4 text-sm font-bold text-gray-500">22 Jan 2026</td>
                                                        <td className="px-5 py-4 text-sm font-bold text-gray-800">Savings Deposit</td>
                                                        <td className="px-5 py-4 text-sm font-bold text-green-600 text-right">+500</td>
                                                        <td className="px-5 py-4 text-sm font-bold text-gray-300 text-right">-</td>
                                                        <td className="px-5 py-4 text-sm font-bold text-gray-600 text-right">{(selectedMember.savings).toLocaleString()}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="px-5 py-4 text-sm font-bold text-gray-500">15 Jan 2026</td>
                                                        <td className="px-5 py-4 text-sm font-bold text-gray-800">Weekly Contribution</td>
                                                        <td className="px-5 py-4 text-sm font-bold text-green-600 text-right">+200</td>
                                                        <td className="px-5 py-4 text-sm font-bold text-gray-300 text-right">-</td>
                                                        <td className="px-5 py-4 text-sm font-bold text-gray-600 text-right">{(selectedMember.savings - 500).toLocaleString()}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="px-5 py-4 text-sm font-bold text-gray-500">01 Jan 2026</td>
                                                        <td className="px-5 py-4 text-sm font-bold text-gray-800">Opening Balance</td>
                                                        <td className="px-5 py-4 text-sm font-bold text-green-600 text-right">+{(selectedMember.savings - 700).toLocaleString()}</td>
                                                        <td className="px-5 py-4 text-sm font-bold text-gray-300 text-right">-</td>
                                                        <td className="px-5 py-4 text-sm font-bold text-gray-600 text-right">{(selectedMember.savings - 700).toLocaleString()}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                            <div className="p-4 bg-gray-50 text-center border-t border-gray-100">
                                                <p className="text-xs text-gray-400 font-bold uppercase">End of recent history</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Side: Actions & Info */}
                                    <div className="space-y-6">
                                        {/* Actions Card */}
                                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                            <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Quick Actions</h3>
                                            <div className="space-y-3">
                                                <button
                                                    onClick={() => { setShowLedgerModal(false); openDepositModal(selectedMember); }}
                                                    className="w-full py-3 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-sm flex items-center justify-between transition-colors"
                                                >
                                                    <span>Record Deposit</span>
                                                    <FaCoins />
                                                </button>
                                                <button
                                                    onClick={() => { setShowLedgerModal(false); openRepaymentModal(selectedMember); }}
                                                    className="w-full py-3 px-4 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl font-bold text-sm flex items-center justify-between transition-colors"
                                                >
                                                    <span>Repay Loan</span>
                                                    <FaMoneyBillWave />
                                                </button>
                                                <button
                                                    onClick={() => api.downloadMemberStatement(selectedMember.id)}
                                                    className="w-full py-3 px-4 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold text-sm flex items-center justify-between transition-colors"
                                                >
                                                    <span>Download Statement (PDF)</span>
                                                    <FaFileInvoice />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Loan Portfolio Summary */}
                                        <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700 text-white relative overflow-hidden">
                                            <h3 className="font-bold text-gray-200 mb-4 text-sm uppercase tracking-wide flex items-center gap-2">
                                                <FaHandHoldingDollar /> Loan Portfolio
                                            </h3>

                                            {memberLoans.length > 0 ? (
                                                <div className="space-y-4 relative z-10">
                                                    {memberLoans.map(l => (
                                                        <div key={l.id} className="pb-3 border-b border-gray-700 last:border-0 last:pb-0">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-sm font-bold text-white">{l.loan_type} Loan</span>
                                                                <span className="text-xs font-mono text-green-400 bg-green-400/10 px-2 py-0.5 rounded">Active</span>
                                                            </div>
                                                            <div className="flex justify-between items-end text-xs text-gray-400">
                                                                <span>Principal: {l.principal_amount.toLocaleString()}</span>
                                                                <span>Due: {l.due_date}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center py-6 relative z-10">
                                                    <p className="text-gray-500 text-sm">No active loans.</p>
                                                    <p className="text-xs text-gray-600 mt-1">Excellent standing!</p>
                                                </div>
                                            )}

                                            {/* Decor */}
                                            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-safaricom-green/10 rounded-full blur-2xl"></div>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                )
            }

            {/* Withdrawal Modal */}
            {showWithdrawModal && selectedMember && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                                <FaArrowUp className="text-red-500" /> Member Withdrawal
                            </h3>
                            <button onClick={() => setShowWithdrawModal(false)} className="text-gray-400 hover:text-red-500 text-2xl">&times;</button>
                        </div>

                        <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-6">
                            <p className="text-xs font-black text-red-700 uppercase tracking-widest mb-1">Available Savings</p>
                            <p className="text-2xl font-black text-red-800">KES {(selectedMember.savings || 0).toLocaleString()}</p>
                        </div>

                        <form onSubmit={handleWithdrawal} className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Enter Withdrawal Amount</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400">KES</span>
                                    <input
                                        type="number"
                                        value={withdrawAmount}
                                        onChange={(e) => setWithdrawAmount(e.target.value)}
                                        className="w-full pl-14 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-red-500 font-black text-2xl text-gray-800"
                                        placeholder="0.00"
                                        max={selectedMember.savings}
                                        required
                                        autoFocus
                                    />
                                </div>
                                {activeSession && (
                                    <p className="mt-2 text-[10px] font-bold text-blue-600 flex items-center gap-1">
                                        <FaCircleCheck /> Linked to Active Session #{activeSession.id}
                                    </p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isProcessing || !withdrawAmount || parseFloat(withdrawAmount) > selectedMember.savings}
                                className={`w-full py-4 rounded-2xl font-black shadow-lg transition-all ${isProcessing || !withdrawAmount || parseFloat(withdrawAmount) > selectedMember.savings
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-red-600 text-white hover:bg-red-700 active:scale-95'
                                    }`}
                            >
                                {isProcessing ? 'PROCESSING...' : 'CONFIRM WITHDRAWAL'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* NEW: Loan Issuance Modal */}
            {selectedMember && (
                <LoanIssuanceModal
                    isOpen={showLoanModal}
                    onClose={() => setShowLoanModal(false)}
                    member={selectedMember}
                    activeMeeting={activeSession}
                    onSuccess={async (loanData) => {
                        try {
                            await api.issueLoan({
                                memberId: loanData.memberId,
                                groupId: selectedMember.groupId,
                                sessionId: activeSession.id,
                                loanType: loanData.loanType,
                                amount: loanData.amount,
                                interestRate: loanData.interestRate,
                                duration: loanData.duration,
                                officerId: user?.id,
                                guarantor1_id: loanData.guarantor1_id,
                                guarantor2_id: loanData.guarantor2_id,
                                purpose: loanData.purpose
                            });
                            toast.success('Loan issued successfully!');
                            setShowLoanModal(false);
                            fetchData(); // Refresh member balances
                        } catch (error) {
                            toast.error('Failed to issue loan.');
                            console.error("Loan issuance failed", error);
                        }
                    }}
                />
            )}
        </div >
    );
};

export default Members;
