import React from 'react';
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
    FaExclamationTriangle, FaGift, FaExchangeAlt, FaArrowUp, FaArrowDown,
    FaHistory
} from 'react-icons/fa';

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
    // 1. Cash In / Out (Monthly) - Bar/Line Chart
    const cashFlowData = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
            {
                label: 'Cash In',
                data: [120000, 190000, 150000, 250000, 220000, 300000],
                backgroundColor: 'rgba(0, 133, 36, 0.7)', // Safaricom Dark Green
                borderColor: '#008524',
                borderWidth: 1,
            },
            {
                label: 'Cash Out',
                data: [100000, 150000, 120000, 200000, 180000, 250000],
                backgroundColor: 'rgba(239, 68, 68, 0.7)', // Red
                borderColor: '#ef4444',
                borderWidth: 1,
            },
        ],
    };

    // 2. Loan Status - Pie Chart
    const loanStatusData = {
        labels: ['Active', 'Pending', 'Fully Paid'],
        datasets: [{
            data: [45, 12, 85],
            backgroundColor: [
                '#EAB308', // Yellow (Active)
                '#EF4444', // Red (Pending)
                '#008524', // Safaricom Green (Paid)
            ],
            hoverOffset: 4
        }]
    };

    // 3. Contribution Breakdown - Bar Chart
    const contributionData = {
        labels: ['Group A', 'Group B', 'Womens Group', 'Youth Group', 'Elderly Group'],
        datasets: [{
            label: 'Total Contributions (KES)',
            data: [450000, 320000, 580000, 210000, 150000],
            backgroundColor: 'rgba(59, 130, 246, 0.7)', // Blue
        }]
    };

    // 4. Dividends Paid vs Pending - Doughnut Chart
    const dividendData = {
        labels: ['Paid', 'Pending'],
        datasets: [{
            data: [1200000, 350000],
            backgroundColor: [
                '#8B5CF6', // Purple (Paid)
                '#C084FC', // Light Purple (Pending)
            ],
        }]
    };

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom' },
        }
    };

    // Stats Cards Data
    const stats = [
        { title: 'Total Members', value: '142', icon: <FaUsers />, color: 'bg-green-500', trend: '+12 this month', link: '/members' },
        { title: 'Active Loans', value: '38', icon: <FaMoneyBillWave />, color: 'bg-yellow-500', trend: 'KES 1.2M value', link: '/loans' },
        { title: 'Total Contributions', value: 'KES 2.4M', icon: <FaPiggyBank />, color: 'bg-blue-500', trend: '+15% vs last month', link: '/contributions' },
        { title: 'Pending Repayments', value: '14', icon: <FaExclamationTriangle />, color: 'bg-red-500', trend: '5 overdue', link: '/loans' },
        { title: 'Total Dividends', value: 'KES 850K', icon: <FaGift />, color: 'bg-purple-500', trend: 'Calculated Dec 2025', link: '/dividends' },
        { title: 'Cash In / Out', value: 'KES +450K', icon: <FaExchangeAlt />, color: 'bg-emerald-600', trend: 'Net cash flow', link: '/reconciliation' },
    ];

    return (
        <div className="space-y-6 pb-10">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Dashboard Overview</h2>
                <div className="text-sm text-gray-500 font-medium">Last updated: {new Date().toLocaleDateString()}</div>
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

                {/* 4. Dividends Paid vs Pending */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Dividends Status</h3>
                    <div className="h-64">
                        <Doughnut options={commonOptions} data={dividendData} />
                    </div>
                </div>
            </div>

            {/* Daily Report Compliance Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center">
                            <FaHistory className="mr-2 text-safaricom-green" />
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
                        <div className="text-yellow-600 mb-2"><FaHandHoldingUsd size={24} /></div>
                        <span className="text-sm font-bold text-yellow-800">Approve Loan</span>
                    </Link>
                    <button className="p-4 rounded-lg bg-purple-50 border border-purple-100 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-purple-100 transition-colors">
                        <div className="text-purple-600 mb-2"><FaChartLine size={24} /></div>
                        <span className="text-sm font-bold text-purple-800">Generate Report</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

// Add missing icon
const FaHandHoldingUsd = (props) => (
    <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 576 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path d="M560 288h-80V96H112v192H32c-17.67 0-32 14.33-32 32v128c0 17.67 14.33 32 32 32h512c17.67 0 32-14.33 32-32V320c0-17.67-14.33-32-32-32zM144 128h288v160H144V128zm352 288H80V352h416v64z"></path>
    </svg>
);

export default Dashboard;
