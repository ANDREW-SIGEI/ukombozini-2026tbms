import React, { useState, useMemo } from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaUsers, FaCalendarAlt, FaChartLine, FaBell, FaDownload, FaFilter } from 'react-icons/fa';
import { mockMembers } from '../data/mockData';
import { toast } from 'react-toastify';
import PDFReportService from '../services/PDFReportService';

// Mock contribution data - replace with real API
const mockContributions = [
    { memberId: 1, month: '2026-01', amount: 2000, type: 'Monthly Saving', status: 'Paid' },
    { memberId: 2, month: '2026-01', amount: 1000, type: 'Monthly Saving', status: 'Partial' },
    { memberId: 3, month: '2026-01', amount: 2000, type: 'Monthly Saving', status: 'Paid' },
    { memberId: 4, month: '2026-01', amount: 0, type: null, status: 'Skipped' },
    { memberId: 5, month: '2026-01', amount: 2000, type: 'Monthly Saving', status: 'Paid' },
];

const ContributionCompliance = () => {
    const [selectedMonth, setSelectedMonth] = useState('2026-01');
    const [selectedGroup, setSelectedGroup] = useState('all');

    // Calculate compliance statistics
    const complianceStats = useMemo(() => {
        const total = mockMembers.length;
        const paid = mockContributions.filter(c => c.status === 'Paid').length;
        const partial = mockContributions.filter(c => c.status === 'Partial').length;
        const skipped = mockContributions.filter(c => c.status === 'Skipped').length;
        const complianceRate = ((paid / total) * 100).toFixed(1);
        const totalCollected = mockContributions.reduce((sum, c) => sum + c.amount, 0);
        const expectedAmount = total * 2000;
        const shortfall = expectedAmount - totalCollected;

        return {
            total,
            paid,
            partial,
            skipped,
            complianceRate,
            totalCollected,
            expectedAmount,
            shortfall
        };
    }, [selectedMonth]);

    // Member compliance details
    const memberCompliance = useMemo(() => {
        return mockMembers.map(member => {
            const contribution = mockContributions.find(c => c.memberId === member.id);
            return {
                ...member,
                contributionStatus: contribution?.status || 'Skipped',
                contributionAmount: contribution?.amount || 0,
                expectedAmount: 2000,
                shortfall: 2000 - (contribution?.amount || 0)
            };
        });
    }, [selectedMonth]);

    // Group by status
    const paidMembers = memberCompliance.filter(m => m.contributionStatus === 'Paid');
    const partialMembers = memberCompliance.filter(m => m.contributionStatus === 'Partial');
    const skippedMembers = memberCompliance.filter(m => m.contributionStatus === 'Skipped');

    // PDF Export Handler
    const handleExportPDF = () => {
        try {
            const pdfService = new PDFReportService();
            const monthName = new Date(selectedMonth + '-01').toLocaleString('en-GB', { month: 'long', year: 'numeric' });

            pdfService.generateContributionComplianceReport(
                monthName,
                complianceStats,
                memberCompliance
            );

            toast.success('✅ PDF report generated successfully!');
        } catch (error) {
            toast.error(`❌ Failed to generate PDF: ${error.message}`);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-800">Contribution Compliance Dashboard</h2>
                    <p className="text-sm text-gray-500 mt-1">Track member payment status and identify non-compliance</p>
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
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={<FaCheckCircle className="text-green-600" />}
                    label="Fully Paid"
                    value={complianceStats.paid}
                    total={complianceStats.total}
                    percentage={((complianceStats.paid / complianceStats.total) * 100).toFixed(0)}
                    color="green"
                />
                <StatCard
                    icon={<FaExclamationTriangle className="text-yellow-600" />}
                    label="Partial Payment"
                    value={complianceStats.partial}
                    total={complianceStats.total}
                    percentage={((complianceStats.partial / complianceStats.total) * 100).toFixed(0)}
                    color="yellow"
                />
                <StatCard
                    icon={<FaTimesCircle className="text-red-600" />}
                    label="Skipped"
                    value={complianceStats.skipped}
                    total={complianceStats.total}
                    percentage={((complianceStats.skipped / complianceStats.total) * 100).toFixed(0)}
                    color="red"
                />
                <StatCard
                    icon={<FaChartLine className="text-blue-600" />}
                    label="Compliance Rate"
                    value={`${complianceStats.complianceRate}%`}
                    subtitle={`${complianceStats.paid}/${complianceStats.total} members`}
                    color="blue"
                />
            </div>

            {/* Financial Summary */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-2xl border-2 border-blue-200">
                <h3 className="text-sm font-black text-blue-900 uppercase mb-4 flex items-center gap-2">
                    <FaUsers /> Financial Summary - January 2026
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-xl">
                        <div className="text-xs text-gray-500 font-bold uppercase">Total Collected</div>
                        <div className="text-2xl font-black text-green-600 mt-1">
                            KES {complianceStats.totalCollected.toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl">
                        <div className="text-xs text-gray-500 font-bold uppercase">Expected Amount</div>
                        <div className="text-2xl font-black text-gray-900 mt-1">
                            KES {complianceStats.expectedAmount.toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl">
                        <div className="text-xs text-gray-500 font-bold uppercase">Shortfall</div>
                        <div className={`text-2xl font-black mt-1 ${complianceStats.shortfall > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            KES {complianceStats.shortfall.toLocaleString()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Alerts Section */}
            {(partialMembers.length > 0 || skippedMembers.length > 0) && (
                <div className="bg-red-50 border-l-4 border-red-500 p-5 rounded-r-xl">
                    <div className="flex items-start gap-3">
                        <FaBell className="text-red-600 mt-1" />
                        <div>
                            <h4 className="font-black text-red-900">Action Required</h4>
                            <ul className="text-sm text-red-800 mt-2 space-y-1">
                                {partialMembers.length > 0 && (
                                    <li>• {partialMembers.length} member(s) made partial payment - follow up required</li>
                                )}
                                {skippedMembers.length > 0 && (
                                    <li>• {skippedMembers.length} member(s) skipped this month - immediate action needed</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabbed Member Lists */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="border-b border-gray-200">
                    <div className="flex">
                        <TabButton label={`✅ Paid (${paidMembers.length})`} active={true} color="green" />
                        <TabButton label={`⚠️ Partial (${partialMembers.length})`} active={false} color="yellow" />
                        <TabButton label={`❌ Skipped (${skippedMembers.length})`} active={false} color="red" />
                    </div>
                </div>

                <div className="p-6">
                    {/* Paid Members Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gradient-to-r from-green-50 to-green-100 border-b-2 border-green-200">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-black text-green-900 uppercase">Member</th>
                                    <th className="px-4 py-3 text-xs font-black text-green-900 uppercase">Group</th>
                                    <th className="px-4 py-3 text-xs font-black text-green-900 uppercase text-right">Amount Paid</th>
                                    <th className="px-4 py-3 text-xs font-black text-green-900 uppercase text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paidMembers.map(member => (
                                    <tr key={member.id} className="hover:bg-green-50/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-gray-900">{member.name}</div>
                                            <div className="text-xs text-gray-500">{member.phone}</div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-700">{member.groupName}</td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="font-black text-green-600">
                                                KES {member.contributionAmount.toLocaleString()}
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

                    {/* Partial Members Warning */}
                    {partialMembers.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <h4 className="font-black text-yellow-900 mb-4 flex items-center gap-2">
                                <FaExclamationTriangle /> Partial Payments - Follow Up Required
                            </h4>
                            <div className="grid gap-3">
                                {partialMembers.map(member => (
                                    <div key={member.id} className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r-xl">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <div className="font-bold text-gray-900">{member.name}</div>
                                                <div className="text-sm text-gray-600">
                                                    Paid: KES {member.contributionAmount.toLocaleString()} |
                                                    Shortfall: KES {member.shortfall.toLocaleString()}
                                                </div>
                                            </div>
                                            <button className="px-4 py-2 bg-yellow-600 text-white text-sm font-bold rounded-lg hover:bg-yellow-700 transition-all">
                                                Send Reminder
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Skipped Members Alert */}
                    {skippedMembers.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <h4 className="font-black text-red-900 mb-4 flex items-center gap-2">
                                <FaTimesCircle /> No Payment - Immediate Action Required
                            </h4>
                            <div className="grid gap-3">
                                {skippedMembers.map(member => (
                                    <div key={member.id} className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <div className="font-bold text-gray-900">{member.name}</div>
                                                <div className="text-sm text-gray-600">
                                                    Expected: KES 2,000 | Paid: KES 0
                                                </div>
                                            </div>
                                            <button className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-all">
                                                Contact Member
                                            </button>
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
                    <FaChartLine /> Compliance Trend (Last 6 Months)
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

export default ContributionCompliance;
