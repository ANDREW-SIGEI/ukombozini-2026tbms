import React, { useState, useEffect, useMemo } from 'react';
import { FaTimes, FaPiggyBank, FaSearch, FaCheckCircle, FaExchangeAlt, FaShieldAlt, FaInfoCircle, FaPhone, FaWallet, FaUsers } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { mockMembers, mockLoans } from '../data/mockData';

const ContributionModal = ({ isOpen, onClose, selectedGroupId, selectedGroupName, member: initialMember, onSuccess }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMember, setSelectedMember] = useState(initialMember || null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [type, setType] = useState('Monthly Saving');
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Physical Cash');
    const [loanDetails, setLoanDetails] = useState(null);

    const contributionTypes = [
        'Monthly Saving',
        'Special Contribution',
        'Welfare',
        'Project',
        'Application Fee',
        'Appreciation Fee'
    ];

    // Filter members by group context
    const membersInGroup = useMemo(() => {
        return mockMembers.filter(m => m.groupId === selectedGroupId);
    }, [selectedGroupId]);

    // Live search for member dropdown
    const filteredMembers = useMemo(() => {
        if (!searchTerm) return membersInGroup;
        return membersInGroup.filter(m =>
            m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.phone.includes(searchTerm)
        );
    }, [searchTerm, membersInGroup]);

    useEffect(() => {
        if (initialMember) setSelectedMember(initialMember);
    }, [initialMember]);

    // Check for active loans if type is repayment (though repayment is handled differently in this simplified set)
    // For this UI, we assume 'Monthly Saving' is the default
    useEffect(() => {
        if (selectedMember) {
            const activeLoan = mockLoans.find(l => l.memberName === selectedMember.name && l.status === 'Active');
            setLoanDetails(activeLoan || null);
        }
    }, [selectedMember]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!selectedMember) {
            toast.error("Please select a member first");
            return;
        }

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            toast.error("Please enter a valid amount greater than zero");
            return;
        }

        const allocation = {
            memberId: selectedMember.id,
            groupId: selectedGroupId,
            memberName: selectedMember.name,
            amount: numAmount,
            type: type,
            date: new Date().toISOString().split('T')[0],
            paymentMethod,
            reference: `TRX-C${Math.floor(1000 + Math.random() * 9000)}`
        };

        toast.success(`KES ${numAmount.toLocaleString()} posted for ${selectedMember.name}`);
        onSuccess(allocation);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="bg-safaricom-dark p-8 text-white relative">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <FaPiggyBank size={120} />
                    </div>
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <h3 className="text-2xl font-black flex items-center gap-3">
                                <div className="p-3 bg-safaricom-green rounded-2xl shadow-lg">
                                    <FaPiggyBank />
                                </div>
                                Record Contribution
                            </h3>
                            <p className="text-xs font-bold text-gray-300 flex items-center gap-2">
                                <FaUsers /> GROUP CONTEXT: <span className="text-safaricom-green uppercase">{selectedGroupName || "NOT SELECTED"}</span>
                            </p>
                        </div>
                        <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl transition-all">
                            <FaTimes size={20} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-10 grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[70vh] overflow-y-auto">
                    {/* Left Column: Member & Type */}
                    <div className="space-y-6">
                        {/* Member Selector */}
                        <div className="relative">
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Select Member</label>
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                    <FaSearch />
                                </div>
                                <input
                                    type="text"
                                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-safaricom-green/10 outline-none font-bold text-gray-800 placeholder:text-gray-300 transition-all border-b-2 focus:border-b-safaricom-green"
                                    placeholder="Type member name or phone..."
                                    value={selectedMember ? selectedMember.name : searchTerm}
                                    onFocus={() => {
                                        setIsDropdownOpen(true);
                                        if (selectedMember) setSelectedMember(null);
                                    }}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {selectedMember && (
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                        <FaCheckCircle className="text-safaricom-green text-xl" />
                                    </div>
                                )}
                            </div>

                            {/* Smart Dropdown */}
                            {isDropdownOpen && (
                                <div className="absolute z-10 w-full mt-2 bg-white border border-gray-100 rounded-3xl shadow-2xl max-h-60 overflow-y-auto p-2">
                                    {filteredMembers.length > 0 ? filteredMembers.map(m => (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedMember(m);
                                                setIsDropdownOpen(false);
                                                setSearchTerm('');
                                            }}
                                            className="w-full text-left p-4 hover:bg-safaricom-green/5 rounded-2xl flex items-center justify-between group transition-all"
                                        >
                                            <div>
                                                <div className="font-black text-gray-800 group-hover:text-safaricom-dark">{m.name}</div>
                                                <div className="text-[10px] font-bold text-gray-400">{m.phone}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] text-gray-400 uppercase font-black">Balance</div>
                                                <div className="font-black text-xs text-safaricom-dark">KES {m.balance.toLocaleString()}</div>
                                            </div>
                                        </button>
                                    )) : (
                                        <div className="p-8 text-center text-gray-400 space-y-2">
                                            <FaInfoCircle className="mx-auto" size={24} />
                                            <p className="text-sm font-bold">No members found in this group.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Contribution Type */}
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Contribution Type</label>
                            <div className="grid grid-cols-2 gap-2">
                                {contributionTypes.map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setType(t)}
                                        className={`px-3 py-3 rounded-2xl text-[10px] font-black uppercase tracking-tight transition-all border-2 ${type === t
                                                ? 'bg-safaricom-green/10 border-safaricom-green text-safaricom-green'
                                                : 'bg-gray-50 border-transparent text-gray-500 hover:border-gray-100'
                                            }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Payment Method */}
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Payment Method</label>
                            <div className="flex gap-2">
                                {['Physical Cash', 'Bank Deposit', 'Mobile Money'].map(m => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => setPaymentMethod(m)}
                                        className={`flex-1 py-3 px-2 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${paymentMethod === m
                                                ? 'bg-blue-600/10 border-blue-600 text-blue-600'
                                                : 'bg-gray-50 border-transparent text-gray-400'
                                            }`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Amount & Preview */}
                    <div className="space-y-8 bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100">
                        {/* Amount Section */}
                        <div className="space-y-4">
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest text-center">Amount (KES)</label>
                            <input
                                required
                                type="number"
                                className="w-full bg-transparent text-5xl font-black text-gray-900 text-center outline-none placeholder:text-gray-200"
                                placeholder="0"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                            <div className="h-0.5 bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
                        </div>

                        {/* System Preview Section */}
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-2 px-2">
                                <FaShieldAlt /> System Impact Preview
                            </h4>

                            <div className="space-y-2">
                                <PreviewItem
                                    icon={<FaWallet className="text-green-500" />}
                                    label="Member Ledger"
                                    value={`+ KES ${parseFloat(amount || 0).toLocaleString()}`}
                                    sub="Increases savings balance"
                                />
                                <PreviewItem
                                    icon={<FaExchangeAlt className="text-blue-500" />}
                                    label="Cash Report"
                                    value={paymentMethod === 'Physical Cash' ? "CASH IN" : "BYPASS"}
                                    sub={paymentMethod === 'Physical Cash' ? "Affects today's reconciliation" : "Posts to bank ledger"}
                                />
                                <PreviewItem
                                    icon={<FaCheckCircle className="text-purple-500" />}
                                    label="Loan Eligibility"
                                    value="RECALCULATING"
                                    sub={`Multiplier: 3x -> KES ${(parseFloat(amount || 0) * 3).toLocaleString()}`}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full py-5 bg-safaricom-green hover:bg-safaricom-dark text-white font-black rounded-3xl shadow-xl shadow-green-900/20 transition-all flex items-center justify-center gap-3 text-lg"
                        >
                            <FaCheckCircle />
                            Post Contribution
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const PreviewItem = ({ icon, label, value, sub }) => (
    <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-3 shadow-sm">
        <div className="p-2 bg-gray-50 rounded-xl">{icon}</div>
        <div className="flex-1">
            <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-400 uppercase uppercase">{label}</span>
                <span className="text-xs font-black text-gray-800">{value}</span>
            </div>
            <div className="text-[9px] text-gray-400 font-medium italic">{sub}</div>
        </div>
    </div>
);

export default ContributionModal;
