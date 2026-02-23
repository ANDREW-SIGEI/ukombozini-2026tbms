import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import {
    FaFileInvoice, FaArrowRight, FaLock, FaCalendarAlt,
    FaFilter, FaSearch, FaFilePdf, FaFileExcel,
    FaChartLine, FaCheckCircle, FaExclamationTriangle,
    FaMoneyBillWave, FaShieldAlt
} from 'react-icons/fa';
import SearchableGroupSelector from '../components/SearchableGroupSelector';

const MonthlyReports = () => {
    const { user } = useAuth();
    const [groups, setGroups] = useState([]);
    const [activeTab, setActiveTab] = useState('cash'); // 'cash', 'loans', 'compliance'

    // Filters
    const [selectedGroup, setSelectedGroup] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // Data
    const [cashReports, setCashReports] = useState([]);
    const [loanReports, setLoanReports] = useState([]);
    const [complianceReports, setComplianceReports] = useState([]);
    const [loading, setLoading] = useState(false);
    const [drillDown, setDrillDown] = useState(null);

    useEffect(() => {
        loadGroups();
        fetchData();
    }, [activeTab]);

    const loadGroups = async () => {
        const data = await api.getGroups();
        setGroups(data || []);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const monthStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`;

            if (activeTab === 'cash') {
                const filters = { month: selectedMonth, year: selectedYear };
                if (selectedGroup) filters.groupId = selectedGroup;
                const data = await api.getMonthlyReports(filters);
                setCashReports(data || []);
            } else if (activeTab === 'loans') {
                const data = await api.getLoanTracking(monthStr);
                setLoanReports(data || []);
            } else if (activeTab === 'compliance') {
                const data = await api.getContributionCompliance(monthStr, selectedGroup || 'all');
                setComplianceReports(data || []);
            }
        } catch (err) {
            console.error("Fetch Error:", err);
            toast.error("Failed to fetch institutional data");
        } finally {
            setLoading(false);
        }
    };

    const handleDrillDown = async (report) => {
        try {
            const data = await api.getMonthlyReportDetails(report.id);
            setDrillDown(data);
        } catch (err) {
            toast.error("Failed to load drill-down details");
        }
    };

    const getRiskBadge = (level) => {
        const colors = {
            'CRITICAL': 'bg-red-100 text-red-700 border-red-200',
            'HIGH': 'bg-orange-100 text-orange-700 border-orange-200',
            'MEDIUM': 'bg-yellow-100 text-yellow-700 border-yellow-200',
            'LOW': 'bg-green-100 text-green-700 border-green-200'
        };
        return <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${colors[level] || colors.LOW}`}>{level}</span>;
    };

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1];

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            {/* GOVERNANCE WATERMARK */}
            <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-30deg)', fontSize: '10rem', color: 'rgba(0,0,0,0.02)', fontWeight: 900, pointerEvents: 'none', zIndex: 0, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Institutional Intelligence
            </div>

            <div className="max-w-7xl mx-auto relative z-10">
                <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                            <FaShieldAlt className="text-safaricom-green" />
                            Ukombozi MIS Hub
                        </h1>
                        <p className="text-gray-500 font-medium mt-1 uppercase tracking-widest text-[10px]">Management Information System • Governance • Audit</p>
                    </div>

                    <div className="flex p-1 bg-gray-200/50 rounded-2xl backdrop-blur-sm">
                        {[
                            { id: 'cash', label: 'Cash Flow', icon: <FaMoneyBillWave /> },
                            { id: 'loans', label: 'Loan Tracking', icon: <FaChartLine /> },
                            { id: 'compliance', label: 'Compliance', icon: <FaCheckCircle /> }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all text-sm ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* FILTERS */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end mb-8">
                    <div className="flex-1 min-w-[300px] relative z-20">
                        <SearchableGroupSelector
                            groups={groups}
                            selectedGroupId={selectedGroup}
                            onSelect={(id) => setSelectedGroup(id)}
                            label="Group Entity"
                        />
                    </div>
                    <div className="w-48">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Month</label>
                        <select
                            className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none font-bold"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                        >
                            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                    </div>
                    <div className="w-32">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Year</label>
                        <select
                            className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none font-bold"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                        >
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <button
                        onClick={fetchData}
                        className="bg-safaricom-green hover:bg-green-700 text-white px-8 py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-green-900/10 flex items-center gap-2 h-[52px]"
                    >
                        <FaSearch size={14} />
                        Fetch Insight
                    </button>
                </div>

                {/* CONTENT AREA */}
                {loading ? (
                    <div className="p-40 text-center">
                        <div className="inline-block animate-spin mb-4"><FaShieldAlt size={40} className="text-gray-200" /></div>
                        <div className="animate-pulse text-gray-400 font-bold uppercase tracking-widest text-xs">
                            Synthesizing Institutional Matrix Data...
                        </div>
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {activeTab === 'cash' && renderCashTab()}
                        {activeTab === 'loans' && renderLoansTab()}
                        {activeTab === 'compliance' && renderComplianceTab()}
                    </div>
                )}
            </div>

            {/* DRILL DOWN MODAL */}
            {drillDown && renderDrillDown()}

            <style>{`
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );

    function renderCashTab() {
        if (cashReports.length === 0) return renderEmpty('No Cash Reports', 'Reports generated upon locking daily sessions.');
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cashReports.map((report) => (
                    <div key={report.id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 flex gap-2">
                            <button onClick={() => api.downloadMonthlyReportPDF(report.id)} className="p-2 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors shadow-sm"><FaFilePdf size={14} /></button>
                            <button onClick={() => api.downloadMonthlyReportExcel(report.id)} className="p-2 bg-gray-50 hover:bg-green-50 text-gray-400 hover:text-green-500 rounded-lg transition-colors shadow-sm"><FaFileExcel size={14} /></button>
                            <FaLock className="text-gray-100" size={20} />
                        </div>
                        <div className="mb-6">
                            <h3 className="text-xl font-black text-gray-900 mb-1">{report.group_name}</h3>
                            <p className="text-sm font-bold text-safaricom-green uppercase tracking-widest">{months[report.month - 1]} {report.year}</p>
                        </div>

                        <div className="space-y-4 mb-8">
                            {[
                                { label: 'Opening Pool', val: report.opening_balance, color: 'text-gray-900' },
                                { label: 'Total Inflows', val: report.total_cash_in, color: 'text-green-600', prefix: '+' },
                                { label: 'Total Outflows', val: report.total_cash_out, color: 'text-red-600', prefix: '-' }
                            ].map((item, idx) => (
                                <div key={idx} className="flex justify-between items-end border-b border-gray-50 pb-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{item.label}</span>
                                    <span className={`font-black ${item.color}`}>{item.prefix}KES {Number(item.val).toLocaleString()}</span>
                                </div>
                            ))}
                            <div className="flex justify-between items-end pt-2">
                                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Closing Balance</span>
                                <span className="text-lg font-black text-blue-900 underline decoration-blue-200 decoration-4">KES {Number(report.closing_balance).toLocaleString()}</span>
                            </div>
                        </div>

                        <button
                            onClick={() => handleDrillDown(report)}
                            className="w-full py-3 rounded-xl bg-gray-900 text-white font-bold transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-black/10 hover:bg-gray-800"
                        >
                            Drill Down LEDGER
                            <FaArrowRight size={12} />
                        </button>
                    </div>
                ))}
            </div>
        );
    }

    function renderLoansTab() {
        if (loanReports.length === 0) return renderEmpty('No Loan Data', 'Track live repayment performance and aging.');
        return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-500 tracking-widest">Member Portfolio</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-500 tracking-widest">Expected Payout</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-500 tracking-widest">Actual Paid</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-500 tracking-widest">Arrears</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-500 tracking-widest">Remaining Balance</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-500 tracking-widest text-center">Audit Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                        {loanReports.map(loan => (
                            <tr key={loan.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                    <p className="font-bold text-gray-900">{loan.memberName}</p>
                                    <p className="text-[10px] text-gray-400">{loan.loanType || 'ACTIVE LOAN'}</p>
                                </td>
                                <td className="px-6 py-4 text-gray-600">KES {loan.monthlyRepayment.toLocaleString()}</td>
                                <td className="px-6 py-4 font-bold text-green-600">KES {loan.paidThisMonth.toLocaleString()}</td>
                                <td className={`px-6 py-4 font-bold ${loan.arrears > 0 ? 'text-red-600' : 'text-gray-300'}`}>KES {loan.arrears.toLocaleString()}</td>
                                <td className="px-6 py-4 font-black text-blue-900">KES {loan.remainingBalance.toLocaleString()}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${loan.status === 'Paid' ? 'bg-green-100 text-green-700' :
                                            loan.status === 'Partial' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                        {loan.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    function renderComplianceTab() {
        if (complianceReports.length === 0) return renderEmpty('No Compliance Data', 'Institutional score propagation for group matrix.');
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Governance Export Dashboard</p>
                    <button
                        onClick={() => api.downloadComplianceReportPDF(`${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`, selectedGroup || 'all')}
                        className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-900/10"
                    >
                        <FaFilePdf size={12} />
                        Generate Governance PDF
                    </button>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-5 text-[10px] font-black uppercase text-gray-500 tracking-widest">Institutional Entity</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase text-gray-500 tracking-widest">Target</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase text-gray-500 tracking-widest">Contribution</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase text-gray-500 tracking-widest">Status</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase text-gray-500 tracking-widest">Loan Exposure</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase text-gray-500 tracking-widest text-center">Matrix Risk</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {complianceReports.map(m => (
                                <tr key={m.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-400 group-hover:bg-green-100 group-hover:text-green-600 transition-colors">
                                                {m.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 leading-tight">{m.name}</p>
                                                <p className="text-[9px] text-gray-400 font-medium mb-1">{m.groupName}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-xs font-bold text-gray-400">KES {m.expectedAmount.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-xs font-black text-gray-800">KES {m.contributionAmount.toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${m.contributionStatus === 'Paid' ? 'bg-green-50 text-green-600 border-green-100' :
                                                m.contributionStatus === 'Partial' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                                                    'bg-red-50 text-red-600 border-red-100'
                                            }`}>
                                            {m.contributionStatus}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-xs font-black text-gray-900">KES {Number(m.activeLoanBalance || 0).toLocaleString()}</p>
                                        {m.guaranteedExposure > 0 && <p className="text-[9px] text-red-500 font-bold">Guarantor for KES {m.guaranteedExposure.toLocaleString()}</p>}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {getRiskBadge(m.aging?.riskLevel)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    function renderEmpty(title, desc) {
        return (
            <div className="bg-white p-24 rounded-2xl border-2 border-dashed border-gray-200 text-center">
                <div className="text-gray-300 mb-6 inline-block p-8 bg-gray-50 rounded-full"><FaChartLine size={60} /></div>
                <h3 className="text-2xl font-black text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 max-w-sm mx-auto font-medium">{desc}</p>
            </div>
        );
    }

    function renderDrillDown() {
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100">
                    <div className="p-10 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="p-2 bg-safaricom-green/10 text-safaricom-green rounded-lg"><FaLock size={16} /></span>
                                <h2 className="text-3xl font-black text-gray-900 tracking-tight">Financial Forensic Drill Down</h2>
                            </div>
                            <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] ml-11">{drillDown.group_name} • {months[drillDown.month - 1]} {drillDown.year}</p>
                        </div>
                        <button onClick={() => setDrillDown(null)} className="h-10 w-10 hover:bg-white hover:shadow-md rounded-full transition-all text-gray-400 flex items-center justify-center font-bold border border-transparent hover:border-gray-100">✕</button>
                    </div>

                    <div className="p-10 overflow-y-auto scrollbar-hide">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                            {[
                                { label: 'Monthly Opening', val: drillDown.opening_balance, bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-100', sub: 'text-blue-400' },
                                { label: 'Total Inflows', val: drillDown.total_cash_in, bg: 'bg-green-50', text: 'text-green-900', border: 'border-green-100', sub: 'text-green-400' },
                                { label: 'Total Outflows', val: drillDown.total_cash_out, bg: 'bg-red-50', text: 'text-red-900', border: 'border-red-100', sub: 'text-red-400' },
                                { label: 'Institutional Closing', val: drillDown.closing_balance, bg: 'bg-gray-900', text: 'text-white', border: 'border-gray-800', sub: 'text-gray-400' }
                            ].map((card, idx) => (
                                <div key={idx} className={`${card.bg} p-6 rounded-3xl border ${card.border} text-center shadow-sm`}>
                                    <p className={`text-[10px] font-black uppercase ${card.sub} mb-2`}>{card.label}</p>
                                    <p className={`text-xl font-black ${card.text}`}>KES {Number(card.val).toLocaleString()}</p>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-between items-end mb-6 px-2">
                            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Session Verification Ledger</h3>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-500/50"></div> <span className="text-[10px] font-bold text-gray-400 tracking-wider">LOCKED</span></div>
                            </div>
                        </div>

                        <div className="bg-white border border-gray-100 rounded-[2rem] overflow-hidden shadow-xl shadow-gray-200/50">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-100">
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-500">Meeting Date</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Physical Count</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Variance</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-500 text-center">Handover Audit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {drillDown.daily_sessions?.map(session => (
                                        <tr key={session.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-8 py-5 whitespace-nowrap font-black text-gray-900">
                                                {new Date(session.meeting_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="px-8 py-5 text-right font-black text-gray-900 text-lg">KES {Number(session.physical_cash_count).toLocaleString()}</td>
                                            <td className={`px-8 py-5 text-right font-black ${session.variance === 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {session.variance > 0 ? '+' : ''}{Number(session.variance).toLocaleString()}
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-50 text-green-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-100 shadow-sm">
                                                    <FaCheckCircle />
                                                    VERIFIED
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="p-10 bg-gray-50/50 border-t border-gray-100 flex justify-end gap-4">
                        <button
                            onClick={() => setDrillDown(null)}
                            className="px-10 py-4 rounded-2xl bg-gray-900 hover:bg-black text-white font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-black/10"
                        >
                            Close Forensic Intelligence
                        </button>
                    </div>
                </div>
            </div>
        );
    }
};

export default MonthlyReports;
