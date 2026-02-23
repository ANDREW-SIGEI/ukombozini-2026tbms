import React, { useState, useMemo, useEffect } from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaUsers, FaChartLine, FaBell, FaDownload, FaShieldAlt, FaPhoneAlt, FaUserShield, FaSitemap, FaHistory, FaArrowRight, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../services/api';
import NotificationService from '../services/NotificationService';
import SearchableGroupSelector from '../components/SearchableGroupSelector';

const InstitutionalCompliance = () => {
    // Generate last 6 months
    const months = useMemo(() => {
        const result = [];
        const date = new Date();
        for (let i = 0; i < 6; i++) {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const label = date.toLocaleString('default', { month: 'long', year: 'numeric' });
            result.push({ value: `${year}-${month}`, label });
            date.setMonth(date.getMonth() - 1);
        }
        return result;
    }, []);

    const [selectedMonth, setSelectedMonth] = useState(months[0].value);
    const [selectedGroup, setSelectedGroup] = useState('all');
    const [loading, setLoading] = useState(true);
    const [memberCompliance, setMemberCompliance] = useState([]);
    const [groups, setGroups] = useState([]);
    const [activeTab, setActiveTab] = useState('paid');
    const [groupMatrix, setGroupMatrix] = useState(null);
    const [selectedMember, setSelectedMember] = useState(null); // For Relationship Profile

    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const data = await api.getGroups();
                setGroups(data || []);
            } catch (error) { console.error(error); }
        };
        fetchGroups();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const data = await api.getContributionCompliance(selectedMonth, selectedGroup);
                setMemberCompliance(data || []);
                if (selectedGroup !== 'all') {
                    const matrix = await api.getGroupMatrixStatus(selectedGroup);
                    setGroupMatrix(matrix);
                } else { setGroupMatrix(null); }
            } catch (error) {
                toast.error("Dashboard Sync Failed");
                console.error(error);
            } finally { setLoading(false); }
        };
        fetchData();
    }, [selectedMonth, selectedGroup]);

    const stats = useMemo(() => {
        const total = memberCompliance.length || 1;
        const paid = memberCompliance.filter(m => m.contributionStatus === 'Paid').length;
        const arrears = memberCompliance.filter(m => m.contributionStatus === 'Partial').length;
        const defaults = memberCompliance.filter(m => m.contributionStatus === 'Skipped').length;
        const totalFinancialRisk = memberCompliance.reduce((sum, m) => sum + (m.activeLoanBalance || 0), 0);

        return {
            paid, arrears, defaults,
            rate: ((paid / total) * 100).toFixed(1),
            totalFinancialRisk
        };
    }, [memberCompliance]);

    const handleNotifyGuarantors = async (member) => {
        if (!member.g1Phone && !member.g2Phone) {
            toast.warning("No linked guarantors identified for this entity.");
            return;
        }
        try {
            const msg = `INSTITUTIONAL ALERT: Member ${member.name} has defaulted on contributions for ${selectedMonth}. As a linked guarantor, your exposure is affected. Please intervene. [UKOMBOZINI]`;
            const recipients = [];
            if (member.g1Phone) recipients.push({ phone: member.g1Phone, message: msg });
            if (member.g2Phone) recipients.push({ phone: member.g2Phone, message: msg });

            await api.sendBulkNotification({
                target: 'CUSTOM',
                recipients: recipients,
                method: 'SMS'
            });
            toast.success(`Guarantor Escalation Triggered for ${member.name}`);
        } catch (error) { toast.error("Escalation Failed"); }
    };

    const handleExportPDF = async () => {
        try {
            toast.info('📄 Generating Institutional Compliance Report...');
            await api.downloadContributionComplianceReport(selectedMonth, selectedGroup);
            toast.success('✅ PDF Report Downloaded');
        } catch (error) { toast.error("PDF Export Failed"); }
    };

    return (
        <div className="space-y-6 relative overflow-hidden min-h-screen">
            {/* Header Area */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-safaricom-dark rounded-2xl flex items-center justify-center text-safaricom-green text-2xl shadow-2xl ring-4 ring-safaricom-green/5">
                        <FaUserShield />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-gray-900 tracking-tight">Institutional Compliance</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-black bg-safaricom-green/10 text-safaricom-green px-2 py-0.5 rounded uppercase tracking-widest">Live Registry</span>
                            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">{groupMatrix?.currentTier?.tier_name || 'Global'} Performance Layer</span>
                        </div>
                    </div>
                </div>
                <button onClick={handleExportPDF} className="px-6 py-3 bg-white border-2 border-gray-100 rounded-2xl font-black hover:border-safaricom-green hover:text-safaricom-green transition-all shadow-sm active:scale-95">
                    <FaDownload className="inline mr-2" /> EXPORT AUDIT LOG
                </button>
            </div>

            {/* Matrix & Period Selection */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-1 bg-safaricom-dark p-6 rounded-3xl text-white relative overflow-hidden group">
                    <div className="absolute -right-10 -top-10 text-9xl text-white/5 rotate-12 group-hover:rotate-45 transition-all duration-700"><FaShieldAlt /></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] font-black opacity-50 uppercase tracking-[0.2em]">Institutional Health</span>
                            {stats.rate < 85 && (
                                <span className="bg-red-500 text-[8px] font-black px-2 py-0.5 rounded-full animate-pulse">PENALTY ACTIVE</span>
                            )}
                        </div>
                        <div className="text-5xl font-black my-2">{groupMatrix ? groupMatrix.score.toFixed(0) : '—'}<span className="text-xl opacity-40">%</span></div>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-safaricom-green shadow-[0_0_15px_#76bc21]" style={{ width: `${groupMatrix?.score || 0}%` }}></div>
                            </div>
                            <span className="text-[10px] font-black text-safaricom-green">{groupMatrix?.currentTier?.tier_name || 'PENDING'}</span>
                        </div>
                    </div>
                </div>

                <KPICard color="safaricom" label="Compliance Rate" value={`${stats.rate}%`} icon={<FaChartLine />} trend="+2.4%" />
                <KPICard color="red" label="Default Exposure" value={`KES ${stats.totalFinancialRisk.toLocaleString()}`} icon={<FaExclamationTriangle />} subtitle="Institutional Capital At Risk" />

                <div className="bg-white p-6 rounded-3xl border-2 border-gray-100 shadow-sm flex flex-col justify-between">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Audit Window</label>
                    <div className="space-y-3">
                        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full bg-gray-50 border-none rounded-xl font-bold py-3 px-4 outline-none focus:ring-2 focus:ring-safaricom-green/20">
                            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                        <SearchableGroupSelector
                            groups={groups}
                            selectedGroupId={selectedGroup === 'all' ? '' : selectedGroup}
                            onSelect={(id) => setSelectedGroup(id || 'all')}
                            label=""
                            placeholder="All Group Entities"
                        />
                    </div>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-4 p-1 bg-gray-100 rounded-2xl overflow-x-auto scroller-hidden">
                <FilterTab active={activeTab === 'paid'} onClick={() => setActiveTab('paid')} label="CONSISTENT" count={stats.paid} color="green" />
                <FilterTab active={activeTab === 'partial'} onClick={() => setActiveTab('partial')} label="AT RISK" count={stats.arrears} color="orange" />
                <FilterTab active={activeTab === 'skipped'} onClick={() => setActiveTab('skipped')} label="DEFAULTED" count={stats.defaults} color="red" />
            </div>

            {/* Main Registry */}
            <div className="bg-white rounded-[2.5rem] border-2 border-gray-50 shadow-2xl overflow-hidden min-h-[400px]">
                <div className="p-8">
                    {loading ? (
                        <div className="py-20 text-center">
                            <div className="animate-spin w-12 h-12 border-4 border-safaricom-green border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p className="text-sm font-black text-gray-400 uppercase tracking-widest animate-pulse">Scanning Governance Ledger...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b-2 border-gray-50">
                                        <th className="pb-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Institutional Entity</th>
                                        <th className="pb-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Risk Propagation</th>
                                        <th className="pb-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Commitment KES</th>
                                        <th className="pb-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Intervention</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y-2 divide-gray-50">
                                    {(activeTab === 'paid' ? memberCompliance.filter(m => m.contributionStatus === 'Paid') :
                                        activeTab === 'partial' ? memberCompliance.filter(m => m.contributionStatus === 'Partial') :
                                            memberCompliance.filter(m => m.contributionStatus === 'Skipped')).map(member => (
                                                <tr key={member.id} className="group hover:bg-safaricom-green/5 transition-all cursor-pointer" onClick={() => setSelectedMember(member)}>
                                                    <td className="py-6">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black ${member.aging.riskLevel === 'CRITICAL' ? 'bg-red-600 text-white animate-pulse' :
                                                                member.aging.riskLevel === 'HIGH' ? 'bg-red-100 text-red-600' :
                                                                    member.aging.riskLevel === 'MEDIUM' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'
                                                                }`}>
                                                                {member.name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <div className="font-black text-gray-900 group-hover:text-safaricom-green transition-colors">{member.name}</div>
                                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{member.groupName}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-6">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full ${member.aging.isDelinquent ? 'bg-red-500 animate-ping' : 'bg-green-500'}`}></div>
                                                            <span className="text-[10px] font-black text-gray-700 uppercase tracking-tighter">
                                                                {member.aging.riskLevel} EXPOSURE
                                                            </span>
                                                        </div>
                                                        {member.guaranteedExposure > 0 && (
                                                            <div className="text-[9px] font-bold text-red-400 mt-1">Guarantor for KES {member.guaranteedExposure.toLocaleString()}</div>
                                                        )}
                                                    </td>
                                                    <td className="py-6 text-right">
                                                        <div className="font-black text-gray-900">KES {member.contributionAmount.toLocaleString()}</div>
                                                        <div className="text-[10px] font-bold opacity-40">TARGET: KES {member.expectedAmount.toLocaleString()}</div>
                                                    </td>
                                                    <td className="py-6">
                                                        <div className="flex justify-center gap-2" onClick={e => e.stopPropagation()}>
                                                            <button onClick={() => handleNotifyGuarantors(member)} className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all transform active:scale-95" title="Escalate to Guarantors">
                                                                <FaUserShield />
                                                            </button>
                                                            <button onClick={() => toast.info(`Push notification sent to ${member.name}`)} className="p-3 bg-safaricom-green/10 text-safaricom-green rounded-xl hover:bg-safaricom-green hover:text-white transition-all transform active:scale-95" title="Direct Reminder">
                                                                <FaBell />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                    {memberCompliance.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan="4" className="py-20 text-center">
                                                <div className="text-gray-100 text-7xl font-black mb-4 uppercase select-none opacity-20">No Integrity Gap</div>
                                                <p className="text-xs font-black text-gray-300 uppercase tracking-widest">All records satisfy performance criteria</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Relationship Profile Drawer */}
            {selectedMember && (
                <>
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] transition-opacity" onClick={() => setSelectedMember(null)}></div>
                    <div className="fixed right-0 top-0 h-screen w-full max-w-md bg-white z-[110] shadow-[0_0_100px_rgba(0,0,0,0.4)] animate-slide-left p-8 overflow-y-auto">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Institutional Profile</h3>
                            <button onClick={() => setSelectedMember(null)} className="p-2 hover:bg-gray-100 rounded-full transition-all"><FaTimes /></button>
                        </div>

                        {/* Profile Summary */}
                        <div className="bg-gray-50 rounded-3xl p-6 mb-8 border border-gray-100">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-16 h-16 bg-safaricom-dark rounded-2xl flex items-center justify-center text-white text-2xl font-black">{selectedMember.name.charAt(0)}</div>
                                <div>
                                    <div className="text-2xl font-black text-gray-900 leading-tight">{selectedMember.name}</div>
                                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">{selectedMember.phone}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
                                    <div className="text-[10px] font-black text-gray-400 uppercase mb-1">Active Loan</div>
                                    <div className="text-sm font-black text-red-600">KES {selectedMember.activeLoanBalance.toLocaleString()}</div>
                                </div>
                                <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
                                    <div className="text-[10px] font-black text-gray-400 uppercase mb-1">Risk Weight</div>
                                    <div className="text-sm font-black text-gray-800">{selectedMember.aging.riskLevel}</div>
                                </div>
                            </div>
                        </div>

                        {/* Network Map */}
                        <div className="space-y-8">
                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">
                                    <FaUserShield className="text-safaricom-green" /> Linked Guarantors
                                </label>
                                <div className="space-y-2">
                                    <RelationshipItem name={selectedMember.g1Name || 'Unlinked'} phone={selectedMember.g1Phone} role="Primary Guarantor" />
                                    <RelationshipItem name={selectedMember.g2Name || 'Unlinked'} phone={selectedMember.g2Phone} role="Secondary Guarantor" />
                                </div>
                                <button onClick={() => handleNotifyGuarantors(selectedMember)} className="w-full mt-4 py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-red-700 transition-all active:scale-95 shadow-xl shadow-red-100">Notify Guarantor Network</button>
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">
                                    <FaHistory className="text-blue-500" /> Recovery Asset (Next-of-Kin)
                                </label>
                                <RelationshipItem name={selectedMember.nokName || 'Missing'} phone={selectedMember.nokPhone} role={`NOK (${selectedMember.nokRelation || 'n/a'})`} />
                            </div>

                            <div className="p-6 bg-orange-50 border border-orange-100 rounded-3xl relative overflow-hidden group">
                                <FaSitemap className="absolute -right-4 -bottom-4 text-6xl text-orange-200 group-hover:scale-110 transition-transform" />
                                <label className="flex items-center gap-2 text-[10px] font-black text-orange-700 uppercase tracking-widest mb-2"><FaArrowRight /> Risk Propagation</label>
                                <p className="text-[11px] font-bold text-orange-900/70 leading-relaxed uppercase">
                                    Institutional exposure alert: This entity guarantees <strong>KES {selectedMember.guaranteedExposure.toLocaleString()}</strong> in active group capital.
                                    Failure to comply triggers multi-party risk across the group profile.
                                </p>
                            </div>
                        </div>
                    </div>
                </>
            )}

            <style>{`
                @keyframes slide-left { from { transform: translateX(100%); } to { transform: translateX(0); } }
                .animate-slide-left { animation: slide-left 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
                .scroller-hidden::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
};

const KPICard = ({ label, value, icon, trend, color, subtitle }) => {
    const accent = color === 'red' ? 'text-red-500 bg-red-50' : 'text-safaricom-green bg-safaricom-green/5';
    return (
        <div className="bg-white p-6 rounded-[2rem] border-2 border-gray-100 shadow-sm relative group hover:scale-[1.02] transition-all">
            <div className={`absolute top-6 right-6 p-3 rounded-2xl transition-all ${accent} group-hover:bg-safaricom-dark group-hover:text-white`}>
                {icon}
            </div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
            <div className="text-3xl font-black text-gray-900 mt-2 mb-1 tracking-tighter">{value}</div>
            {trend && <div className="text-xs font-black text-safaricom-green">{trend} <span className="text-gray-300 font-bold ml-1 uppercase">improvement</span></div>}
            {subtitle && <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{subtitle}</div>}
        </div>
    );
};

const FilterTab = ({ active, label, count, color, onClick }) => {
    const colors = {
        green: 'text-safaricom-green bg-safaricom-green/10',
        orange: 'text-orange-600 bg-orange-50',
        red: 'text-red-600 bg-red-50'
    };
    return (
        <button onClick={onClick} className={`flex-1 flex items-center justify-between px-6 py-5 rounded-2xl transition-all whitespace-nowrap ${active ? 'bg-white shadow-xl ring-2 ring-gray-200/20' : 'opacity-40 grayscale hover:opacity-100 hover:grayscale-0'}`}>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">{label}</span>
            <div className={`px-4 py-1.5 rounded-xl font-black text-base ${colors[color]}`}>{count}</div>
        </button>
    );
};

const RelationshipItem = ({ name, phone, role }) => (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 transition-all hover:bg-white hover:border-safaricom-green/20">
        <div>
            <div className="text-[10px] font-black text-gray-400 uppercase mb-0.5 tracking-tighter">{role}</div>
            <div className="text-sm font-black text-gray-800">{name}</div>
        </div>
        {phone && (
            <button onClick={() => toast.info(`Direct Dial Attempt: ${phone}`)} className="p-3 bg-white text-safaricom-green rounded-xl shadow-lg border border-gray-100 hover:bg-safaricom-green hover:text-white transition-all active:scale-90">
                <FaPhoneAlt size={14} />
            </button>
        )}
    </div>
);

export default InstitutionalCompliance;
