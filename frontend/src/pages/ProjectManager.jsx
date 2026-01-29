import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import {
    FaGraduationCap,
    FaLeaf,
    FaCalendarCheck,
    FaLock,
    FaChartLine,
    FaHistory,
    FaCalculator,
    FaArrowRight,
    FaInfoCircle,
    FaSearch,
    FaRocket,
    FaRegClock,
    FaCoins,
    FaShieldAlt,
    FaUserCircle,
    FaLightbulb,
    FaLayerGroup,
    FaPrint,
    FaFileExport,
    FaFileExcel,
    FaFilePdf
} from 'react-icons/fa';
import ExcelService from '../services/excelService';
import PdfService from '../services/pdfService';
import { Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale);

const ProjectManager = () => {
    const [members, setMembers] = useState([]);
    const [selectedMember, setSelectedMember] = useState(null);
    const [memberStatus, setMemberStatus] = useState([]);
    const [dailyLimit, setDailyLimit] = useState({ daily_limit: 0, already_saved: 0, remaining_limit: 0 });
    const [loading, setLoading] = useState(false);
    const [groups, setGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState('');
    const [groupMatrix, setGroupMatrix] = useState([]);
    const [groupStats, setGroupStats] = useState({
        pools: [],
        total_project_pool: 0,
        total_table_savings: 0,
        total_active_loans: 0,
        payout_obligation: 0,
        available_cash: 0,
        liquidity_alert: 'SAFE',
        participation_rate: 0,
        loan_utilization: 0,
        agriculture_pool: 0
    });

    const formatKES = (val) => (val || 0).toLocaleString();

    const [activeTab, setActiveTab] = useState('save');
    const [searchTerm, setSearchTerm] = useState('');
    const [savingAmount, setSavingAmount] = useState('');
    const [regProject, setRegProject] = useState('EDUCATION');
    const [matrixSearch, setMatrixSearch] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
    const [simAmount, setSimAmount] = useState(0);

    const calculateHealthScore = (member) => {
        if (!member) return 0;
        const savings = member.current_savings || member.savings || 0;
        const loans = member.active_loan_balance || member.loans || 0;
        const savingsFactor = Math.min(100, (savings / 20000) * 100); // Target 20k for 100%
        const loanFactor = Math.max(0, 100 - (loans / Math.max(1, savings)) * 100);
        return Math.round((savingsFactor * 0.4) + (loanFactor * 0.6));
    };

    const downloadMatrixCSV = () => {
        const headers = ["Member Name", "Member ID", "Normal Savings", "Education Saved", "Agriculture Saved", "Jan Obligation"];
        const rows = groupMatrix.map(m => [
            m.name,
            m.id,
            m.normal_savings || 0,
            m.edu_saved || 0,
            m.agri_saved || 0,
            ((m.edu_saved || 0) + (m.agri_saved || 0)) * 1.5
        ]);
        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `Project_Matrix_${selectedGroup}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const sortedMatrix = useMemo(() => {
        let items = [...groupMatrix].filter(m =>
            m.name.toLowerCase().includes(matrixSearch.toLowerCase())
        );
        if (sortConfig.key) {
            items.sort((a, b) => {
                let aVal = a[sortConfig.key] || 0;
                let bVal = b[sortConfig.key] || 0;
                if (sortConfig.key === 'jan_obligation') {
                    aVal = ((a.edu_saved || 0) + (a.agri_saved || 0)) * 1.5;
                    bVal = ((b.edu_saved || 0) + (b.agri_saved || 0)) * 1.5;
                }
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return items;
    }, [groupMatrix, sortConfig]);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    useEffect(() => { fetchGroups(); }, []);
    useEffect(() => {
        if (selectedGroup) {
            fetchMembers(selectedGroup);
            fetchGroupStats(selectedGroup);
            fetchGroupMatrix(selectedGroup);
        }
    }, [selectedGroup]);
    useEffect(() => {
        if (selectedMember) {
            fetchMemberStatus(selectedMember.id);
            fetchDayLimit(selectedMember.id);
        }
    }, [selectedMember]);

    const fetchGroups = async () => { setGroups(await api.getGroups()); };
    const fetchMembers = async (groupId) => {
        setLoading(true);
        setMembers(await api.getMembersByGroup(groupId));
        setLoading(false);
    };
    const fetchGroupStats = async (groupId) => { setGroupStats(await api.getProjectGroupStats(groupId)); };
    const fetchMemberStatus = async (memberId) => { setMemberStatus(await api.getProjectMemberStatus(memberId)); };
    const fetchDayLimit = async (memberId) => { setDailyLimit(await api.getProjectMemberDayLimit(memberId)); };
    const fetchGroupMatrix = async (groupId) => { setGroupMatrix(await api.getProjectGroupMatrix(groupId)); };

    // EXCEL EXPORT HANDLER
    const handleExportExcel = () => {
        if (!groupMatrix || groupMatrix.length === 0) return toast.info("No data to export");

        const exportData = groupMatrix.map(m => ({
            name: m.name,
            phone: m.phone || '-',
            edu_saved: m.edu_saved || 0,
            agri_saved: m.agri_saved || 0,
            total_saved: (m.edu_saved || 0) + (m.agri_saved || 0),
            payout_eligibility: ((m.edu_saved || 0) + (m.agri_saved || 0)) * 1.5,
            health_score: calculateHealthScore(m) + '%',
            status: ((m.edu_saved || 0) + (m.agri_saved || 0)) >= 2000 ? 'MAX CAP' : 'ACTIVE'
        }));

        const columns = [
            { header: 'Member Name', key: 'name' },
            { header: 'Phone', key: 'phone' },
            { header: 'Education Pool (KES)', key: 'edu_saved', formatter: (val) => val.toLocaleString() },
            { header: 'Agriculture Pool (KES)', key: 'agri_saved', formatter: (val) => val.toLocaleString() },
            { header: 'Total Invested', key: 'total_saved', formatter: (val) => val.toLocaleString() },
            { header: 'Jan Payout (150%)', key: 'payout_eligibility', formatter: (val) => val.toLocaleString() },
            { header: 'Health Score', key: 'health_score' },
            { header: 'Account Status', key: 'status' }
        ];

        const groupName = groups.find(g => g.id == selectedGroup)?.group_name || 'All Groups';
        ExcelService.exportToExcel(
            exportData,
            columns,
            `Project Matrix - ${groupName}`,
            `ProjectMatrix_${groupName.replace(/\s+/g, '_')}`,
            { "Group": groupName, "Total Members": exportData.length }
        );
        toast.success("Excel Matrix Downloaded Successfully");
    };

    // PDF EXPORT HANDLER
    const handleExportPDF = () => {
        if (!groupMatrix || groupMatrix.length === 0) return toast.info("No data to export");
        const groupName = groups.find(g => g.id == selectedGroup)?.group_name || 'All Groups';
        PdfService.generateProjectMatrix(groupMatrix, groupName);
        toast.success("PDF Matrix Downloaded");
    };

    const handleRegister = async () => {
        if (!selectedMember) return toast.error('Select member');
        setLoading(true);
        try {
            const res = await api.registerProject(selectedMember.id, regProject, selectedGroup);
            if (res?.success) {
                toast.success(res.message);
                fetchMemberStatus(selectedMember.id);
                fetchGroupStats(selectedGroup);
            }
        } catch (err) { }
        setLoading(false);
    };

    const handleSave = async (regId) => {
        const amt = parseFloat(savingAmount);
        if (!amt || amt <= 0) return toast.error('Invalid amount');
        const proj = memberStatus.find(s => s.registration_id === regId);
        if (proj && (proj.total_saved + amt) > 2000) return toast.error('KES 2000 Limit Exceeded');
        if (amt > dailyLimit.remaining_limit) return toast.error('Exceeds daily slot');
        setLoading(true);
        try {
            const res = await api.postProjectSaving(regId, amt, new Date().toISOString(), selectedGroup);
            if (res?.success) {
                toast.success('Posted!');
                setSavingAmount('');
                fetchMemberStatus(selectedMember.id);
                fetchGroupStats(selectedGroup);
                fetchDayLimit(selectedMember.id);
            }
        } catch (err) { }
        setLoading(false);
    };

    const filteredMembers = useMemo(() =>
        members.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [members, searchTerm]
    );

    const isRegWindow = (new Date().getMonth() + 1) <= 3;
    const isSaveWindow = (new Date().getMonth() + 1) <= 8;

    // Chart Options
    const getChartData = (current) => ({
        datasets: [{
            data: [current, Math.max(0, 2000 - current)],
            backgroundColor: ['#28a745', '#e9ecef'],
            borderWidth: 0,
            circumference: 180,
            rotation: 270,
        }]
    });

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-4 lg:p-10 font-['Inter']">
            <div className="max-w-[1600px] mx-auto">

                {/* EXECUTIVE HEADER STRIP */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-12">
                    <div className="group">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-1 bg-safaricom-green rounded-full group-hover:w-20 transition-all duration-500"></div>
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">Financial Control Room</span>
                        </div>
                        <h1 className="text-4xl lg:text-6xl font-black tracking-tight text-gray-900 leading-tight">
                            Project <span className="text-safaricom-green">Intelligence</span>
                        </h1>
                        <p className="text-gray-500 mt-3 font-medium text-lg">Real-time rotating capital & liquidity utilization dashboard.</p>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 w-full lg:w-auto">
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-gray-100/50 border border-gray-100 hover:scale-105 transition-transform">
                            <div className="text-[10px] uppercase font-black text-gray-400 mb-2">Total Pool</div>
                            <div className="text-xl font-black text-gray-900 truncate">KES {formatKES(groupStats?.total_project_pool) || '0'}</div>
                        </div>
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-gray-100/50 border border-gray-100 hover:scale-105 transition-transform">
                            <div className="text-[10px] uppercase font-black text-blue-500 mb-2">Education</div>
                            <div className="text-xl font-black text-blue-600 truncate">KES {formatKES(groupStats?.education_pool) || '0'}</div>
                        </div>
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-gray-100/50 border border-gray-100 hover:scale-105 transition-transform">
                            <div className="text-[10px] uppercase font-black text-emerald-500 mb-2">Agriculture</div>
                            <div className="text-xl font-black text-emerald-600 truncate">KES {formatKES(groupStats.agriculture_pool) || '0'}</div>
                        </div>
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-gray-100/50 border border-gray-100 hover:scale-105 transition-transform">
                            <div className="text-[10px] uppercase font-black text-indigo-500 mb-2">Jan Obligation</div>
                            <div className="text-xl font-black text-indigo-600 truncate">KES {formatKES(groupStats?.payout_obligation) || '0'}</div>
                        </div>
                        <div className={`p-6 rounded-[2rem] shadow-xl shadow-gray-100/50 border border-gray-100 hover:scale-105 transition-transform ${groupStats?.liquidity_alert === 'SAFE' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                            <div className="text-[10px] uppercase font-black text-gray-400 mb-2">Liquidity</div>
                            <div className={`text-xl font-black ${groupStats?.liquidity_alert === 'SAFE' ? 'text-emerald-600' : 'text-red-600 animate-pulse'}`}>
                                {groupStats?.liquidity_alert || 'FETCHING'}
                            </div>
                        </div>
                        <div className="bg-gray-900 p-6 rounded-[2rem] shadow-2xl shadow-gray-400 border border-gray-800">
                            <div className="text-[10px] uppercase font-black text-gray-400 mb-2">Utilization</div>
                            <div className="text-xl font-black text-safaricom-green">{Math.round(groupStats?.loan_utilization || 0)}%</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-10">
                    {/* TABLE POOL UTILIZATION */}
                    <div className="bg-white rounded-[3rem] p-10 shadow-2xl shadow-gray-200/50 border border-white">
                        <div className="flex justify-between items-start mb-10">
                            <div>
                                <h3 className="text-2xl font-black text-gray-900 mb-2">Fund Allocation</h3>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Capital Deployment</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-2xl">
                                <FaChartLine className="text-safaricom-green text-xl" />
                            </div>
                        </div>

                        <div className="flex items-center gap-10">
                            <div className="w-48 h-48 relative">
                                <Doughnut
                                    data={{
                                        labels: ['Normal Sav', 'Project Sav'],
                                        datasets: [{
                                            data: [groupStats?.total_table_savings || 0, groupStats?.total_project_pool || 0],
                                            backgroundColor: ['#10B981', '#F59E0B'],
                                            borderWidth: 0,
                                            hoverOffset: 10
                                        }]
                                    }}
                                    options={{ cutout: '75%', plugins: { legend: { display: false } } }}
                                />
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <div className="text-xs font-black text-gray-400 uppercase">Total</div>
                                    <div className="text-xl font-black text-gray-900 leading-none">{formatKES((groupStats?.total_table_savings || 0) + (groupStats?.total_project_pool || 0))}</div>
                                </div>
                            </div>
                            <div className="flex-1 space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_#10B981]"></div>
                                    <div className="flex-1">
                                        <div className="text-[10px] font-black uppercase text-gray-400">Normal Savings</div>
                                        <div className="text-lg font-black text-gray-900">KES {formatKES(groupStats?.total_table_savings)}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_#F59E0B]"></div>
                                    <div className="flex-1">
                                        <div className="text-[10px] font-black uppercase text-gray-400">Project Pool</div>
                                        <div className="text-lg font-black text-gray-900">KES {formatKES(groupStats?.total_project_pool)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* LIQUIDITY RUNWAY CHART */}
                    <div className="bg-gray-900 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-safaricom-green/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-safaricom-green/10 transition-colors"></div>
                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-2xl font-black text-white mb-1">Liquidity Runway</h3>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cash Flow Forecast</p>
                                </div>
                                <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${groupStats?.liquidity_alert === 'SAFE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400 animate-pulse'}`}>
                                    {groupStats?.liquidity_alert} Status
                                </div>
                            </div>

                            <div className="flex-1 min-h-[150px]">
                                <Line
                                    data={{
                                        labels: ['May', 'Jun', 'Jul', 'Aug'],
                                        datasets: [{
                                            label: 'Liquid Cash',
                                            data: [Math.max(0, groupStats?.available_cash || 0) * 0.8, Math.max(0, groupStats?.available_cash || 0) * 0.9, Math.max(0, groupStats?.available_cash || 0), Math.max(0, groupStats?.available_cash || 0) * 1.1],
                                            borderColor: '#10B981',
                                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                            fill: true,
                                            tension: 0.4,
                                            pointRadius: 4,
                                            pointBackgroundColor: '#10B981'
                                        }, {
                                            label: 'Obligation',
                                            data: [groupStats?.payout_obligation || 0, groupStats?.payout_obligation || 0, groupStats?.payout_obligation || 0, groupStats?.payout_obligation || 0],
                                            borderColor: 'rgba(255, 255, 255, 0.2)',
                                            borderDash: [5, 5],
                                            pointRadius: 0
                                        }]
                                    }}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: { legend: { display: false } },
                                        scales: {
                                            x: {
                                                grid: { display: false },
                                                ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 10, weight: 'bold' } }
                                            },
                                            y: { display: false }
                                        }
                                    }}
                                />
                            </div>
                            <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Target Coverage: 100%</span>
                                <span className={`text-sm font-black ${(groupStats?.available_cash || 0) >= (groupStats?.payout_obligation || 0) ? 'text-safaricom-green' : 'text-red-500'}`}>
                                    {groupStats?.payout_obligation > 0 ? Math.round((groupStats?.available_cash / groupStats?.payout_obligation) * 100) : 100}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SMART ANALYTICS SELECTOR */}
                <div className="bg-white/90 backdrop-blur-xl p-3 rounded-[3rem] shadow-2xl shadow-gray-200/50 border border-white mb-10">
                    <div className="flex flex-col lg:flex-row items-center">
                        <div className="w-full lg:w-1/3 p-4 lg:border-r border-gray-100">
                            <div className="flex items-center gap-4 bg-gray-50 rounded-[2rem] px-6 py-3 border border-gray-100 focus-within:ring-4 focus-within:ring-safaricom-green/10 transition-all">
                                <FaLayerGroup className="text-safaricom-green text-xl" />
                                <select
                                    value={selectedGroup}
                                    onChange={(e) => {
                                        setSelectedGroup(e.target.value);
                                        setSelectedMember(null);
                                    }}
                                    className="w-full bg-transparent border-0 focus:ring-0 font-black text-lg text-gray-800 cursor-pointer"
                                >
                                    <option value="">Choose Active Group...</option>
                                    {groups.map(g => (
                                        <option key={g.id} value={g.id}>{g.group_name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="hidden lg:flex flex-1 p-4 px-10 items-center justify-between">
                            <div className="text-center">
                                <div className="text-[10px] font-black uppercase text-gray-400 mb-1">Participation</div>
                                <div className="text-gray-900 font-bold">{Math.round(groupStats?.participation_rate || 0)}% Members</div>
                            </div>
                            <div className="h-10 w-px bg-gray-100"></div>
                            <div className="text-center">
                                <div className="text-[10px] font-black uppercase text-gray-400 mb-1">Table Cash</div>
                                <div className="text-gray-900 font-bold">KES {formatKES(groupStats?.total_table_savings) || '0'}</div>
                            </div>
                            <div className="h-10 w-px bg-gray-100"></div>
                            <div className="text-center">
                                <div className="text-[10px] font-black uppercase text-gray-400 mb-1">Active Exposure</div>
                                <div className="text-red-500 font-bold">KES {formatKES(groupStats?.total_active_loans) || '0'}</div>
                            </div>
                            <div className="h-10 w-px bg-gray-100"></div>
                            <div className="flex gap-2">
                                <div className={`w-3 h-3 rounded-full ${isRegWindow ? 'bg-safaricom-green shadow-[0_0_10px_#28A745]' : 'bg-gray-200'}`} title="Registration Window"></div>
                                <div className={`w-3 h-3 rounded-full ${isSaveWindow && !isRegWindow ? 'bg-blue-500 shadow-[0_0_10px_#3B82F6]' : 'bg-gray-200'}`} title="Saving Window"></div>
                                <div className={`w-3 h-3 rounded-full ${!isSaveWindow ? 'bg-red-500 shadow-[0_0_10px_#EF4444]' : 'bg-gray-200'}`} title="Locked / Payout"></div>
                            </div>

                            <div className="h-10 w-px bg-gray-100 mx-4"></div>

                            <button
                                onClick={handleExportExcel}
                                disabled={!selectedGroup}
                                className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl font-bold hover:bg-emerald-100 hover:scale-105 active:scale-95 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FaFileExcel className="text-lg" />
                                <span>Export Excel</span>
                            </button>
                            <button
                                onClick={handleExportPDF}
                                disabled={!selectedGroup}
                                className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-xl font-bold hover:bg-red-100 hover:scale-105 active:scale-95 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FaFilePdf className="text-lg" />
                                <span>Export PDF</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">

                    {/* MEMBER DISCOVERY SIDEBAR */}
                    <div className="lg:col-span-3 lg:sticky lg:top-10 bg-white rounded-[3rem] shadow-2xl shadow-gray-200/50 border border-white overflow-hidden">
                        <div className="p-8 border-b border-gray-50 bg-gray-50/30">
                            <div className="relative group">
                                <FaSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-safaricom-green transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search member..."
                                    className="w-full bg-white border border-gray-100 rounded-2xl pl-12 pr-4 py-4 font-bold text-sm text-gray-800 placeholder:text-gray-300 focus:ring-4 focus:ring-safaricom-green/5 focus:border-safaricom-green transition-all shadow-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="max-h-[70vh] overflow-y-auto px-4 py-6 space-y-3 custom-scrollbar">
                            {filteredMembers.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setSelectedMember(m)}
                                    className={`w-full flex items-center gap-5 p-5 rounded-[2rem] transition-all duration-300 group ${selectedMember?.id === m.id ? 'bg-safaricom-green text-white shadow-xl shadow-green-100' : 'hover:bg-gray-50 text-gray-700'}`}
                                >
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner transition-transform group-hover:scale-110 ${selectedMember?.id === m.id ? 'bg-white/20' : 'bg-gray-100 text-gray-400 group-hover:bg-white'}`}>
                                        {m.name.charAt(0)}
                                    </div>
                                    <div className="text-left flex-1 min-w-0">
                                        <div className="font-extrabold truncate text-sm uppercase tracking-tight leading-tight">{m.name}</div>
                                        <div className={`text-[10px] font-black mt-1 ${selectedMember?.id === m.id ? 'text-green-50' : 'text-gray-400'}`}>SAVINGS: KES {formatKES(m.current_savings || m.savings || 0)}</div>
                                    </div>
                                </button>
                            ))}
                            {loading && <div className="text-center py-10 animate-pulse text-gray-300 font-bold uppercase tracking-widest text-[10px]">Accessing Core Ledger...</div>}
                            {!loading && filteredMembers.length === 0 && (
                                <div className="text-center py-20 px-4">
                                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <FaSearch className="text-gray-200 text-3xl" />
                                    </div>
                                    <p className="text-xs font-black text-gray-300 uppercase tracking-[0.2em]">No Matches Identified</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* FINANCIAL INTELLIGENCE DASHBOARD */}
                    <div className="lg:col-span-9 space-y-10">
                        {selectedMember ? (
                            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
                                {/* MEMBER PROFILE SNAPSHOT */}
                                <div className="bg-white rounded-[3rem] p-10 shadow-2xl shadow-gray-200/50 border border-white relative overflow-hidden">
                                    <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-10">
                                        <div className="flex items-center gap-10">
                                            <div className="relative">
                                                <div className="w-28 h-28 lg:w-32 lg:h-32 rounded-[2.5rem] bg-gray-900 flex items-center justify-center text-4xl font-black text-safaricom-green shadow-2xl relative">
                                                    {selectedMember.name.charAt(0)}
                                                    <div className="absolute -bottom-2 -right-2 bg-safaricom-green p-2 rounded-xl shadow-lg border-4 border-white">
                                                        <FaShieldAlt className="text-white text-xs" />
                                                    </div>
                                                </div>
                                                {/* Health Score Ring */}
                                                <div className="absolute -inset-2 border-2 border-dashed border-safaricom-green/20 rounded-[3rem] animate-[spin_20s_linear_infinite]"></div>
                                            </div>
                                            <div>
                                                <h2 className="text-3xl lg:text-4xl font-black uppercase tracking-tighter text-gray-900 mb-2">{selectedMember.name}</h2>
                                                <div className="flex gap-4 items-center">
                                                    <div className="flex items-center gap-2">
                                                        <span className="bg-gray-100 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-gray-400">ID: {selectedMember.id}</span>
                                                        <span className="bg-safaricom-green/10 text-safaricom-green px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Active Partner</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 border-l border-gray-100 pl-4">
                                                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Health</div>
                                                        <div className={`text-sm font-black ${calculateHealthScore(selectedMember) > 70 ? 'text-safaricom-green' : 'text-amber-500'}`}>
                                                            {calculateHealthScore(selectedMember)}%
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-10 lg:pl-10 lg:border-l border-gray-100">
                                            <div>
                                                <div className="text-[10px] font-black uppercase text-gray-400 mb-2">Total Savings</div>
                                                <div className="text-3xl font-black text-gray-900">KES {formatKES(selectedMember.current_savings || selectedMember.savings || 0)}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] font-black uppercase text-gray-400 mb-2">Active Loans</div>
                                                <div className="text-3xl font-black text-red-500">KES {formatKES(selectedMember.active_loan_balance || selectedMember.loans || 0)}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    {/* RELATIONSHIP HEALTH */}
                                    <div className="bg-white rounded-[3rem] p-10 shadow-2xl shadow-gray-200/50 border border-white">
                                        <div className="flex justify-between items-start mb-8">
                                            <div>
                                                <h3 className="text-2xl font-black text-gray-900 mb-1">Partner Vitality</h3>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Savings to Loan Integrity Ratio</p>
                                            </div>
                                            <div className="p-4 bg-gray-50 rounded-2xl">
                                                <FaShieldAlt className="text-emerald-500 text-xl" />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-10">
                                            <div className="w-32 h-32 relative">
                                                <div className="absolute inset-0 border-8 border-gray-50 rounded-full"></div>
                                                <div
                                                    className="absolute inset-0 border-8 border-safaricom-green rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all duration-1000"
                                                    style={{ clipPath: `inset(${100 - calculateHealthScore(selectedMember)}% 0 0 0)` }}
                                                ></div>
                                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                    <div className="text-2xl font-black text-gray-900">{calculateHealthScore(selectedMember)}%</div>
                                                </div>
                                            </div>
                                            <div className="space-y-4 flex-1">
                                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                                    <div className="text-[10px] font-black text-gray-400 uppercase mb-1">Risk Profile</div>
                                                    <div className="font-black text-gray-900 text-sm">{calculateHealthScore(selectedMember) > 80 ? 'EXCELLENT' : calculateHealthScore(selectedMember) > 50 ? 'AVERAGE' : 'STRESSED'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* WHAT-IF PAYOUT SIMULATOR */}
                                    <div className="bg-indigo-900 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
                                        <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mb-32 blur-3xl group-hover:bg-white/10 transition-colors"></div>
                                        <div className="relative z-10 space-y-8">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="text-2xl font-black text-white mb-1">Growth Simulator</h3>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Predictive ROI Engine</p>
                                                </div>
                                                <div className="p-4 bg-white/10 rounded-2xl">
                                                    <FaRocket className="text-indigo-400 text-xl" />
                                                </div>
                                            </div>

                                            <div className="space-y-8">
                                                <div>
                                                    <div className="flex justify-between mb-4">
                                                        <span className="text-[10px] font-black uppercase text-indigo-400">Simulate Extra Savings</span>
                                                        <span className="text-sm font-black text-white">KES {formatKES(simAmount)}</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="4000"
                                                        step="100"
                                                        value={simAmount}
                                                        onChange={(e) => setSimAmount(parseInt(e.target.value))}
                                                        className="w-full h-2 bg-indigo-700 rounded-lg appearance-none cursor-pointer accent-safaricom-green"
                                                    />
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                                                    <div>
                                                        <div className="text-[10px] font-black uppercase text-indigo-400 mb-1">Projected Total</div>
                                                        <div className="text-2xl font-black text-white">
                                                            KES {formatKES((memberStatus.reduce((acc, s) => acc + (s.total_saved || 0), 0) + simAmount) * 1.5)}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-[10px] font-black uppercase text-indigo-400 mb-1">Net Growth</div>
                                                        <div className="text-2xl font-black text-safaricom-green">
                                                            +KES {formatKES(simAmount * 0.5)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* PROJECT PERFORMANCE MATRIX */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    {[
                                        { type: 'EDUCATION', icon: <FaGraduationCap />, color: 'blue' },
                                        { type: 'AGRICULTURE', icon: <FaLeaf />, color: 'emerald' }
                                    ].map(p => {
                                        const status = memberStatus.find(s => s.project_type === p.type);
                                        return (
                                            <div key={p.type} className="group bg-white rounded-[3rem] p-8 shadow-xl hover:shadow-2xl transition-all border border-gray-100 relative overflow-hidden">
                                                <div className={`absolute top-0 right-0 w-32 h-32 bg-${p.color}-50 rounded-bl-[5rem] -mr-10 -mt-10 transition-transform group-hover:scale-110`}></div>

                                                <div className="relative flex justify-between items-start mb-10">
                                                    <div className={`p-5 bg-${p.color}-50 text-${p.color}-600 rounded-2xl shadow-sm`}>
                                                        {p.icon}
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-[10px] uppercase font-black text-gray-300 tracking-widest">{p.type} PROJECT</div>
                                                        <div className={`text-[10px] font-black mt-1 px-3 py-1 rounded-full bg-${p.color}-100 text-${p.color}-700 inline-block`}>ROI 150%</div>
                                                    </div>
                                                </div>

                                                {status ? (
                                                    <div className="relative space-y-8">
                                                        <div className="flex justify-between items-end">
                                                            <div>
                                                                <div className="text-[10px] font-black text-gray-400 mb-1">Principal Saved</div>
                                                                <div className="text-3xl font-black text-gray-900">KES {formatKES(status.total_saved || 0)}</div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-[10px] font-black text-gray-400 mb-1">Jan Liquidity</div>
                                                                <div className={`text-xl font-black text-${p.color}-600`}>KES {formatKES(status.projected_payout || 0)}</div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div className="flex justify-between text-[9px] font-black uppercase mb-2">
                                                                <span className="text-gray-300">Target: KES 2,000</span>
                                                                <span className="text-gray-900">{Math.round((status.total_saved / 2000) * 100)}% Complete</span>
                                                            </div>
                                                            <div className="h-3 bg-gray-50 rounded-full overflow-hidden border border-gray-100 p-0.5">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-1000 shadow-lg ${p.type === 'EDUCATION' ? 'bg-gradient-to-r from-blue-500 to-indigo-600 shadow-blue-200' : 'bg-gradient-to-r from-emerald-500 to-safaricom-green shadow-emerald-200'}`}
                                                                    style={{ width: `${(status.total_saved / 2000) * 100}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="py-12 flex flex-col items-center justify-center bg-gray-50/50 rounded-[2rem] border-2 border-dashed border-gray-100">
                                                        <FaRegClock className="text-gray-200 text-3xl mb-4" />
                                                        <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Awaiting Registration</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* ACTION TABS */}
                                <div className="space-y-6">
                                    <div className="flex gap-4 p-2 bg-white rounded-full shadow-lg border border-gray-50 w-fit">
                                        <button
                                            onClick={() => setActiveTab('save')}
                                            className={`px-10 py-3 rounded-full text-sm font-black uppercase tracking-widest transition-all ${activeTab === 'save' ? 'bg-safaricom-green text-white shadow-lg' : 'text-gray-400 hover:text-gray-700'}`}
                                        >
                                            <FaCoins className="inline mr-2" /> Post Savings
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('register')}
                                            className={`px-10 py-3 rounded-full text-sm font-black uppercase tracking-widest transition-all ${activeTab === 'register' ? 'bg-safaricom-green text-white shadow-lg' : 'text-gray-400 hover:text-gray-700'}`}
                                        >
                                            <FaCalendarCheck className="inline mr-2" /> Registration
                                        </button>
                                    </div>

                                    {/* POST SAVINGS PANEL */}
                                    {activeTab === 'save' && (
                                        <div className="bg-white rounded-[3rem] p-10 shadow-2xl border border-gray-100">
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                                <div className="space-y-8">
                                                    <div>
                                                        <h3 className="text-2xl font-black text-gray-900 mb-1">Deposit Funds</h3>
                                                        <p className="text-gray-400 text-sm font-medium leading-relaxed">System enforced rules state that project savings cannot exceed the total normal savings for the same day (Today).</p>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
                                                            <div className="text-[10px] uppercase font-bold text-gray-400 mb-1 text-center">Today's Table Sav</div>
                                                            <div className="text-2xl font-black text-gray-900 text-center">KES {formatKES(dailyLimit.daily_limit || 0)}</div>
                                                        </div>
                                                        <div className="bg-safaricom-green/5 p-6 rounded-[2rem] border border-safaricom-green/10">
                                                            <div className="text-[10px] uppercase font-bold text-safaricom-green mb-1 text-center">Remaining Slot</div>
                                                            <div className="text-2xl font-black text-safaricom-green text-center">KES {formatKES(dailyLimit.remaining_limit || 0)}</div>
                                                        </div>
                                                    </div>

                                                    {dailyLimit.remaining_limit === 0 && (
                                                        <div className="flex items-start gap-4 p-5 bg-red-50 rounded-3xl border border-red-100 text-red-600">
                                                            <FaLock className="text-xl mt-1 shrink-0" />
                                                            <div className="text-xs font-bold leading-tight">
                                                                Slot Closed! You MUST post normal table savings for <strong>Today</strong> first to unlock this member's project saving capacity.
                                                            </div>
                                                        </div>
                                                    )}

                                                    {isSaveWindow ? (
                                                        <div className="space-y-4">
                                                            {memberStatus.length === 0 ? (
                                                                <div className="text-center py-10 opacity-40">
                                                                    <FaLock className="mx-auto text-4xl mb-4" />
                                                                    <p className="font-bold uppercase tracking-widest text-xs italic">No Active Projects</p>
                                                                </div>
                                                            ) : (
                                                                memberStatus.map(reg => (
                                                                    <div key={reg.registration_id} className="group flex flex-col sm:flex-row items-center justify-between p-4 bg-gray-50/50 rounded-3xl border border-gray-100 hover:bg-white hover:shadow-xl transition-all gap-4">
                                                                        <div className="flex items-center gap-4">
                                                                            <div className={`p-3 rounded-2xl ${reg.project_type === 'EDUCATION' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                                                                                {reg.project_type === 'EDUCATION' ? <FaGraduationCap /> : <FaLeaf />}
                                                                            </div>
                                                                            <span className="font-black text-xs uppercase tracking-tighter">{reg.project_type}</span>
                                                                        </div>
                                                                        <div className="flex-1 flex gap-2 w-full sm:w-auto">
                                                                            <input
                                                                                type="number"
                                                                                placeholder="Amount"
                                                                                className="flex-1 min-w-[120px] bg-white border-0 ring-1 ring-gray-100 focus:ring-2 focus:ring-safaricom-green rounded-2xl px-5 py-3 font-bold text-gray-900"
                                                                                value={savingAmount}
                                                                                onChange={(e) => setSavingAmount(e.target.value)}
                                                                            />
                                                                            <button
                                                                                disabled={loading || dailyLimit.remaining_limit <= 0 || reg.total_saved >= 2000}
                                                                                onClick={() => handleSave(reg.registration_id)}
                                                                                className="bg-safaricom-green hover:bg-green-700 text-white font-black px-8 py-3 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-30 disabled:grayscale uppercase text-[10px] tracking-widest"
                                                                            >
                                                                                Post
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="py-12 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-200 text-center">
                                                            <FaRegClock className="mx-auto text-gray-300 text-4xl mb-4" />
                                                            <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">Window Closed (Sep-Dec Locked)</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* SMART INSIGHTS SIDEBAR */}
                                                <div className="bg-gray-50 rounded-[2.5rem] p-10 space-y-8">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <FaLightbulb className="text-amber-500 text-xl" />
                                                        <h4 className="text-lg font-black text-gray-900 underline decoration-safaricom-green decoration-4 underline-offset-4">Smart Recommendations</h4>
                                                    </div>

                                                    <div className="space-y-6">
                                                        <div className="flex gap-4">
                                                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-safaricom-green shadow-sm shrink-0 font-black text-sm">1</div>
                                                            <div>
                                                                <p className="text-xs font-bold text-gray-900 mb-1">Max Savings Strategy</p>
                                                                <p className="text-[10px] text-gray-400 font-medium italic">Save KES 2,000 to maximize your projected Jan profit share (KES 3,000).</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-4">
                                                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-blue-600 shadow-sm shrink-0 font-black text-sm">2</div>
                                                            <div>
                                                                <p className="text-xs font-bold text-gray-900 mb-1">Timing Intelligence</p>
                                                                <p className="text-[10px] text-gray-400 font-medium italic">Complete your savings before August 31st to avoid the September lock phase.</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-4">
                                                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-emerald-600 shadow-sm shrink-0 font-black text-sm">3</div>
                                                            <div>
                                                                <p className="text-xs font-bold text-gray-900 mb-1">Dividend Power</p>
                                                                <p className="text-[10px] text-gray-400 font-medium italic">Your current projected ROI is KES {formatKES(memberStatus.reduce((acc, s) => acc + (s.projected_payout || 0), 0) - memberStatus.reduce((acc, s) => acc + (s.total_saved || 0), 0))}.</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="pt-8 border-t border-gray-200">
                                                        <div className="bg-white p-6 rounded-3xl flex items-center justify-between shadow-sm">
                                                            <div className="flex items-center gap-4">
                                                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                                                                    <FaRocket className="text-xl animate-bounce" />
                                                                </div>
                                                                <div>
                                                                    <div className="text-[10px] font-black uppercase text-gray-300">Phase Status</div>
                                                                    <div className="text-xs font-black text-gray-900">Active Growth Mode</div>
                                                                </div>
                                                            </div>
                                                            <div className="h-2 w-20 bg-gray-100 rounded-full overflow-hidden">
                                                                <div className="h-full bg-safaricom-green w-[80%]"></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* REGISTRATION PANEL */}
                                    {activeTab === 'register' && (
                                        <div className="bg-white rounded-[3rem] p-10 shadow-2xl border border-gray-100">
                                            <div className="max-w-xl mx-auto space-y-10 text-center">
                                                <div>
                                                    <div className="w-24 h-24 bg-amber-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6">
                                                        <FaShieldAlt className="text-amber-500 text-4xl" />
                                                    </div>
                                                    <h3 className="text-3xl font-black text-gray-900 mb-2 tracking-tight uppercase">Expansion Request</h3>
                                                    <p className="text-gray-400 text-sm font-medium">Official registration for Rotating Project Pools.</p>
                                                    <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                                        <p className="text-[10px] font-black text-amber-700 uppercase leading-relaxed">
                                                            <FaInfoCircle className="inline mr-1" /> Strategic Notice: A one-time management fee of <strong>KES 200</strong> is required per pool. This fee is non-refundable and is recorded as Company Income & Table Cash Out.
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="p-8 border-4 border-dashed border-gray-50 rounded-[3rem] space-y-8">
                                                    <div className="flex flex-col gap-4">
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setRegProject('EDUCATION')}
                                                                className={`flex-1 p-6 rounded-[2rem] border-2 transition-all ${regProject === 'EDUCATION' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-50 text-gray-400 hover:border-gray-200'}`}
                                                            >
                                                                <FaGraduationCap className="text-3xl mx-auto mb-3" />
                                                                <span className="font-black uppercase tracking-tighter text-[10px]">Education</span>
                                                            </button>
                                                            <button
                                                                onClick={() => setRegProject('AGRICULTURE')}
                                                                className={`flex-1 p-6 rounded-[2rem] border-2 transition-all ${regProject === 'AGRICULTURE' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-50 text-gray-400 hover:border-gray-200'}`}
                                                            >
                                                                <FaLeaf className="text-3xl mx-auto mb-3" />
                                                                <span className="font-black uppercase tracking-tighter text-[10px]">Agriculture</span>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {isRegWindow ? (
                                                        <button
                                                            disabled={loading}
                                                            onClick={handleRegister}
                                                            className="w-full bg-gray-900 hover:bg-[#1a1a1a] text-white py-6 rounded-full font-black uppercase tracking-[0.2em] shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-4 text-sm"
                                                        >
                                                            Execute Registration <FaArrowRight />
                                                        </button>
                                                    ) : (
                                                        <div className="bg-red-50 p-6 rounded-[2rem] border border-red-100">
                                                            <div className="flex items-center justify-center gap-3 text-red-600 font-black uppercase text-[10px]">
                                                                <FaLock /> Registration Window Terminated
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <p className="text-[10px] text-gray-300 italic font-bold uppercase tracking-widest">Digital Audit Trail Protected by Ukombozi Engine</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : selectedGroup ? (
                            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
                                {/* ADMINISTRATIVE CONTROL CENTER & MEMBER PROJECT MATRIX */}
                                <div className="bg-white rounded-[3rem] p-10 shadow-2xl shadow-gray-200/50 border border-white">
                                    <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-10 mb-10">
                                        <div className="flex-1">
                                            <h3 className="text-2xl font-black text-gray-900 mb-1">Control Center</h3>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Governance & Payout Management</p>
                                            <div className="mt-4 relative max-w-xs">
                                                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 text-xs" />
                                                <input
                                                    type="text"
                                                    placeholder="Quick filter matrix..."
                                                    className="w-full bg-gray-50 border-0 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-gray-800 focus:ring-2 focus:ring-safaricom-green/20"
                                                    value={matrixSearch}
                                                    onChange={(e) => setMatrixSearch(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-4">
                                            <button
                                                onClick={downloadMatrixCSV}
                                                className="flex items-center gap-3 px-8 py-3 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em] hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100"
                                            >
                                                <FaFileExport /> Export CSV
                                            </button>
                                            <button
                                                disabled={new Date().getMonth() !== 11} // Only in December
                                                className="flex items-center gap-3 px-8 py-3 bg-gray-900 text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black transition-all shadow-xl shadow-gray-200 disabled:opacity-20"
                                            >
                                                <FaLock /> Lock Projects
                                            </button>
                                            <button
                                                disabled={new Date().getMonth() !== 0} // Only in January
                                                onClick={() => toast.info("January Engine: Payout sequence will be available in January.")}
                                                className="flex items-center gap-3 px-8 py-3 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-20"
                                            >
                                                <FaRocket /> Run January Payout
                                            </button>
                                            <button
                                                onClick={() => window.print()}
                                                className="flex items-center gap-3 px-8 py-3 bg-white border border-gray-100 text-gray-900 rounded-full text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-50 transition-all shadow-sm"
                                            >
                                                <FaPrint /> Print Reports
                                            </button>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto -mx-10 px-10">
                                        <table className="w-full text-left border-separate border-spacing-y-4">
                                            <thead>
                                                <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                                    <th className="px-6 py-4 cursor-pointer hover:text-gray-900" onClick={() => requestSort('name')}>
                                                        Partner {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                                    </th>
                                                    <th className="px-6 py-4 cursor-pointer hover:text-gray-900" onClick={() => requestSort('edu_saved')}>
                                                        Education {sortConfig.key === 'edu_saved' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                                    </th>
                                                    <th className="px-6 py-4 cursor-pointer hover:text-gray-900" onClick={() => requestSort('agri_saved')}>
                                                        Agriculture {sortConfig.key === 'agri_saved' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                                    </th>
                                                    <th className="px-6 py-4 cursor-pointer hover:text-gray-900" onClick={() => requestSort('jan_obligation')}>
                                                        Jan Obligation {sortConfig.key === 'jan_obligation' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                                    </th>
                                                    <th className="px-6 py-4">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sortedMatrix.map((m, idx) => (
                                                    <tr key={m.id} className={`group ${m.edu_saved + m.agri_saved >= 4000 ? 'bg-emerald-50/30' : 'bg-gray-50/50'} hover:bg-white transition-all rounded-[2rem] shadow-sm hover:shadow-xl hover:shadow-gray-200/50`}>
                                                        <td className="px-6 py-5 rounded-l-[2rem]">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center text-white font-black text-xs">
                                                                    {m.name.charAt(0)}
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="font-black text-sm text-gray-900 uppercase tracking-tight">{m.name}</div>
                                                                        {(m.normal_savings > 1000 && (m.edu_saved + m.agri_saved) === 0) && (
                                                                            <FaLightbulb
                                                                                className="text-amber-400 text-xs cursor-help animate-pulse"
                                                                                title="HIGH POTENTIAL: High savings capacity detected. Recommend project entry to maximize dividends."
                                                                            />
                                                                        )}
                                                                    </div>
                                                                    <div className="text-[9px] font-bold text-gray-400">SAVINGS: KES {formatKES(m.normal_savings || 0)}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-5">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-2 h-2 rounded-full ${m.edu_saved > 0 ? 'bg-blue-500 animate-pulse' : 'bg-gray-200'}`}></div>
                                                                <span className={`font-black text-xs ${m.edu_saved > 0 ? 'text-gray-900' : 'text-gray-300 italic'}`}>
                                                                    {m.edu_saved > 0 ? `KES ${formatKES(m.edu_saved || 0)}` : 'Idle'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-5">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-2 h-2 rounded-full ${m.agri_saved > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-gray-200'}`}></div>
                                                                <span className={`font-black text-xs ${m.agri_saved > 0 ? 'text-gray-900' : 'text-gray-300 italic'}`}>
                                                                    {m.agri_saved > 0 ? `KES ${formatKES(m.agri_saved || 0)}` : 'Idle'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-5">
                                                            <div className="font-black text-sm text-indigo-600">
                                                                KES {formatKES(((m.edu_saved || 0) + (m.agri_saved || 0)) * 1.5)}
                                                            </div>
                                                            {m.edu_saved + m.agri_saved >= 4000 && (
                                                                <div className="text-[8px] font-black text-emerald-500 uppercase mt-1">CAP MAXIMIZED</div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-5 rounded-r-[2rem]">
                                                            <button
                                                                onClick={() => setSelectedMember(m)}
                                                                className={`p-3 rounded-xl transition-all shadow-sm border ${((m.edu_saved || 0) + (m.agri_saved || 0)) >= 2000
                                                                    ? 'bg-safaricom-green/10 border-safaricom-green text-safaricom-green'
                                                                    : ((m.edu_saved || 0) + (m.agri_saved || 0)) > 0
                                                                        ? 'bg-blue-50 border-blue-200 text-blue-500'
                                                                        : 'bg-white border-gray-100 text-gray-300'
                                                                    } hover:scale-110 active:scale-95`}
                                                            >
                                                                <FaChartLine />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-40 select-none animate-in fade-in zoom-in-95 duration-700">
                                <div className="w-64 h-64 bg-white rounded-full flex items-center justify-center mb-10 shadow-2xl shadow-gray-200 border border-gray-50 relative group">
                                    <div className="absolute inset-0 bg-safaricom-green/5 rounded-full scale-110 blur-3xl group-hover:bg-safaricom-green/10 transition-colors"></div>
                                    <FaUserCircle className="text-gray-100 text-[10rem] relative z-10" />
                                </div>
                                <h3 className="text-3xl font-black text-gray-300 uppercase tracking-[0.3em] mb-4">Initialize Profile</h3>
                                <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest max-w-md text-center leading-loose border-t border-gray-100 pt-6">
                                    Select a member to view live project pools, loan exposure, and January payout readiness.
                                </p>
                            </div>
                        )}
                    </div>
                </div >
            </div >

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e9ecef; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #ced4da; }
            `}} />
        </div >
    );
};

export default ProjectManager;

