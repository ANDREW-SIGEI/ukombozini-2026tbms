import React, { useState } from 'react';
import {
    FaMobileAlt,
    FaCheckCircle,
    FaTimesCircle,
    FaClock,
    FaFilter,
    FaDownload,
    FaSearch,
    FaChartLine
} from 'react-icons/fa';

// Mock SMS data for demonstration
const mockSMSLogs = [
    {
        id: 1,
        timestamp: '2026-01-19T15:30:00',
        memberName: 'Hilda Sigei',
        phone: '+254712345678',
        type: 'CONTRIBUTION',
        message: 'UKOMBOZI: KES 2,000 savings received on 19/01/2026. Balance: KES 97,000. Meeting #MTG-202501-001 - Ukombozi Group A.',
        status: 'DELIVERED',
        cost: 0.80,
        messageId: 'AT-MSG-12345',
        sentBy: 'John Kamau'
    },
    {
        id: 2,
        timestamp: '2026-01-19T14:20:00',
        memberName: 'Jane Smith',
        phone: '+254722345678',
        type: 'LOAN_APPROVED',
        message: 'UKOMBOZI: Your loan application for KES 50,000 has been APPROVED. Visit your group meeting for disbursement. App #APP-202601-0012.',
        status: 'SENT',
        cost: 1.60,
        messageId: 'AT-MSG-12344',
        sentBy: 'Sarah Admin'
    },
    {
        id: 3,
        timestamp: '2026-01-19T13:10:00',
        memberName: 'Bob Brown',
        phone: '+254733345678',
        type: 'ARREARS_ALERT',
        message: 'UKOMBOZI: You have arrears of KES 2,500. Please clear in next meeting to avoid penalties. Contact: +254700000000.',
        status: 'FAILED',
        cost: 0,
        error: 'Number not reachable',
        messageId: 'AT-MSG-12343',
        sentBy: 'System'
    }
];

