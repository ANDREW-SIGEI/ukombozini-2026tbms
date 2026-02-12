import React, { useState, useMemo, useEffect } from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaUsers, FaChartLine, FaBell, FaDownload } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../services/api';
import SearchableGroupSelector from '../components/SearchableGroupSelector';

const ContributionCompliance = () => {
    const [selectedMonth, setSelectedMonth] = useState('2026-01');
    const [selectedGroup, setSelectedGroup] = useState('all');
    const [loading, setLoading] = useState(true);
    const [memberCompliance, setMemberCompliance] = useState([]);
    const [groups, setGroups] = useState([]);
    const [activeTab, setActiveTab] = useState('paid'); // 'paid', 'partial', 'skipped'

    // 1. Fetch initial data (Groups)
    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const data = await api.getGroups();
                setGroups(data || []);
            } catch (error) {
                console.error('Fetch groups error:', error);
            }
        };
        fetchGroups();
    }, []);

    // 2. Fetch compliance data when filters change
    useEffect(() => {
        const fetchCompliance = async () => {
            setLoading(true);
            try {
                const data = await api.getContributionCompliance(selectedMonth, selectedGroup);
                setMemberCompliance(data || []);
            } catch (error) {
                toast.error("Failed to load compliance data");
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchCompliance();
    }, [selectedMonth, selectedGroup]);

    // 3. Derived Statistics
    const complianceStats = useMemo(() => {
        const totalCount = memberCompliance.length || 1;
        const paidCount = memberCompliance.filter(m => m.contributionStatus === 'Paid').length;
        const partialCount = memberCompliance.filter(m => m.contributionStatus === 'Partial').length;
        const skippedCount = memberCompliance.filter(m => m.contributionStatus === 'Skipped').length;

        const totalCollected = memberCompliance.reduce((sum, m) => sum + m.contributionAmount, 0);
        const expectedAmount = memberCompliance.reduce((sum, m) => sum + m.expectedAmount, 0);

        return {
            total: memberCompliance.length,
            paid: paidCount,
            partial: partialCount,
            skipped: skippedCount,
            complianceRate: ((paidCount / totalCount) * 100).toFixed(1),
            totalCollected,
            expectedAmount,
            shortfall: Math.max(0, expectedAmount - totalCollected)
        };
    }, [memberCompliance]);

    // Group by status
    const paidMembers = memberCompliance.filter(m => m.contributionStatus === 'Paid');
    const partialMembers = memberCompliance.filter(m => m.contributionStatus === 'Partial');
    const skippedMembers = memberCompliance.filter(m => m.contributionStatus === 'Skipped');

    // PDF Export Handler
    const handleExportPDF = async () => {
        try {
            toast.info('📄 Generating Compliance PDF...');
            await api.downloadContributionComplianceReport(selectedMonth, selectedGroup);
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
                    <SearchableGroupSelector
                        groups={groups}
                        selectedGroupId={selectedGroup === 'all' ? '' : selectedGroup}
                        onSelect={(id) => setSelectedGroup(id || 'all')}
                        label="Group Entity"
                        placeholder="All Groups"
                    />
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={<FaCheckCircle className="text-green-600" />}
                    label="Fully Paid"
                    value={complianceStats.paid}
                    total={complianceStats.total}
                    percentage={complianceStats.total > 0 ? ((complianceStats.paid / complianceStats.total) * 100).toFixed(0) : 0}
                    color="green"
                />
                <StatCard
                    icon={<FaExclamationTriangle className="text-yellow-600" />}
                    label="Partial Payment"
                    value={complianceStats.partial}
                    total={complianceStats.total}
                    percentage={complianceStats.total > 0 ? ((complianceStats.partial / complianceStats.total) * 100).toFixed(0) : 0}
                    color="yellow"
                />
                <StatCard
                    icon={<FaTimesCircle className="text-red-600" />}
                    label="Skipped"
                    value={complianceStats.skipped}
                    total={complianceStats.total}
                    percentage={complianceStats.total > 0 ? ((complianceStats.skipped / complianceStats.total) * 100).toFixed(0) : 0}
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
                    <FaUsers /> Financial Summary - {new Date(selectedMonth + '-01').toLocaleString('en-GB', { month: 'long', year: 'numeric' })}
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
                        <TabButton
                            label={`✅ Paid (${paidMembers.length})`}
                            active={activeTab === 'paid'}
                            onClick={() => setActiveTab('paid')}
                            color="green"
                        />
                        <TabButton
                            label={`⚠️ Partial (${partialMembers.length})`}
                            active={activeTab === 'partial'}
                            onClick={() => setActiveTab('partial')}
                            color="yellow"
                        />
                        <TabButton
                            label={`❌ Skipped (${skippedMembers.length})`}
                            active={activeTab === 'skipped'}
                            onClick={() => setActiveTab('skipped')}
                            color="red"
                        />
                    </div>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="py-12 text-center">
                            <div className="animate-spin w-8 h-8 border-4 border-safaricom-green border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">Fetching Compliance Data...</p>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'paid' && (
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
                                            {paidMembers.length > 0 ? paidMembers.map(member => (
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
                                            )) : (
                                                <tr>
                                                    <td colSpan="4" className="text-center py-10 text-gray-400 italic">No fully paid members found.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {activeTab === 'partial' && (
                                <div className="grid gap-3">
                                    {partialMembers.length > 0 ? partialMembers.map(member => (
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
                                    )) : (
                                        <div className="text-center py-10">
                                            <p className="text-gray-400 italic">No partial payments for this period.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'skipped' && (
                                <div className="grid gap-3">
                                    {skippedMembers.length > 0 ? skippedMembers.map(member => (
                                        <div key={member.id} className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <div className="font-bold text-gray-900">{member.name}</div>
                                                    <div className="text-sm text-gray-600">
                                                        Expected: KES {member.expectedAmount.toLocaleString()} | Paid: KES 0
                                                    </div>
                                                </div>
                                                <button className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-all">
                                                    Contact Member
                                                </button>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center py-10">
                                            <p className="text-gray-400 italic">No skipped payments for this period! 🎉</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
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
                {percentage !== undefined && (
                    <div className="text-2xl font-black">{percentage}%</div>
                )}
            </div>
            <div className="text-xs opacity-90 uppercase font-bold">{label}</div>
            <div className="text-3xl font-black mt-1">
                {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
            {subtitle && (
                <div className="text-xs opacity-80 mt-1">{subtitle}</div>
            )}
        </div>
    );
};

const TabButton = ({ label, active, color, onClick }) => {
    const activeClasses = active
        ? `border-b-4 border-${color}-500 text-${color}-700 bg-${color}-50`
        : 'border-b-4 border-transparent text-gray-500 hover:bg-gray-50';

    return (
        <button
            onClick={onClick}
            className={`px-6 py-3 font-bold text-sm transition-all ${activeClasses}`}>
            {label}
        </button>
    );
};

export default ContributionCompliance;
