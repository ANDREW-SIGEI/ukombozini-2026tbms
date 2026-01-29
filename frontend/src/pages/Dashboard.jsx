import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { toast } from 'react-toastify';

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    PointElement,
    LineElement,
} from 'chart.js';
import { Bar, Pie, Doughnut, Line } from 'react-chartjs-2';
import { useNavigate, Link } from 'react-router-dom';
import {
    FaMoneyBillWave, FaUsers, FaChartLine, FaPiggyBank,
    FaTriangleExclamation, FaGift, FaRightLeft, FaArrowUp, FaArrowDown,
    FaClockRotateLeft, FaCalendarDays, FaHandHoldingDollar, FaHandshake,
    FaArrowRight
} from 'react-icons/fa6';

// Register ChartJS
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
);

const Dashboard = () => {
    const [highPotentialCount, setHighPotentialCount] = useState(0);
    const [isAuditorMode, setIsAuditorMode] = useState(false);
    const [auditDate, setAuditDate] = useState(new Date().toISOString().split('T')[0]);
    const [snapshot, setSnapshot] = useState(null);
    const [groupRisks, setGroupRisks] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [systemSettings, setSystemSettings] = useState([]);
    const [isSystemFrozen, setIsSystemFrozen] = useState(false);
    const [realStats, setRealStats] = useState(null);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            try {
                // Fetch Groups and their Risks
                const groups = await api.getGroups();
                const riskPromises = groups.map(g => api.getRiskScore('GROUP', g.id));
                const risks = await Promise.all(riskPromises);
                setGroupRisks(groups.map((g, i) => ({ ...g, risk: risks[i] })));

                const members = await api.getMembers();
                const hp = members.filter(m => (m.current_savings > 2000) && (!m.project_savings_total || m.project_savings_total === 0)).length;
                setHighPotentialCount(hp);

                // Check System Freeze
                const settings = await api.getSystemSettings();
                setSystemSettings(settings);
                const freezeSetting = settings.find(s => s.key === 'system_freeze');
                setIsSystemFrozen(freezeSetting?.value === 'true');

                // Fetch Real Dashboard Stats
                const ds = await api.getDashboardStats();
                if (ds) setRealStats(ds);
            } catch (err) {
                console.error("Dashboard Intelligence failed", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchDashboardData();
    }, []);

    const handleEnterAuditorMode = async () => {
        if (!auditDate) return;
        setIsLoading(true);
        try {
            const data = await api.getAuditSnapshot(auditDate);
            setSnapshot(data);
            setIsAuditorMode(true);
            toast.success(`Entered Auditor Mode: Snapshot for ${auditDate}`);
        } catch (err) {
            console.error("Snapshot failed", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleExitAuditorMode = () => {
        setIsAuditorMode(false);
        setSnapshot(null);
        toast.info("Exited Auditor Mode");
    };

    // 1. Cash In / Out (Monthly) - Bar/Line Chart
    const cashFlowData = {
        labels: realStats?.cashFlowData?.map(d => d.month) || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
            {
                label: 'Cash In',
                data: realStats?.cashFlowData?.map(d => d.cash_in) || [120000, 190000, 150000, 250000, 220000, 300000],
                backgroundColor: 'rgba(0, 133, 36, 0.7)', // Safaricom Dark Green
                borderColor: '#008524',
                borderWidth: 1,
            },
            {
                label: 'Cash Out',
                data: realStats?.cashFlowData?.map(d => d.cash_out) || [100000, 150000, 120000, 200000, 180000, 250000],
                backgroundColor: 'rgba(239, 68, 68, 0.7)', // Red
                borderColor: '#ef4444',
                borderWidth: 1,
            },
        ],
    };

    // 2. Loan Status - Pie Chart
    const loanStatusData = {
        labels: realStats?.loanStatusData?.map(d => d.status) || ['Active', 'Pending', 'Fully Paid'],
        datasets: [{
            data: realStats?.loanStatusData?.map(d => d.count) || [45, 12, 85],
            backgroundColor: [
                '#EAB308', // Yellow (Active)
                '#EF4444', // Red (Pending/Defaulted)
                '#008524', // Safaricom Green (Paid/Completed)
                '#3B82F6', // Blue (Others)
            ],
            hoverOffset: 4
        }]
    };

    // 3. Contribution Breakdown - Bar Chart
    const contributionData = {
        labels: realStats?.contributionBreakdown?.map(d => d.group_name) || ['Group A', 'Group B', 'Womens Group'],
        datasets: [{
            label: 'Total Contributions (KES)',
            data: realStats?.contributionBreakdown?.map(d => d.total) || [450000, 320000, 580000],
            backgroundColor: 'rgba(59, 130, 246, 0.7)', // Blue
        }]
    };

    // 4. Dividends Paid vs Pending - Doughnut Chart
    const dividendData = {
        labels: ['Distributed', 'Available'],
        datasets: [{
            data: [realStats?.totalDividends || 0, 350000], // available is hypothetical
            backgroundColor: [
                '#8B5CF6', // Purple (Paid)
                '#C084FC', // Light Purple (Pending)
            ],
        }]
    };

    // 5. Liquidity Matrix (NEW)
    const liquidityMatrixData = {
        labels: ['Group Contributions', 'Company Top-Up'],
        datasets: [{
            data: [
                realStats?.liquidityMatrix?.groupCapital || 1,
                realStats?.liquidityMatrix?.companyTopUp || 0
            ],
            backgroundColor: ['#008524', '#3B82F6'],
            borderWidth: 0,
        }]
    };

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom' },
        }
    };

    // Mock data for alerts - In production, fetch from API
    const negativeBalanceReports = [
        { officer: 'Hilda Sigei', group: 'Victory Women Group', balance: -19460, date: '2026-01-15' },
    ];

    const pendingApprovals = 3;
    const todayMeetings = 24;
    const dailyTransactions = 156;

    // Stats Cards Data
    const stats = [
        { title: 'Total Members', value: realStats?.totalMembers || '0', icon: <FaUsers />, color: 'bg-green-500', trend: 'Active portfolio', link: '/members' },
        { title: 'Active Loans', value: realStats?.activeLoans || '0', icon: <FaMoneyBillWave />, color: 'bg-yellow-500', trend: 'Issued capital', link: '/loans' },
        { title: 'Total Contributions', value: `KES ${(realStats?.totalContributions || 0).toLocaleString()}`, icon: <FaPiggyBank />, color: 'bg-blue-500', trend: 'Member savings', link: '/contributions' },
        { title: 'Pending Repayments', value: realStats?.pendingRepayments || '0', icon: <FaTriangleExclamation />, color: 'bg-red-500', trend: 'Overdue loans', link: '/loans' },
        { title: 'Total Dividends', value: `KES ${(realStats?.totalDividends || 0).toLocaleString()}`, icon: <FaGift />, color: 'bg-purple-500', trend: 'Distributed profit', link: '/dividends' },
        { title: 'Cash In / Out', value: `KES ${(realStats?.netCashFlow || 0).toLocaleString()}`, icon: <FaRightLeft />, color: 'bg-emerald-600', trend: 'Net cash flow', link: '/reconciliation' },
    ];

    return (
        <div className="p-4 md:p-8 space-y-8 bg-gray-50 min-h-screen">
            {/* Phase 3: SYSTEM LOCKDOWN BANNER */}
            {isSystemFrozen && (
                <div className="bg-red-600 text-white p-4 rounded-xl shadow-lg flex items-center gap-4 animate-pulse">
                    <FaTriangleExclamation className="text-3xl" />
                    <div>
                        <h2 className="font-bold text-lg">SYSTEM LOCKDOWN ACTIVE</h2>
                        <p className="text-sm opacity-90">All financial transactions are suspended by the Director. Emergency protocols ONLY.</p>
                    </div>
                </div>
            )}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 tracking-tight">DASHBOARD OVERVIEW</h2>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Real-time Financial Intelligence</p>
                </div>
                <div className="flex items-center gap-4">
                    {!isAuditorMode ? (
                        <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
                            <FaCalendarDays className="text-gray-400 ml-2" />
                            <input
                                type="date"
                                value={auditDate}
                                onChange={(e) => setAuditDate(e.target.value)}
                                className="bg-transparent text-xs font-bold text-gray-700 outline-none"
                            />
                            <button
                                onClick={handleEnterAuditorMode}
                                className="bg-gray-800 text-white px-3 py-1.5 rounded-md text-[10px] font-black uppercase hover:bg-black transition-colors"
                            >
                                <FaClockRotateLeft className="inline mr-1" /> Auditor Mode
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4">
                            <div className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-3 animate-pulse">
                                <FaTriangleExclamation />
                                <span className="text-xs font-black uppercase">Auditor Mode Active: {auditDate}</span>
                            </div>
                            <button
                                onClick={handleExitAuditorMode}
                                className="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-black uppercase hover:bg-red-700 transition-colors"
                            >
                                Exit
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {isAuditorMode && (
                <div className="bg-purple-50 border-2 border-purple-200 p-6 rounded-2xl shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <FaClockRotateLeft size={100} />
                    </div>
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div>
                            <p className="text-[10px] font-black text-purple-800 uppercase tracking-widest mb-1">Snapshot Savings</p>
                            <p className="text-3xl font-black text-purple-900">KES {snapshot?.total_savings?.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-purple-800 uppercase tracking-widest mb-1">Snapshot Active Loans</p>
                            <p className="text-3xl font-black text-purple-900">KES {snapshot?.total_loans?.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-purple-800 uppercase tracking-widest mb-1">Audited Members</p>
                            <p className="text-3xl font-black text-purple-900">{snapshot?.member_details?.length || 0}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Critical Alerts Banner */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {negativeBalanceReports.length > 0 && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg h-full">
                        <div className="flex items-start gap-3">
                            <FaTriangleExclamation className="text-red-600 text-xl mt-1" />
                            <div className="flex-1">
                                <h3 className="font-bold text-red-900 mb-2 uppercase text-xs tracking-wider">⚠️ Negative Balance Alerts</h3>
                                <div className="space-y-2">
                                    {negativeBalanceReports.map((report, idx) => (
                                        <div key={idx} className="bg-white/80 backdrop-blur-sm p-3 rounded border border-red-100 flex justify-between items-center shadow-sm">
                                            <div>
                                                <p className="font-bold text-gray-800 text-sm">{report.group}</p>
                                                <p className="text-[10px] text-gray-500">{report.officer}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-red-600">KES {Math.abs(report.balance).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Fraud & Risk Heatmap */}
                <div className="bg-gray-900 border-l-4 border-red-500 p-4 rounded-lg h-full text-white">
                    <div className="flex items-start gap-3">
                        <FaChartLine className="text-red-500 text-xl mt-1" />
                        <div className="flex-1">
                            <h3 className="font-bold text-white mb-2 uppercase text-xs tracking-wider">🔥 FRAUD & RISK HEATMAP</h3>
                            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                                {groupRisks.map((g, idx) => {
                                    const score = g.risk?.score || 100;
                                    const color = score < 40 ? 'bg-red-500' : score < 70 ? 'bg-orange-500' : 'bg-green-500';
                                    const textColor = score < 40 ? 'text-red-400' : score < 70 ? 'text-orange-400' : 'text-green-400';

                                    return (
                                        <div key={idx} className="bg-white/5 p-3 rounded border border-white/10 flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-sm">{g.group_name}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                        <div className={`${color} h-full`} style={{ width: `${score}%` }}></div>
                                                    </div>
                                                    <span className={`text-[10px] font-black uppercase ${textColor}`}>Score: {score}/100</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <Link to={`/groups/${g.id}`} className="text-[9px] font-bold text-blue-400 hover:underline">AUDIT GROUP</Link>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 font-bold uppercase">Today's Meetings</p>
                            <p className="text-2xl font-bold text-gray-800 mt-1">{todayMeetings}</p>
                        </div>
                        <div className="p-3 bg-blue-100 rounded-lg">
                            <FaCalendarDays className="text-blue-600" />
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 font-bold uppercase">Daily Transactions</p>
                            <p className="text-2xl font-bold text-gray-800 mt-1">{dailyTransactions}</p>
                        </div>
                        <div className="p-3 bg-green-100 rounded-lg">
                            <FaRightLeft className="text-green-600" />
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 font-bold uppercase">Pending Approvals</p>
                            <p className="text-2xl font-bold text-yellow-600 mt-1">{pendingApprovals}</p>
                        </div>
                        <div className="p-3 bg-yellow-100 rounded-lg">
                            <FaTriangleExclamation className="text-yellow-600" />
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 font-bold uppercase">Field Officers Active</p>
                            <p className="text-2xl font-bold text-gray-800 mt-1">8/12</p>
                        </div>
                        <div className="p-3 bg-purple-100 rounded-lg">
                            <FaUsers className="text-purple-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {stats.map((stat, index) => (
                    <Link to={stat.link} key={index} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 transition-all hover:scale-105 hover:shadow-md cursor-pointer group">
                        <div className="flex justify-between items-start mb-2">
                            <div className={`p-2 rounded-lg text-white ${stat.color} transition-transform group-hover:rotate-6`}>
                                {stat.icon}
                            </div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{stat.title}</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-800">{stat.value}</h3>
                            <p className="text-[10px] text-gray-500 mt-1">{stat.trend}</p>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Main Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Cash Flow Chart */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Cash In / Out (Monthly)</h3>
                    <div className="h-64">
                        <Bar options={commonOptions} data={cashFlowData} />
                    </div>
                </div>

                {/* 2. Loan Status Chart */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Loan Distribution</h3>
                    <div className="h-64">
                        <Pie options={commonOptions} data={loanStatusData} />
                    </div>
                </div>

                {/* 3. Contribution Breakdown */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Contributions by Group</h3>
                    <div className="h-64">
                        <Bar
                            options={{ ...commonOptions, indexAxis: 'y' }}
                            data={contributionData}
                        />
                    </div>
                </div>

                {/* 4. Liquidity Matrix (NEW) */}
                <div className="bg-gray-900 rounded-xl shadow-lg p-6 text-white border-b-4 border-safaricom-green">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-bold">Liquidity Matrix</h3>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Group vs Company Capital</p>
                        </div>
                        <FaHandshake className="text-2xl text-safaricom-green" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="h-48">
                            <Doughnut
                                options={{
                                    ...commonOptions,
                                    cutout: '70%',
                                    plugins: { legend: { display: false } }
                                }}
                                data={liquidityMatrixData}
                            />
                        </div>
                        <div className="flex flex-col justify-center gap-4">
                            <div className="border-l-2 border-safaricom-green pl-3">
                                <p className="text-[10px] text-gray-400 font-black uppercase">Group Capital</p>
                                <p className="text-xl font-black">KES {(realStats?.liquidityMatrix?.groupCapital || 0).toLocaleString()}</p>
                            </div>
                            <div className="border-l-2 border-blue-500 pl-3">
                                <p className="text-[10px] text-gray-400 font-black uppercase">Company Top-Up</p>
                                <p className="text-xl font-black">KES {(realStats?.liquidityMatrix?.companyTopUp || 0).toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Daily Report Compliance Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center">
                            <FaClockRotateLeft className="mr-2 text-safaricom-green" />
                            Daily Report Status (Today)
                        </h3>
                        <span className="px-2 py-1 bg-red-100 text-red-600 text-[10px] font-bold rounded-lg uppercase">3 Reports Pending</span>
                    </div>
                    <div className="space-y-4">
                        {[
                            { officer: 'David Omari', group: 'Group A', status: 'Unsubmitted', color: 'text-red-600', bg: 'bg-red-50' },
                            { officer: 'Sarah Wanjiku', group: 'Group B', status: 'Unbalanced (- KES 500)', color: 'text-orange-600', bg: 'bg-orange-50' },
                            { officer: 'Mary Atieno', group: 'Group D', status: 'Unsubmitted', color: 'text-red-600', bg: 'bg-red-50' },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-gray-50 bg-gray-50/30">
                                <div className="flex items-center">
                                    <div className="w-10 h-10 rounded-full bg-gray-200 mr-3 flex items-center justify-center font-bold text-gray-500">
                                        {item.officer.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-800">{item.officer}</p>
                                        <p className="text-[10px] text-gray-500 uppercase">{item.group}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`text-[10px] font-bold ${item.color} ${item.bg} px-2 py-1 rounded-md`}>
                                        {item.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* System Parameters (Mini Card) */}
                <div className="bg-safaricom-green rounded-2xl shadow-xl shadow-green-900/20 p-6 text-white relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="text-lg font-bold mb-4">System Health</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-2 border-b border-white/10">
                                <span className="text-xs text-green-100">API Status</span>
                                <span className="text-xs font-bold text-green-400">ONLINE</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-white/10">
                                <span className="text-xs text-green-100">Last Sync</span>
                                <span className="text-xs font-bold text-green-200">2 min ago</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-xs text-green-100">Backup</span>
                                <span className="text-xs font-bold text-green-200">COMPLETED</span>
                            </div>
                        </div>
                        <Link to="/daily-reports" className="mt-8 block w-full bg-white/20 hover:bg-white/30 text-center py-3 rounded-xl text-xs font-bold transition-colors">
                            VIEW ALL DAILY REPORTS
                        </Link>
                    </div>
                    {/* Decorative element */}
                    <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                </div>
            </div>

            {/* UKOMBOZI PARTNERSHIP MANAGER BUTTON (CRITCAL) */}
            <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 rounded-xl shadow-lg p-1 mb-6 transform hover:scale-[1.01] transition-transform">
                <Link to="/partnership-manager" className="block bg-white/10 hover:bg-white/20 rounded-lg p-6 flex justify-between items-center group">
                    <div className="flex items-center gap-4">
                        <div className="bg-yellow-400 text-blue-900 p-4 rounded-full shadow-lg shadow-yellow-400/20 group-hover:rotate-12 transition-transform">
                            <FaHandshake size={32} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-white tracking-tight">UKOMBOZI LOAN & TOP-UP MANAGER</h3>
                            <p className="text-blue-200 font-medium">Manage Capital Injections, Commitment Deposits & Product Financing</p>
                        </div>
                    </div>
                    <div className="bg-white text-blue-900 px-6 py-3 rounded-full font-bold shadow-md flex items-center gap-2 group-hover:bg-yellow-400 transition-colors">
                        OPEN MANAGER <FaArrowRight />
                    </div>
                </Link>
            </div>

            {/* PROJECT SAVINGS & TABLE POOL MANAGER (NEW) */}
            <div className="bg-gradient-to-r from-green-900 via-green-800 to-green-900 rounded-xl shadow-lg p-1 mb-6 transform hover:scale-[1.01] transition-transform relative overflow-hidden">
                <Link to="/project-manager" className="block bg-white/10 hover:bg-white/20 rounded-lg p-6 flex justify-between items-center group">
                    <div className="flex items-center gap-4">
                        <div className="bg-safaricom-green text-white p-4 rounded-full shadow-lg shadow-green-400/20 group-hover:rotate-12 transition-transform">
                            <FaPiggyBank size={32} />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h3 className="text-2xl font-black text-white tracking-tight">PROJECT SAVINGS & TABLE POOL</h3>
                                {highPotentialCount > 0 && (
                                    <span className="bg-amber-400 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                                        {highPotentialCount} OPPORTUNITIES
                                    </span>
                                )}
                            </div>
                            <p className="text-green-200 font-medium">Rotating Project Pools (Education & Agriculture) with 150% Jan Payout</p>
                        </div>
                    </div>
                    <div className="bg-white text-green-900 px-6 py-3 rounded-full font-bold shadow-md flex items-center gap-2 group-hover:bg-safaricom-green group-hover:text-white transition-colors">
                        MANAGE POOLS <FaArrowRight />
                    </div>
                </Link>
            </div>

            {/* Quick Actions Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-800">Quick Actions & Shortcuts</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Link to="/members" className="p-4 rounded-lg bg-green-50 border border-green-100 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-green-100 transition-colors">
                        <div className="text-green-600 mb-2"><FaUsers size={24} /></div>
                        <span className="text-sm font-bold text-green-800">Add New Member</span>
                    </Link>
                    <Link to="/contributions" className="p-4 rounded-lg bg-blue-50 border border-blue-100 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-blue-100 transition-colors">
                        <div className="text-blue-600 mb-2"><FaPiggyBank size={24} /></div>
                        <span className="text-sm font-bold text-blue-800">Add Contribution</span>
                    </Link>
                    <Link to="/loans" className="p-4 rounded-lg bg-yellow-50 border border-yellow-100 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-yellow-100 transition-colors">
                        <div className="text-yellow-600 mb-2"><FaHandHoldingDollar size={24} /></div>
                        <span className="text-sm font-bold text-yellow-800">Approve Loan</span>
                    </Link>
                    <Link to="/daily-meeting-report" className="p-4 rounded-lg bg-purple-50 border border-purple-100 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-purple-100 transition-colors">
                        <div className="text-purple-600 mb-2"><FaChartLine size={24} /></div>
                        <span className="text-sm font-bold text-purple-800">Meeting Minutes</span>
                    </Link>
                    <Link to="/daily-cash-report" className="p-4 rounded-lg bg-emerald-50 border border-emerald-100 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-emerald-100 transition-colors">
                        <div className="text-emerald-600 mb-2"><FaMoneyBillWave size={24} /></div>
                        <span className="text-sm font-bold text-emerald-800">Officer Cash Report</span>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
