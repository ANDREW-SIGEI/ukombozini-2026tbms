import React, { useState, useMemo, useEffect } from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaHandHoldingUsd, FaCalendarAlt, FaChartLine, FaBell, FaDownload, FaFilter, FaMoneyBillWave, FaClock } from 'react-icons/fa';
import api from '../services/api';
import NotificationService from '../services/NotificationService';
import { toast } from 'react-toastify';

const LoanRepaymentTracking = () => {
    const [loans, setLoans] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState('2026-01');
    const [selectedGroup, setSelectedGroup] = useState('all');
    const [selectedLoanType, setSelectedLoanType] = useState('all');

    // Fetch Loans on Mount or Month Change
    useEffect(() => {
        loadData();
    }, [selectedMonth]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await api.getLoanRepaymentTracking(selectedMonth);
            setLoans(data);
        } catch (error) {
            toast.error("Failed to load loan tracking data");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    // Send SMS Reminder Handler
    const handleSendReminder = async (loan) => {
        try {
            if (!loan.memberPhone) {
                toast.warning("Member has no phone number");
                return;
            }

            const message = `Dear ${loan.memberName}, friendly reminder: You have a loan payment shortfall of KES ${loan.arrears.toLocaleString()}. Please pay to avoid penalties.`;

            await NotificationService.sendSMS(loan.memberPhone, message);
            toast.success(`SMS sent to ${loan.memberName}`);
        } catch (error) {
            toast.error("Failed to send Reminder");
        }
    };

    // Calculate repayment statistics
    const repaymentStats = useMemo(() => {
        // Filter first
        let filteredLoans = loans;
        if (selectedLoanType !== 'all') {
            filteredLoans = filteredLoans.filter(l => l.loanType === selectedLoanType);
        }
        // Group filter would go here if we had groupID in the data (added in API)

        const total = filteredLoans.length; // Use filtered list
        if (total === 0) return {
            total: 0, paidOnTime: 0, partial: 0, overdue: 0, complianceRate: 0,
            totalExpected: 0, totalCollected: 0, totalArrears: 0, shortfall: 0, totalOutstanding: 0
        };

        const paidOnTime = filteredLoans.filter(l => l.status === 'Paid').length;
        const partial = filteredLoans.filter(l => l.status === 'Partial').length;
        const overdue = filteredLoans.filter(l => l.status === 'Overdue').length;
        const complianceRate = ((paidOnTime / total) * 100).toFixed(1);

        const totalExpected = filteredLoans.reduce((sum, l) => sum + l.monthlyRepayment, 0);
        const totalCollected = filteredLoans.reduce((sum, l) => sum + l.paidThisMonth, 0);
        const totalArrears = filteredLoans.reduce((sum, l) => sum + l.arrears, 0);
        const shortfall = Math.max(0, totalExpected - totalCollected);

        const totalOutstanding = filteredLoans.reduce((sum, l) => sum + l.remainingBalance, 0);

        return {
            total,
            paidOnTime,
            partial,
            overdue,
            complianceRate,
            totalExpected,
            totalCollected,
            totalArrears,
            shortfall,
            totalOutstanding
        };
    }, [loans, selectedLoanType]);

    // Group loans by status
    const paidLoans = loans.filter(l => l.status === 'Paid');
    const partialLoans = loans.filter(l => l.status === 'Partial');
    const overdueLoans = loans.filter(l => l.status === 'Overdue');

    // PDF Export Handler
    const handleExportPDF = async () => {
        try {
            toast.info('📄 Generating Loan Repayment PDF...');
            await api.downloadLoanRepaymentReport(selectedMonth, selectedGroup, selectedLoanType);
            toast.success('✅ PDF report generated successfully!');
        } catch (error) {
            toast.error(`❌ Failed to generate PDF from server`);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-800">Loan Repayment Tracking Dashboard</h2>
                    <p className="text-sm text-gray-500 mt-1">Monitor loan repayments and identify defaulters</p>
                </div>
                <button
                    onClick={handleExportPDF}
                    className="flex items-center gap-2 px-6 py-3 bg-safaricom-green text-white rounded-xl font-bold hover:bg-safaricom-dark transition-all shadow-lg"
                >
                    <FaDownload />
                    Export PDF Report
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-4">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Period</label>
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-safaricom-green/20 outline-none"
                    >
                        <option value="2026-01">January 2026</option>
                        <option value="2025-12">December 2025</option>
                        <option value="2025-11">November 2025</option>
                    </select>
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Group</label>
                    <select
                        value={selectedGroup}
                        onChange={(e) => setSelectedGroup(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-safaricom-green/20 outline-none"
                    >
                        <option value="all">All Groups</option>
                        <option value="1">Ukombozi Group A</option>
                        <option value="2">Ukombozi Group B</option>
                    </select>
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Loan Type</label>
                    <select
                        value={selectedLoanType}
                        onChange={(e) => setSelectedLoanType(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-safaricom-green/20 outline-none"
                    >
                        <option value="all">All Types</option>
                        <option value="LTL">Long-Term (LTL)</option>
                        <option value="STL">Short-Term (STL)</option>
                        <option value="Emergency">Emergency</option>
                    </select>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={<FaCheckCircle className="text-green-600" />}
                    label="Paid On Time"
                    value={repaymentStats.paidOnTime}
                    total={repaymentStats.total}
                    percentage={((repaymentStats.paidOnTime / repaymentStats.total) * 100).toFixed(0)}
                    color="green"
                />
                <StatCard
                    icon={<FaExclamationTriangle className="text-yellow-600" />}
                    label="Partial Payment"
                    value={repaymentStats.partial}
                    total={repaymentStats.total}
                    percentage={((repaymentStats.partial / repaymentStats.total) * 100).toFixed(0)}
                    color="yellow"
                />
                <StatCard
                    icon={<FaTimesCircle className="text-red-600" />}
                    label="Overdue"
                    value={repaymentStats.overdue}
                    total={repaymentStats.total}
                    percentage={((repaymentStats.overdue / repaymentStats.total) * 100).toFixed(0)}
                    color="red"
                />
                <StatCard
                    icon={<FaChartLine className="text-blue-600" />}
                    label="Compliance Rate"
                    value={`${repaymentStats.complianceRate}%`}
                    subtitle={`${repaymentStats.paidOnTime}/${repaymentStats.total} loans`}
                    color="blue"
                />
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-2xl border-2 border-blue-200">
                    <h3 className="text-sm font-black text-blue-900 uppercase mb-4 flex items-center gap-2">
                        <FaMoneyBillWave /> Repayment Summary - January 2026
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-xl">
                            <div className="text-xs text-gray-500 font-bold uppercase">Total Collected</div>
                            <div className="text-2xl font-black text-green-600 mt-1">
                                KES {repaymentStats.totalCollected.toLocaleString()}
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl">
                            <div className="text-xs text-gray-500 font-bold uppercase">Expected Amount</div>
                            <div className="text-2xl font-black text-gray-900 mt-1">
                                KES {repaymentStats.totalExpected.toLocaleString()}
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl">
                            <div className="text-xs text-gray-500 font-bold uppercase">Shortfall</div>
                            <div className={`text-2xl font-black mt-1 ${repaymentStats.shortfall > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                KES {repaymentStats.shortfall.toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-orange-50 to-red-50 p-6 rounded-2xl border-2 border-orange-200">
                    <h3 className="text-sm font-black text-orange-900 uppercase mb-4 flex items-center gap-2">
                        <FaClock /> Portfolio Health
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-xl">
                            <div className="text-xs text-gray-500 font-bold uppercase">Total Arrears</div>
                            <div className="text-2xl font-black text-red-600 mt-1">
                                KES {repaymentStats.totalArrears.toLocaleString()}
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl">
                            <div className="text-xs text-gray-500 font-bold uppercase">Outstanding Balance</div>
                            <div className="text-2xl font-black text-orange-600 mt-1">
                                KES {repaymentStats.totalOutstanding.toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Critical Alerts Section */}
            {(partialLoans.length > 0 || overdueLoans.length > 0) && (
                <div className="bg-red-50 border-l-4 border-red-500 p-5 rounded-r-xl">
                    <div className="flex items-start gap-3">
                        <FaBell className="text-red-600 mt-1" />
                        <div>
                            <h4 className="font-black text-red-900">⚠️ URGENT: Collection Action Required</h4>
                            <ul className="text-sm text-red-800 mt-2 space-y-1">
                                {overdueLoans.length > 0 && (
                                    <li className="font-bold">• {overdueLoans.length} overdue loan(s) - Total arrears: KES {overdueLoans.reduce((sum, l) => sum + l.arrears, 0).toLocaleString()}</li>
                                )}
                                {partialLoans.length > 0 && (
                                    <li>• {partialLoans.length} partial payment(s) - Total shortfall: KES {partialLoans.reduce((sum, l) => sum + l.arrears, 0).toLocaleString()}</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabbed Loan Lists */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="border-b border-gray-200">
                    <div className="flex">
                        <TabButton label={`✅ Paid (${paidLoans.length})`} active={true} color="green" />
                        <TabButton label={`⚠️ Partial (${partialLoans.length})`} active={false} color="yellow" />
                        <TabButton label={`❌ Overdue (${overdueLoans.length})`} active={false} color="red" />
                    </div>
                </div>

                <div className="p-6">
                    {/* Paid Loans Table */}
                    <div className="overflow-x-auto mb-6">
                        <h3 className="font-black text-green-900 mb-4 flex items-center gap-2">
                            <FaCheckCircle /> Loans Paid On Time This Month
                        </h3>
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gradient-to-r from-green-50 to-green-100 border-b-2 border-green-200">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-black text-green-900 uppercase">Loan ID</th>
                                    <th className="px-4 py-3 text-xs font-black text-green-900 uppercase">Member</th>
                                    <th className="px-4 py-3 text-xs font-black text-green-900 uppercase">Type</th>
                                    <th className="px-4 py-3 text-xs font-black text-green-900 uppercase text-right">Amount Paid</th>
                                    <th className="px-4 py-3 text-xs font-black text-green-900 uppercase text-right">Remaining Balance</th>
                                    <th className="px-4 py-3 text-xs font-black text-green-900 uppercase text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paidLoans.map(loan => (
                                    <tr key={loan.id} className="hover:bg-green-50/30 transition-colors">
                                        <td className="px-4 py-3 font-mono text-xs text-gray-600">{loan.id}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-gray-900">{loan.memberName}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${loan.loanType === 'LTL' ? 'bg-blue-100 text-blue-700' :
                                                loan.loanType === 'STL' ? 'bg-purple-100 text-purple-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                {loan.loanType}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="font-black text-green-600">
                                                KES {loan.paidThisMonth.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="font-bold text-gray-700">
                                                KES {loan.remainingBalance.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-xs font-black uppercase rounded-full">
                                                <FaCheckCircle /> Paid
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Partial Payment Alerts */}
                    {partialLoans.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <h4 className="font-black text-yellow-900 mb-4 flex items-center gap-2">
                                <FaExclamationTriangle /> Partial Payments - Immediate Follow Up Required
                            </h4>
                            <div className="grid gap-3">
                                {partialLoans.map(loan => (
                                    <div key={loan.id} className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r-xl">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="font-mono text-xs font-bold text-gray-600">{loan.id}</span>
                                                    <span className="font-bold text-gray-900">{loan.memberName}</span>
                                                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
                                                        {loan.loanType}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-4 gap-4 text-sm">
                                                    <div>
                                                        <div className="text-xs text-gray-500">Expected</div>
                                                        <div className="font-bold">KES {loan.monthlyRepayment.toLocaleString()}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500">Paid</div>
                                                        <div className="font-bold text-yellow-700">KES {loan.paidThisMonth.toLocaleString()}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500">Shortfall</div>
                                                        <div className="font-bold text-red-600">KES {loan.arrears.toLocaleString()}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500">Balance</div>
                                                        <div className="font-bold">KES {loan.remainingBalance.toLocaleString()}</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleSendReminder(loan)}
                                                    className="px-4 py-2 bg-yellow-600 text-white text-sm font-bold rounded-lg hover:bg-yellow-700 transition-all"
                                                >
                                                    Send Reminder
                                                </button>
                                                <button className="px-4 py-2 bg-yellow-700 text-white text-sm font-bold rounded-lg hover:bg-yellow-800 transition-all">
                                                    Call Member
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Overdue Loans - Critical */}
                    {overdueLoans.length > 0 && (
                        <div className="mt-6 pt-6 border-t-2 border-red-200">
                            <h4 className="font-black text-red-900 mb-4 flex items-center gap-2 text-lg">
                                <FaTimesCircle /> 🚨 OVERDUE LOANS - URGENT ACTION REQUIRED
                            </h4>
                            <div className="grid gap-3">
                                {overdueLoans.map(loan => (
                                    <div key={loan.id} className="bg-red-50 border-2 border-red-500 p-5 rounded-xl shadow-lg">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <span className="font-mono text-sm font-black text-red-700">{loan.id}</span>
                                                    <span className="font-black text-gray-900 text-lg">{loan.memberName}</span>
                                                    <span className="px-3 py-1 bg-red-200 text-red-900 text-xs font-black rounded-full">
                                                        {loan.loanType}
                                                    </span>
                                                    <span className="px-3 py-1 bg-red-600 text-white text-xs font-black rounded-full flex items-center gap-1">
                                                        <FaClock /> OVERDUE
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-5 gap-4 text-sm bg-white p-4 rounded-lg">
                                                    <div>
                                                        <div className="text-xs text-gray-500 uppercase font-bold">Expected</div>
                                                        <div className="font-black text-gray-900">KES {loan.monthlyRepayment.toLocaleString()}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500 uppercase font-bold">Paid</div>
                                                        <div className="font-black text-red-600">KES {loan.paidThisMonth.toLocaleString()}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500 uppercase font-bold">Arrears</div>
                                                        <div className="font-black text-red-700 text-lg">KES {loan.arrears.toLocaleString()}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500 uppercase font-bold">Total Balance</div>
                                                        <div className="font-black text-gray-900">KES {loan.remainingBalance.toLocaleString()}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500 uppercase font-bold">Due Date</div>
                                                        <div className="font-black text-red-600">{new Date(loan.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2 ml-4">
                                                <button className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-all whitespace-nowrap">
                                                    🚨 Escalate to Guarantors
                                                </button>
                                                <button className="px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-lg hover:bg-red-600 transition-all whitespace-nowrap">
                                                    📞 Contact Member
                                                </button>
                                                <button className="px-4 py-2 bg-orange-600 text-white text-sm font-bold rounded-lg hover:bg-orange-700 transition-all whitespace-nowrap">
                                                    📋 View Ledger
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Trend Analysis (Placeholder) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-black text-gray-800 mb-4 flex items-center gap-2">
                    <FaChartLine /> Repayment Compliance Trend (Last 6 Months)
                </h3>
                <div className="h-64 flex items-center justify-center bg-gray-50 rounded-xl">
                    <p className="text-gray-400 text-sm">Chart visualization coming soon...</p>
                </div>
            </div>
        </div>
    );
};

// Helper Components
const StatCard = ({ icon, label, value, total, percentage, subtitle, color }) => {
    const colorClasses = {
        green: 'from-green-500 to-green-600',
        yellow: 'from-yellow-500 to-yellow-600',
        red: 'from-red-500 to-red-600',
        blue: 'from-blue-500 to-blue-600'
    };

    return (
        <div className={`bg-gradient-to-br ${colorClasses[color]} p-5 rounded-2xl text-white shadow-lg`}>
            <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-white/20 rounded-xl">
                    {icon}
                </div>
                {percentage && (
                    <div className="text-2xl font-black">{percentage}%</div>
                )}
            </div>
            <div className="text-xs opacity-90 uppercase font-bold">{label}</div>
            <div className="text-3xl font-black mt-1">
                {typeof value === 'number' ? value : value}
            </div>
            {subtitle && (
                <div className="text-xs opacity-80 mt-1">{subtitle}</div>
            )}
        </div>
    );
};

const TabButton = ({ label, active, color }) => {
    const activeClasses = active
        ? `border-b-4 border-${color}-500 text-${color}-700 bg-${color}-50`
        : 'border-b-4 border-transparent text-gray-500 hover:bg-gray-50';

    return (
        <button className={`px-6 py-3 font-bold text-sm transition-all ${activeClasses}`}>
            {label}
        </button>
    );
};

export default LoanRepaymentTracking;
