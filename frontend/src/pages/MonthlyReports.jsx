import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { FaFileInvoice, FaArrowRight, FaLock, FaCalendarAlt, FaFilter, FaSearch } from 'react-icons/fa';
import SearchableGroupSelector from '../components/SearchableGroupSelector';

const MonthlyReports = () => {
    const { user, isAuditor } = useAuth();
    const [groups, setGroups] = useState([]);
    const [reports, setReports] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(false);
    const [drillDown, setDrillDown] = useState(null);

    useEffect(() => {
        loadGroups();
        fetchReports();
    }, []);

    const loadGroups = async () => {
        const data = await api.getGroups();
        setGroups(data || []);
    };

    const fetchReports = async () => {
        setLoading(true);
        try {
            const filters = {};
            if (selectedGroup) filters.groupId = selectedGroup;
            if (selectedMonth) filters.month = selectedMonth;
            if (selectedYear) filters.year = selectedYear;

            const data = await api.getMonthlyReports(filters);
            setReports(data || []);
        } catch (err) {
            console.error("Report Fetch Error:", err);
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
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                            <FaFileInvoice className="text-safaricom-green" />
                            Monthly Institutional Reports
                        </h1>
                        <p className="text-gray-500 font-medium mt-1">Aggregated Read-Only Intelligence for Governance & Audit</p>
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
                            className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                        >
                            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                    </div>
                    <div className="w-32">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Year</label>
                        <select
                            className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                        >
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <button
                        onClick={fetchReports}
                        className="bg-safaricom-green hover:bg-green-700 text-white px-8 py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-green-900/10 flex items-center gap-2"
                    >
                        <FaSearch size={14} />
                        Fetch Intelligent Data
                    </button>
                </div>

                {/* REPORTS GRID */}
                {loading ? (
                    <div className="p-20 text-center animate-pulse text-gray-400 font-bold uppercase tracking-widest">
                        Aggregating Institutional Data...
                    </div>
                ) : reports.length === 0 ? (
                    <div className="bg-white p-20 rounded-2xl border-2 border-dashed border-gray-200 text-center">
                        <div className="text-gray-300 mb-4 inline-block p-6 bg-gray-50 rounded-full"><FaCalendarAlt size={48} /></div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No Reports Generated Yet</h3>
                        <p className="text-gray-500 max-w-md mx-auto">Monthly reports are automatically generated once the first Daily Cash Session for a group is LOCKED for the month.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {reports.map((report) => (
                            <div key={report.id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4">
                                    <FaLock className="text-gray-100 group-hover:text-green-50" size={40} />
                                </div>
                                <div className="mb-6">
                                    <h3 className="text-xl font-black text-gray-900 mb-1">{report.group_name}</h3>
                                    <p className="text-sm font-bold text-safaricom-green uppercase tracking-widest">{months[report.month - 1]} {report.year}</p>
                                </div>

                                <div className="space-y-4 mb-8">
                                    <div className="flex justify-between items-end border-b border-gray-50 pb-2">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Opening Pool</span>
                                        <span className="font-black text-gray-900">KES {Number(report.opening_balance).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-end border-b border-gray-50 pb-2">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Cash In</span>
                                        <span className="font-black text-green-600">+KES {Number(report.total_cash_in).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-end border-b border-gray-50 pb-2">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Cash Out</span>
                                        <span className="font-black text-red-600">-KES {Number(report.total_cash_out).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-end pt-2">
                                        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Institutional Closing</span>
                                        <span className="text-lg font-black text-blue-900 underline decoration-blue-200 decoration-4">KES {Number(report.closing_balance).toLocaleString()}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleDrillDown(report)}
                                    className="w-full py-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold transition-all flex items-center justify-center gap-2 text-sm border border-transparent hover:border-gray-200"
                                >
                                    Drill Down to Ledger
                                    <FaArrowRight size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* DRILL DOWN MODAL */}
            {drillDown && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-8 border-b border-gray-100 flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900">Institutional Drill Down</h2>
                                <p className="text-gray-500 font-medium uppercase tracking-widest text-[10px] mt-1">{drillDown.group_name} • {months[drillDown.month - 1]} {drillDown.year}</p>
                            </div>
                            <button onClick={() => setDrillDown(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">✕</button>
                        </div>

                        <div className="p-8 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-center">
                                    <p className="text-[10px] font-black uppercase text-blue-400 mb-1">Monthly Opening</p>
                                    <p className="text-lg font-black text-blue-900">KES {Number(drillDown.opening_balance).toLocaleString()}</p>
                                </div>
                                <div className="bg-green-50 p-4 rounded-2xl border border-green-100 text-center">
                                    <p className="text-[10px] font-black uppercase text-green-400 mb-1">Session Inflows</p>
                                    <p className="text-lg font-black text-green-900">KES {Number(drillDown.total_cash_in).toLocaleString()}</p>
                                </div>
                                <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-center">
                                    <p className="text-[10px] font-black uppercase text-red-400 mb-1">Session Outflows</p>
                                    <p className="text-lg font-black text-red-900">KES {Number(drillDown.total_cash_out).toLocaleString()}</p>
                                </div>
                                <div className="bg-gray-900 p-4 rounded-2xl text-center">
                                    <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Institutional Closing</p>
                                    <p className="text-lg font-black text-white">KES {Number(drillDown.closing_balance).toLocaleString()}</p>
                                </div>
                            </div>

                            <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-4 px-2">Daily Verification Audit Trail</h3>
                            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Meeting Date</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Opening</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Physical Count</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Variance</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {drillDown.daily_sessions?.map(session => (
                                            <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">
                                                    {new Date(session.meeting_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                </td>
                                                <td className="px-6 py-4 text-right text-gray-500">KES {Number(session.opening_balance).toLocaleString()}</td>
                                                <td className="px-6 py-4 text-right font-black text-gray-900">KES {Number(session.physical_cash_count).toLocaleString()}</td>
                                                <td className={`px-6 py-4 text-right font-bold ${session.variance === 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {session.variance > 0 ? '+' : ''}{Number(session.variance).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                                                        {session.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => setDrillDown(null)}
                                className="px-8 py-3 rounded-xl bg-gray-900 text-white font-bold transition-all shadow-lg shadow-black/10"
                            >
                                Close Intelligence View
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};

export default MonthlyReports;