const SMSReports = () => {
    const [smsLogs, setSmsLogs] = useState(mockSMSLogs);
    const [filterType, setFilterType] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('TODAY');

    // Filter SMS logs
    const filteredLogs = smsLogs.filter(log => {
        const matchesType = filterType === 'ALL' || log.type === filterType;
        const matchesStatus = filterStatus === 'ALL' || log.status === filterStatus;
        const matchesSearch = log.memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.phone.includes(searchTerm);

        return matchesType && matchesStatus && matchesSearch;
    });

    // Statistics
    const stats = {
        total: smsLogs.length,
        delivered: smsLogs.filter(s => s.status === 'DELIVERED').length,
        sent: smsLogs.filter(s => s.status === 'SENT').length,
        failed: smsLogs.filter(s => s.status === 'FAILED').length,
        totalCost: smsLogs.reduce((sum, s) => sum + (s.cost || 0), 0)
    };

    const getStatusConfig = (status) => {
        switch (status) {
            case 'DELIVERED':
                return { icon: FaCheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' };
            case 'SENT':
                return { icon: FaClock, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' };
            case 'FAILED':
                return { icon: FaTimesCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
            default:
                return { icon: FaClock, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' };
        }
    };

    const getTypeLabel = (type) => {
        const labels = {
            'CONTRIBUTION': 'Contribution',
            'LOAN_REPAYMENT': 'Loan Repayment',
            'LOAN_DISBURSED': 'Loan Disbursed',
            'LOAN_APPROVED': 'Loan Approved',
            'LOAN_REJECTED': 'Loan Rejected',
            'ARREARS_ALERT': 'Arrears Alert',
            'MEETING_REMINDER': 'Meeting Reminder',
            'DIVIDEND_POSTED': 'Dividend'
        };
        return labels[type] || type;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">SMS Delivery Reports</h2>
                    <p className="text-sm text-gray-500">Member transaction confirmations & alerts</p>
                </div>
                <button className="flex items-center px-6 py-3 bg-safaricom-green text-white rounded-lg hover:bg-safaricom-dark transition-colors shadow-sm font-bold">
                    <FaDownload className="mr-2" /> Export Report
                </button>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-xs text-gray-500 uppercase font-bold">Total Sent</p>
                    <p className="text-2xl font-black text-gray-800 mt-1">{stats.total}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-xl shadow-sm border border-green-100">
                    <p className="text-xs text-green-700 uppercase font-bold">Delivered</p>
                    <p className="text-2xl font-black text-green-800 mt-1">{stats.delivered}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-xl shadow-sm border border-blue-100">
                    <p className="text-xs text-blue-700 uppercase font-bold">Sent</p>
                    <p className="text-2xl font-black text-blue-800 mt-1">{stats.sent}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-xl shadow-sm border border-red-100">
                    <p className="text-xs text-red-700 uppercase font-bold">Failed</p>
                    <p className="text-2xl font-black text-red-800 mt-1">{stats.failed}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-xl shadow-sm border border-purple-100">
                    <p className="text-xs text-purple-700 uppercase font-bold">Total Cost</p>
                    <p className="text-lg font-black text-purple-800 mt-1">KES {stats.totalCost.toFixed(2)}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Search */}
                    <div className="relative">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search member or phone..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-safaricom-green/20"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Type Filter */}
                    <select
                        className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 outline-none font-medium text-gray-700"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                    >
                        <option value="ALL">All Types</option>
                        <option value="CONTRIBUTION">Contribution</option>
                        <option value="LOAN_APPROVED">Loan Approved</option>
                        <option value="LOAN_DISBURSED">Loan Disbursed</option>
                        <option value="ARREARS_ALERT">Arrears Alert</option>
                    </select>

                    {/* Status Filter */}
                    <select
                        className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 outline-none font-medium text-gray-700"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="ALL">All Status</option>
                        <option value="DELIVERED">Delivered</option>
                        <option value="SENT">Sent</option>
                        <option value="FAILED">Failed</option>
                    </select>

                    {/* Date Filter */}
                    <select
                        className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 outline-none font-medium text-gray-700"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                    >
                        <option value="TODAY">Today</option>
                        <option value="WEEK">This Week</option>
                        <option value="MONTH">This Month</option>
                        <option value="ALL">All Time</option>
                    </select>
                </div>
            </div>

            {/* SMS Log Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Timestamp</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Member</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Message</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Cost</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-10 text-center text-gray-500">
                                        No SMS logs found.
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map(log => {
                                    const statusConfig = getStatusConfig(log.status);
                                    const StatusIcon = statusConfig.icon;

                                    return (
                                        <tr key={log.id} className="hover:bg-blue-50/50 transition-colors">
                                            <td className="px-6 py-4 text-gray-600">
                                                {new Date(log.timestamp).toLocaleString('en-GB', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-900">{log.memberName}</div>
                                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                                    <FaMobileAlt className="text-gray-400" />
                                                    {log.phone}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-xs font-bold">
                                                    {getTypeLabel(log.type)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 max-w-md">
                                                <p className="text-gray-700 text-xs line-clamp-2">{log.message}</p>
                                                {log.error && (
                                                    <p className="text-red-600 text-xs font-bold mt-1">Error: {log.error}</p>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 w-fit ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}>
                                                    <StatusIcon />
                                                    {log.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono font-bold text-gray-900">
                                                {log.cost ? `KES ${log.cost.toFixed(2)}` : '-'}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                <div className="flex items-start gap-3">
                    <FaChartLine className="text-blue-600 mt-0.5 flex-shrink-0 text-xl" />
                    <div className="text-sm">
                        <p className="font-bold text-blue-900 mb-1">📲 SMS Notifications are System-Generated</p>
                        <p className="text-blue-700">
                            All SMS alerts are automatically sent when transactions are posted. Officers cannot edit or resend messages manually.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SMSReports;
