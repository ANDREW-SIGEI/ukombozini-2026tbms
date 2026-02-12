import React, { useState, useEffect } from 'react';
import { FaComment, FaEnvelope, FaBell, FaCheckCircle, FaExclamationCircle, FaRedo, FaSms, FaPaperPlane, FaUsers, FaUserTag, FaLayerGroup, FaHistory } from 'react-icons/fa';
import NotificationService from '../services/NotificationService';
import { api } from '../services/api';
import { toast } from 'react-toastify';

const CommunicationHub = () => {
    const [logs, setLogs] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [activeTab, setActiveTab] = useState('LOGS'); // LOGS, COMPOSE
    const [filter, setFilter] = useState('ALL');
    const [balance, setBalance] = useState(null);

    // Composer State
    const [targetType, setTargetType] = useState('ROLES'); // ROLES, GROUPS
    const [members, setMembers] = useState([]);
    const [selectedRoles, setSelectedRoles] = useState([]);
    const [selectedGroups, setSelectedGroups] = useState([]);
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [message, setMessage] = useState('');
    const [method, setMethod] = useState('SMS');
    const [memberSearch, setMemberSearch] = useState('');

    const TEMPLATES = [
        { name: 'Meeting Reminder', text: 'Jambo [NAME]! Reminder for our next meeting on [NEXT_MEETING]. Your current Sav: KES [SAVINGS]. Please attend. - UKOMBOZINI' },
        { name: 'Financial Snapshot', text: 'Hello [NAME], your standing: Sav: KES [SAVINGS] | Projects: [PROJECT_BAL] | Loan: [LOAN_BAL]. Next Meeting: [NEXT_MEETING]. - UKOMBOZINI' },
        { name: 'Repayment Alert', text: 'Dear [NAME], loan balance of KES [LOAN_BAL] is active. Please ensure timely repayment before [NEXT_MEETING] to maintain your score. - UKOMBOZINI' }
    ];

    const VARIABLES = [
        { name: 'Name', tag: '[NAME]' },
        { name: 'Savings', tag: '[SAVINGS]' },
        { name: 'Projects', tag: '[PROJECT_BAL]' },
        { name: 'Loan Bal', tag: '[LOAN_BAL]' },
        { name: 'Next Meeting', tag: '[NEXT_MEETING]' }
    ];

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [logData, groupData, memberData, balanceData] = await Promise.all([
                NotificationService.getLogs(100),
                api.getGroups(),
                api.getMembers(),
                api.getSMSBalance().catch(() => ({ balance: 'Error' }))
            ]);
            setLogs(logData || []);
            setGroups(groupData || []);
            setMembers(memberData || []);
            setBalance(balanceData?.balance);
        } catch (err) {
            console.error("fetchData error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSendBulk = async () => {
        if (!message.trim()) {
            return toast.error("Please enter a message.");
        }
        if (targetType === 'ROLES' && selectedRoles.length === 0) {
            return toast.error("Please select at least one role.");
        }
        if (targetType === 'GROUPS' && selectedGroups.length === 0) {
            return toast.error("Please select at least one group.");
        }
        if (targetType === 'MEMBERS' && selectedMembers.length === 0) {
            return toast.error("Please select at least one member.");
        }

        setSending(true);
        try {
            let targetIds = [];
            if (targetType === 'GROUPS') targetIds = selectedGroups;
            else if (targetType === 'MEMBERS') targetIds = selectedMembers;
            else targetIds = selectedRoles;

            const res = await NotificationService.sendBulk({
                target: targetType,
                targetIds: targetIds,
                message,
                method,
                variables: true // Flag for backend to perform injection
            });
            if (res.success) {
                toast.success(res.message);
                setMessage('');
                setSelectedRoles([]);
                setSelectedGroups([]);
                setSelectedMembers([]);
                setActiveTab('LOGS');
                fetchData();
            }
        } catch (err) {
            console.error("sendBulk error:", err);
        } finally {
            setSending(false);
        }
    };

    const toggleRole = (role) => {
        setSelectedRoles(prev =>
            prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
        );
    };

    const toggleGroup = (groupId) => {
        setSelectedGroups(prev =>
            prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
        );
    };

    const toggleMember = (memberId) => {
        setSelectedMembers(prev =>
            prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
        );
    };

    const filteredMembers = members.filter(m =>
        m.name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.phone?.toLowerCase().includes(memberSearch.toLowerCase())
    );

    const handleSelectAllFiltered = () => {
        const filteredIds = filteredMembers.map(m => m.id);
        const allSelected = filteredIds.every(id => selectedMembers.includes(id));

        if (allSelected) {
            setSelectedMembers(prev => prev.filter(id => !filteredIds.includes(id)));
        } else {
            setSelectedMembers(prev => Array.from(new Set([...prev, ...filteredIds])));
        }
    };

    const filteredLogs = logs.filter(log => filter === 'ALL' || log.type === filter);

    const getIcon = (type) => {
        if (type === 'SMS' || type === 'BULK_NOTIFICATION') return <FaSms className="text-blue-500" />;
        if (type === 'EMAIL') return <FaEnvelope className="text-orange-500" />;
        return <FaBell className="text-gray-500" />;
    };

    const timeAgo = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                        <FaBell className="text-safaricom-green h-6 w-6" />
                        Communication Hub
                    </h2>
                    <p className="text-sm text-gray-500 font-medium">Director-level control for official communications.</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-2xl border border-gray-200">
                    <button
                        onClick={() => setActiveTab('LOGS')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'LOGS' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                    >
                        <FaHistory /> DELIVERY LOGS
                    </button>
                    <button
                        onClick={() => setActiveTab('COMPOSE')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'COMPOSE' ? 'bg-safaricom-green shadow-sm text-white' : 'text-gray-500'}`}
                    >
                        <FaPaperPlane /> COMPOSE
                    </button>
                    {balance && (
                        <div className="ml-4 flex flex-col justify-center border-l pl-4 border-gray-200">
                            <span className="text-[8px] font-black text-gray-400 uppercase leading-none">SMS Balance</span>
                            <span className="text-xs font-black text-safaricom-green">{balance}</span>
                        </div>
                    )}
                </div>
            </div>

            {activeTab === 'COMPOSE' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Audience Selection */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-gray-100">
                            <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2 uppercase tracking-tight">
                                <FaUsers className="text-blue-500" /> 1. Select Audience
                            </h3>

                            <div className="flex gap-2 mb-6">
                                <button
                                    onClick={() => setTargetType('ROLES')}
                                    className={`flex-1 py-3 rounded-2xl text-[10px] font-black transition-all border ${targetType === 'ROLES' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-100 text-gray-500'}`}
                                >
                                    GROUP OFFICIALS
                                </button>
                                <button
                                    onClick={() => setTargetType('OFFICERS')}
                                    className={`flex-1 py-3 rounded-2xl text-[10px] font-black transition-all border ${targetType === 'OFFICERS' ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white border-gray-100 text-gray-500'}`}
                                >
                                    FIELD STAFF
                                </button>
                                <button
                                    onClick={() => setTargetType('GROUPS')}
                                    className={`flex-1 py-3 rounded-2xl text-[10px] font-black transition-all border ${targetType === 'GROUPS' ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-gray-100 text-gray-500'}`}
                                >
                                    BY GROUP
                                </button>
                                <button
                                    onClick={() => setTargetType('MEMBERS')}
                                    className={`flex-1 py-3 rounded-2xl text-[10px] font-black transition-all border ${targetType === 'MEMBERS' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-100 text-gray-500'}`}
                                >
                                    MEMBERS
                                </button>
                            </div>

                            {targetType === 'ROLES' ? (
                                <div className="space-y-2">
                                    {['Chairman', 'Secretary', 'Treasurer'].map(role => (
                                        <label key={role} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                                            <input
                                                type="checkbox"
                                                checked={selectedRoles.includes(role)}
                                                onChange={() => toggleRole(role)}
                                                className="w-5 h-5 rounded-lg border-2 border-gray-200 text-safaricom-green focus:ring-safaricom-green"
                                            />
                                            <div>
                                                <div className="text-sm font-black text-gray-900">{role === 'Chairman' ? 'Chairpersons' : role + 's'}</div>
                                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Active {role}s in system</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            ) : targetType === 'OFFICERS' ? (
                                <div className="space-y-2">
                                    {['Field Officer', 'Director', 'Admin'].map(role => (
                                        <label key={role} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                                            <input
                                                type="checkbox"
                                                checked={selectedRoles.includes(role)}
                                                onChange={() => toggleRole(role)}
                                                className="w-5 h-5 rounded-lg border-2 border-gray-200 text-safaricom-green focus:ring-safaricom-green"
                                            />
                                            <div>
                                                <div className="text-sm font-black text-gray-900">{role}s</div>
                                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">System level {role}s</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            ) : targetType === 'GROUPS' ? (
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {groups.map(g => (
                                        <label key={g.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                                            <input
                                                type="checkbox"
                                                checked={selectedGroups.includes(g.id)}
                                                onChange={() => toggleGroup(g.id)}
                                                className="w-5 h-5 rounded-lg border-2 border-gray-200 text-safaricom-green focus:ring-safaricom-green"
                                            />
                                            <div className="truncate">
                                                <div className="text-sm font-black text-gray-900 truncate">{g.name}</div>
                                                <div className="text-[10px] text-gray-400 font-bold">{g.location || 'No Location'}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            ) : targetType === 'MEMBERS' ? (
                                <div className="space-y-4">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={memberSearch}
                                            onChange={(e) => setMemberSearch(e.target.value)}
                                            placeholder="Search members..."
                                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-safaricom-green/20"
                                        />
                                        <FaUsers className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                                    </div>

                                    <button
                                        onClick={handleSelectAllFiltered}
                                        className="w-full py-2 bg-gray-50 text-[10px] font-black text-gray-500 rounded-xl border border-gray-100 hover:bg-gray-100 transition-all uppercase"
                                    >
                                        {filteredMembers.every(m => selectedMembers.includes(m.id)) ? 'Deselect All Visible' : 'Select All Visible'}
                                    </button>

                                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                        {filteredMembers.length > 0 ? (
                                            filteredMembers.map(m => (
                                                <label key={m.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedMembers.includes(m.id)}
                                                        onChange={() => toggleMember(m.id)}
                                                        className="w-4 h-4 rounded border-2 border-gray-200 text-safaricom-green focus:ring-safaricom-green"
                                                    />
                                                    <div className="truncate">
                                                        <div className="text-xs font-black text-gray-900 truncate">{m.name}</div>
                                                        <div className="text-[9px] text-gray-400 font-bold">{m.phone}</div>
                                                    </div>
                                                </label>
                                            ))
                                        ) : (
                                            <div className="py-10 text-center text-gray-400 text-[10px] font-bold uppercase tracking-widest">
                                                No matches identified
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-[2.5rem] shadow-xl text-white">
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 text-center">Summary</h4>
                            <div className="flex justify-around text-center">
                                <div>
                                    <div className="text-2xl font-black text-safaricom-green">
                                        {targetType === 'GROUPS' ? selectedGroups.length : (targetType === 'MEMBERS' ? selectedMembers.length : selectedRoles.length)}
                                    </div>
                                    <h1 className="text-xl font-bold text-gray-800">UKOMBOZINI <span className="text-blue-600">HUB</span></h1>
                                </div>
                                <div>
                                    <div className="text-2xl font-black text-blue-400">{method}</div>
                                    <div className="text-[8px] font-bold text-gray-500 uppercase">Method</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Message Editor */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100 h-full flex flex-col">
                            <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2 uppercase tracking-tight">
                                <FaComment className="text-safaricom-green" /> 2. Compose Message
                            </h3>

                            {/* Template Quick Select */}
                            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                                {TEMPLATES.map(t => (
                                    <button
                                        key={t.name}
                                        onClick={() => setMessage(t.text)}
                                        className="whitespace-nowrap px-3 py-1.5 bg-gray-50 text-[10px] font-black text-gray-500 rounded-lg border border-gray-100 hover:bg-safaricom-green hover:text-white transition-all"
                                    >
                                        + {t.name}
                                    </button>
                                ))}
                            </div>

                            {/* Dynamic Variables Selector */}
                            <div className="mb-6">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Insert Dynamic Variable</label>
                                <div className="flex flex-wrap gap-2">
                                    {VARIABLES.map(v => (
                                        <button
                                            key={v.tag}
                                            onClick={() => setMessage(prev => prev + v.tag)}
                                            className="px-3 py-1.5 bg-blue-50 text-[10px] font-black text-blue-600 rounded-xl border border-blue-100 hover:bg-blue-600 hover:text-white transition-all"
                                        >
                                            {v.name} {v.tag}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-4 mb-6">
                                <button
                                    onClick={() => setMethod('SMS')}
                                    className={`flex-1 p-3 rounded-2xl border-2 transition-all flex items-center justify-center gap-2 font-black text-sm ${method === 'SMS' ? 'border-safaricom-green bg-green-50 text-safaricom-green' : 'border-gray-100 text-gray-400 hover:border-gray-200'}`}
                                >
                                    <FaSms /> SMS
                                </button>
                                <button
                                    onClick={() => setMethod('INAPP')}
                                    disabled
                                    className="flex-1 p-3 rounded-2xl border-2 border-gray-50 text-gray-200 flex items-center justify-center gap-2 font-black text-sm cursor-not-allowed"
                                >
                                    <FaBell /> IN-APP (Soon)
                                </button>
                            </div>

                            <div className="relative flex-1 min-h-[200px] mb-6">
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Type your official message here..."
                                    className="w-full h-full p-6 text-lg font-medium text-gray-800 bg-gray-50 rounded-3xl border-2 border-transparent focus:border-safaricom-green focus:bg-white transition-all resize-none placeholder-gray-400 outline-none"
                                />
                                <div className={`absolute bottom-4 right-4 text-[10px] font-black px-3 py-1 rounded-full ${message.length > 160 ? 'bg-orange-100 text-orange-600' : 'bg-gray-200 text-gray-500'}`}>
                                    {message.length} / 160 Characters
                                </div>
                            </div>

                            <button
                                onClick={handleSendBulk}
                                disabled={sending || !message.trim()}
                                className={`w-full py-5 rounded-2xl bg-safaricom-green text-white font-black text-xl shadow-lg shadow-green-100 hover:shadow-green-200 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {sending ? (
                                    <>
                                        <FaPaperPlane className="animate-pulse" /> SENDING BULK TRANSMISSION...
                                    </>
                                ) : (
                                    <>
                                        <FaPaperPlane /> BROADCAST MESSAGE
                                    </>
                                )}
                            </button>
                            <p className="mt-4 text-[10px] text-gray-400 font-bold text-center uppercase tracking-widest">
                                Transaction logs will be generated automatically for audit.
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Filters */}
                    <div className="flex justify-between items-center bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                        <div className="flex gap-2">
                            {['ALL', 'SMS', 'EMAIL'].map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-5 py-2.5 rounded-2xl text-[10px] font-black transition-all ${filter === f ? 'bg-safaricom-green text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={fetchData}
                            className="p-3 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors"
                        >
                            <FaRedo className={`${loading ? 'animate-spin' : ''} text-gray-400`} />
                        </button>
                    </div>

                    {/* Logs List */}
                    <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-100">
                        {loading ? (
                            <div className="p-20 text-center flex flex-col items-center gap-4">
                                <div className="h-12 w-12 border-4 border-gray-100 border-t-safaricom-green rounded-full animate-spin" />
                                <span className="text-sm font-black text-gray-400 uppercase tracking-widest">Accessing Logs...</span>
                            </div>
                        ) : filteredLogs.length === 0 ? (
                            <div className="p-20 text-center flex flex-col items-center gap-4">
                                <FaHistory className="text-gray-100 text-6xl" />
                                <span className="text-sm font-black text-gray-400 uppercase tracking-widest">No communications found.</span>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {filteredLogs.map(log => (
                                    <div key={log.id} className="p-6 hover:bg-gray-50/50 transition-colors flex gap-6">
                                        <div className={`p-4 rounded-3xl h-fit border ${log.status === 'SENT' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                                            {getIcon(log.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-black text-gray-800 uppercase tracking-widest px-2 py-0.5 bg-gray-100 rounded-lg">{log.type}</span>
                                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${log.status === 'SENT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {log.status}
                                                        </span>
                                                    </div>
                                                    <h4 className="text-sm font-black text-gray-900 truncate">
                                                        {log.recipient_name || 'System Notification'}
                                                        <span className="text-gray-400 font-medium ml-2">({log.phone || log.recipient})</span>
                                                    </h4>
                                                </div>
                                                <span className="text-[10px] text-gray-400 font-bold whitespace-nowrap">{timeAgo(log.created_at)}</span>
                                            </div>

                                            <p className="text-sm text-gray-600 leading-relaxed font-medium bg-gray-50/80 p-4 rounded-3xl border border-gray-50">
                                                {log.message || log.body}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )
            }
        </div >
    );
};

export default CommunicationHub;
