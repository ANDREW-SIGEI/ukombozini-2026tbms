import React, { useState, useEffect } from 'react';
import {
    FaChartPie, FaCalculator, FaLock, FaCircleCheck, FaTriangleExclamation,
    FaPlus, FaEye, FaFilePdf, FaFileExcel, FaShieldHalved, FaMoneyBillWave,
    FaPercent, FaClockRotateLeft, FaCircleXmark, FaRotate, FaCircleInfo, FaUserPlus
} from 'react-icons/fa6';
import { toast } from 'react-toastify';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const DividendManagement = () => {
    const { user } = useAuth();
    const [runs, setRuns] = useState([]);
    const [selectedRun, setSelectedRun] = useState(null);
    const [allocations, setAllocations] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    // Add Member Modal State
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [newMember, setNewMember] = useState({ name: '', phone: '', groupId: '' });

    const [calculating, setCalculating] = useState(false);

    // Form State for New Run
    const [formData, setFormData] = useState({
        financialYear: new Date().getFullYear(),
        bankingInterest: 0,
        stlInterest: 0,
        ltlInterest: 0,
        penalties: 0,
        otherIncome: 0,
        operatingExpenses: 0,
        mandatoryReserves: 0,
        riskBuffer: 0,
        reinvestedCapital: 0,
        profitSharePercentage: 75,
        groupId: '', // Selected Group ID
        manualGroupName: '', // Custom name text
        isManual: false
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [runsData, groupsData] = await Promise.all([
                api.getDividendRuns(),
                api.getGroups()
            ]);
            setRuns(runsData || []);
            setGroups(groupsData || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load initial data');
        } finally {
            setLoading(false);
        }
    };

    const fetchRuns = async () => { // Keep for refresh
        const data = await api.getDividendRuns();
        setRuns(data || []);
    };



    const handleCreateRun = async (e) => {
        e.preventDefault();
        try {
            // Map form data to database schema (snake_case)
            const payload = {
                financial_year: formData.financialYear,
                financial_year: formData.financialYear,
                group_id: formData.groupId || 1, // Use selected group or default
                run_number: `DIV-${formData.financialYear}-${Math.floor(Math.random() * 1000)}`, // Simple auto-gen

                // Income
                banking_interest: formData.bankingInterest,
                stl_interest: formData.stlInterest,
                ltl_interest: formData.ltlInterest,
                penalties: formData.penalties,
                other_income: formData.otherIncome,

                // Deductions
                operating_expenses: formData.operatingExpenses,
                mandatory_reserves: formData.mandatoryReserves,
                risk_buffer: formData.riskBuffer,
                reinvested_capital: formData.reinvestedCapital,

                // Policy
                profit_share_percentage: formData.profitSharePercentage,

                // Manual Overrides
                total_average_shares: formData.isManual && formData.totalAverageShares ? formData.totalAverageShares : undefined,
                manual_group_name: formData.manualGroupName || undefined,

                status: 'DRAFT',
                created_at: new Date().toISOString()
            };

            const newRun = await api.createDividendRun(payload);
            toast.success(`✅ Dividend run created: ${newRun.run_number}`);
            setShowCreateModal(false);
            fetchRuns();
        } catch (error) {
            console.error(error);
            toast.error('Failed to create dividend run');
        }
    };

    const handleCalculate = async (runId) => {
        setCalculating(true);
        try {
            const result = await api.calculateDividend(runId);
            if (result.success) {
                toast.success(`✅ Dividend calculated! ${result.total_members} members, KES ${result.total_payout.toLocaleString()} total`);
                fetchRuns();
            } else {
                toast.error(result.message || 'Calculation failed');
            }
        } catch (error) {
            console.error(error);
            toast.error('Calculation failed');
        } finally {
            setCalculating(false);
        }
    };

    const handleViewDetails = async (run) => {
        setSelectedRun(run);
        try {
            const data = await api.getDividendAllocations(run.id);
            setAllocations(data || []);
            setShowDetailsModal(true);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load allocations');
        }
    };

    const handleApprove = async (runId) => {
        if (!window.confirm('Approve this dividend run? This cannot be undone.')) return;
        try {
            await api.approveDividendRun(runId);
            toast.success('✅ Dividend run approved!');
            fetchRuns();
            setShowDetailsModal(false);
        } catch (error) {
            console.error(error);
            toast.error('Approval failed');
        }
    };

    const handlePost = async (runId) => {
        if (!window.confirm('Post dividends to member accounts? This will debit reserves and credit member savings.')) return;
        try {
            await api.postDividendRun(runId);
            toast.success('✅ Dividends posted to member accounts!');
            fetchRuns();
            setShowDetailsModal(false);
        } catch (error) {
            console.error(error);
            toast.error('Posting failed');
        }
    };

    const handleGeneratePDF = async (run) => {
        try {
            toast.info('📄 Generating Dividend PDF...');
            await api.downloadDividendReport(run.id);
            toast.success(`✅ PDF generated for run: ${run.run_number}`);
        } catch (error) {
            console.error(error);
            toast.error('PDF generation failed on server');
        }
    };

    const handleExportExcel = (allocationsList, run) => {
        try {
            if (!allocationsList || allocationsList.length === 0) {
                toast.warning('No data to export');
                return;
            }

            // CSV Header
            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "Member Name,Phone,Average Shares,Gross Dividend,Arrears Offset,Net Payout,Posted\n";

            // Rows
            allocationsList.forEach(row => {
                const memberName = row.members?.full_name || row.member_name || 'Unknown';
                const phone = row.members?.phone || '-';
                const avgShares = row.average_shares || 0;
                const gross = row.gross_dividend || 0;
                const arrears = row.arrears_offset || 0;
                const net = row.net_dividend || 0;
                const posted = row.posted_to_savings ? 'Yes' : 'No';

                // Handle commas in names
                const safeName = `"${memberName.replace(/"/g, '""')}"`;

                csvContent += `${safeName},${phone},${avgShares},${gross},${arrears},${net},${posted}\n`;
            });

            // Encode and Download
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `UKOMBOZI_Dividends_${run.run_number}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success('✅ Excel (CSV) exported successfully');
        } catch (error) {
            console.error(error);
            toast.error('Export failed');
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            'DRAFT': 'bg-gray-100 text-gray-700 border-gray-200',
            'CALCULATED': 'bg-blue-100 text-blue-700 border-blue-200',
            'DIRECTOR_REVIEW': 'bg-purple-100 text-purple-700 border-purple-200',
            'APPROVED': 'bg-green-100 text-green-700 border-green-200',
            'POSTED': 'bg-teal-100 text-teal-700 border-teal-200',
            'REJECTED': 'bg-red-100 text-red-700 border-red-200'
        };
        return colors[status] || 'bg-gray-100 text-gray-700';
    };

    const getStatusIcon = (status) => {
        if (status === 'POSTED' || status === 'APPROVED') return <FaCircleCheck />;
        if (status === 'REJECTED') return <FaCircleXmark />;
        if (status === 'CALCULATED') return <FaCalculator />;
        return <FaClockRotateLeft />;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                        <FaChartPie className="text-safaricom-green" /> Dividend Management Engine
                    </h2>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                        Institutional Standard • Policy-Driven • Audit-Compliant
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 bg-safaricom-green text-white px-5 py-2 rounded-xl font-bold hover:bg-green-700 transition-colors shadow-md"
                >
                    <FaPlus /> New Dividend Run
                </button>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <FaCircleInfo className="text-blue-600 mt-1" size={20} />
                    <div className="flex-1">
                        <h4 className="font-bold text-blue-900 text-sm mb-1">System-Calculated Dividends</h4>
                        <p className="text-xs text-blue-700">
                            Dividend rates are <span className="font-black">AUTOMATICALLY CALCULATED</span> from profit and average shares.
                            No manual rate entry allowed. This ensures fairness, transparency, and audit compliance.
                        </p>
                    </div>
                </div>
            </div>

            {/* Dividend Runs List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="p-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                        <FaClockRotateLeft /> Dividend Runs History
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase">Run Number</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase">Financial Year</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase text-right">Total Profit</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase text-right">Dividend Rate</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase text-right">Total Payout</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                        <FaRotate className="animate-spin inline mr-2" /> Loading runs...
                                    </td>
                                </tr>
                            ) : runs.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-gray-400">
                                        No dividend runs found. Click "New Dividend Run" to create one.
                                    </td>
                                </tr>
                            ) : (
                                runs.map((run) => (
                                    <tr key={run.id} className="hover:bg-blue-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-mono font-bold text-gray-800">{run.run_number}</div>
                                            <div className="text-xs text-gray-500">
                                                {new Date(run.created_at).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-gray-700">{run.financial_year}</td>
                                        <td className="px-6 py-4 text-right font-mono font-bold text-green-600">
                                            KES {(run.allocable_profit || 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-mono font-black text-purple-600 text-lg">
                                                {(run.dividend_rate * 100 || 0).toFixed(2)}%
                                            </span>
                                            <div className="text-xs text-gray-400 font-bold">🔒 System Calculated</div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-bold text-safaricom-green text-lg">
                                            KES {(run.total_payout || 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border flex items-center gap-1 w-fit ${getStatusColor(run.status)}`}>
                                                {getStatusIcon(run.status)}
                                                {run.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() => handleViewDetails(run)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                                    title="View Details"
                                                >
                                                    <FaEye />
                                                </button>
                                                {run.status === 'DRAFT' && (
                                                    <button
                                                        onClick={() => handleCalculate(run.id)}
                                                        disabled={calculating}
                                                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50"
                                                        title="Calculate Dividends"
                                                    >
                                                        <FaCalculator />
                                                    </button>
                                                )}
                                                {run.status !== 'DRAFT' && (
                                                    <button
                                                        onClick={() => handleGeneratePDF(run)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                                        title="Generate PDF Report"
                                                    >
                                                        <FaFilePdf />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* CREATE MODAL (INSTITUTIONAL REDESIGN) */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full p-0 my-8 overflow-hidden flex flex-col max-h-[90vh]">

                        {/* Modal Header */}
                        <div className="bg-gray-50 border-b border-gray-100 p-6 flex justify-between items-center sticky top-0 z-10">
                            <div>
                                <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                                    <FaShieldHalved className="text-safaricom-green" /> New Dividend Run
                                </h3>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-1">
                                    Institutional Grade • Audit-Safe • System-Derived
                                </p>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                                <FaCircleXmark size={28} />
                            </button>
                        </div>

                        <div className="p-8 overflow-y-auto custom-scrollbar space-y-8 bg-white">

                            <form onSubmit={handleCreateRun} className="space-y-8">

                                {/* SECTION ZERO: TARGET GROUP */}
                                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                                        <h4 className="font-bold text-gray-700 flex items-center gap-2">
                                            <span className="bg-gray-800 text-white text-xs px-2 py-1 rounded">START</span>
                                            Target Group Selection
                                        </h4>
                                        <div className="flex items-center gap-2">
                                            <a href="/members" target="_blank" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                                                <FaEye /> View All
                                            </a>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setNewMember(prev => ({ ...prev, groupId: formData.groupId }));
                                                    setShowAddMemberModal(true);
                                                }}
                                                className="bg-green-600 text-white text-xs px-3 py-1 rounded hover:bg-green-700 font-bold flex items-center gap-1 shadow-sm"
                                            >
                                                <FaPlus /> Add Member
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-6">
                                        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Select Group to Process</label>
                                        <div className="flex gap-4 mb-4">
                                            <select
                                                className="flex-1 p-3 border-2 border-gray-200 rounded-lg text-lg font-bold text-gray-700 focus:border-safaricom-green outline-none"
                                                value={formData.groupId}
                                                onChange={(e) => {
                                                    const gid = e.target.value;
                                                    const gName = groups.find(g => g.id == gid)?.group_name || '';
                                                    setFormData(prev => ({ ...prev, groupId: gid, manualGroupName: gName }));
                                                }}
                                                required
                                            >
                                                <option value="">-- Choose a Group --</option>
                                                {groups.map(g => (
                                                    <option key={g.id} value={g.id}>
                                                        {g.group_name} ({g.members?.[0]?.count || 0} Members)
                                                    </option>
                                                ))}
                                            </select>
                                            {formData.groupId && (
                                                <div className="bg-green-50 px-4 py-2 rounded-lg border border-green-100 flex flex-col justify-center items-center min-w-[120px]">
                                                    <span className="text-xs text-green-600 font-bold uppercase">Members</span>
                                                    <span className="text-xl font-black text-green-800">
                                                        {groups.find(g => g.id == formData.groupId)?.members?.[0]?.count || 0}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Manual Group Name Override */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase flex items-center gap-2">
                                                Report Group Name <span className="text-[10px] bg-blue-100 text-blue-800 px-1 rounded">Editable</span>
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg font-bold text-gray-700 focus:border-blue-500 outline-none"
                                                placeholder="Enter Custom Group Name for PDF Report..."
                                                value={formData.manualGroupName}
                                                onChange={(e) => setFormData({ ...formData, manualGroupName: e.target.value })}
                                            />
                                        </div>

                                        <p className="text-xs text-gray-400 mt-2">
                                            Select a group to link the data, but you can edit the <strong>Report Group Name</strong> above if you need a custom title on the PDF.
                                        </p>
                                    </div>
                                </div>

                                {/* SECTION A: SHARE SNAPSHOTS */}
                                <div className="border border-gray-200 rounded-xl overflow-hidden">
                                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                                        <h4 className="font-bold text-gray-700 flex items-center gap-2">
                                            <span className="bg-gray-800 text-white text-xs px-2 py-1 rounded">SECTION A</span>
                                            Share Snapshots
                                        </h4>
                                        <span className={`text-xs font-bold flex items-center gap-1 ${formData.isManual ? 'text-blue-600' : 'text-safaricom-green'}`}>
                                            {formData.isManual ? <FaCalculator /> : <FaLock />}
                                            {formData.isManual ? 'Manual Input Mode' : 'All Periods Locked'}
                                        </span>
                                    </div>
                                    <div className="p-6">
                                        <div className="grid grid-cols-6 gap-2 text-center">
                                            {['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'].map(month => (
                                                <div key={month} className={`${formData.isManual ? 'bg-white ring-1 ring-blue-200' : 'bg-green-50 border border-green-100'} rounded-lg p-3 transition-all`}>
                                                    <div className="text-xs font-bold text-gray-500 mb-1">{month}</div>
                                                    {formData.isManual ? (
                                                        <input
                                                            type="number"
                                                            placeholder="Shares"
                                                            className="w-full text-center font-bold text-sm text-blue-800 border-b border-blue-200 focus:border-blue-500 outline-none bg-transparent p-1"
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value) || 0;
                                                                setFormData(prev => {
                                                                    const invalidMonths = prev.monthlyShares || {};
                                                                    const newMonths = { ...invalidMonths, [month]: val };

                                                                    // Calculate new total average
                                                                    const total = Object.values(newMonths).reduce((a, b) => a + b, 0);
                                                                    const avg = total / 6;

                                                                    return {
                                                                        ...prev,
                                                                        monthlyShares: newMonths,
                                                                        totalAverageShares: avg
                                                                    };
                                                                });
                                                            }}
                                                        />
                                                    ) : (
                                                        <>
                                                            <FaCircleCheck className="mx-auto text-green-600 mb-1" />
                                                            <div className="text-[10px] font-bold text-green-700 uppercase">Validated</div>
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-4 flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-xs text-gray-500 bg-blue-50 p-3 rounded-lg border border-blue-100 max-w-md">
                                                <FaCircleInfo className="text-blue-500" />
                                                {formData.isManual
                                                    ? "Enter total shares for each month manually. The system will calculate the Weighted Average."
                                                    : "System uses bi-monthly weighted average shares from the database."}
                                            </div>
                                            {formData.isManual && (
                                                <div className="text-right">
                                                    <div className="text-xs font-bold text-gray-400 uppercase">Calculated Average Shares</div>
                                                    <div className="text-xl font-black text-blue-700">
                                                        {(formData.totalAverageShares || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION B: PROFIT COMPUTATION */}
                                <div className="border border-gray-200 rounded-xl overflow-hidden">
                                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                                        <h4 className="font-bold text-gray-700 flex items-center gap-2">
                                            <span className="bg-gray-800 text-white text-xs px-2 py-1 rounded">SECTION B</span>
                                            Profit Computation
                                        </h4>
                                        <div className="flex bg-gray-200 p-1 rounded-lg">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData(prev => ({ ...prev, isManual: false }));
                                                }}
                                                className={`px-3 py-1 text-xs font-bold rounded ${!formData.isManual ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                                            >
                                                Auto-Sync
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData(prev => ({ ...prev, isManual: true }));
                                                    toast.info("Manual Entry Mode Enabled: You can now type freely.");
                                                }}
                                                className={`px-3 py-1 text-xs font-bold rounded ${formData.isManual ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                                            >
                                                Manual Entry
                                            </button>
                                        </div>
                                    </div>
                                    <div className="bg-blue-50/50 border-b border-blue-100 p-4 flex justify-between items-center text-xs">
                                        <div className="flex items-center gap-2 text-blue-700 font-bold">
                                            {formData.isManual ? <FaCircleCheck /> : <FaRotate className={formData.isManual ? "" : "animate-spin-slow"} />}
                                            {formData.isManual ? "MANUAL OVERRIDE ACTIVE" : "System Ledger Sync Active"}
                                        </div>
                                        {!formData.isManual && (
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    const toastId = toast.loading("Fetching Financial Ledger...");
                                                    try {
                                                        const summary = await api.getFinancialYearSummary(formData.financialYear);
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            penalties: summary.breakdown?.fines || 0,
                                                        }));
                                                        toast.update(toastId, { render: "✅ Ledger Data Synced!", type: "success", isLoading: false, autoClose: 3000 });
                                                    } catch (e) {
                                                        toast.update(toastId, { render: "Sync Failed", type: "error", isLoading: false, autoClose: 3000 });
                                                    }
                                                }}
                                                className="text-blue-600 hover:text-blue-800 underline font-bold"
                                            >
                                                Force Refresh
                                            </button>
                                        )}
                                    </div>
                                    <div className="p-6 grid md:grid-cols-2 gap-8">

                                        {/* Income Column */}
                                        <div className="space-y-4">
                                            <h5 className="text-sm font-black text-gray-400 uppercase border-b border-gray-100 pb-2">Revenue Sources</h5>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 mb-1">Financial Year</label>
                                                    <input
                                                        type="number"
                                                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded font-bold text-gray-700 focus:ring-2 focus:ring-green-500 outline-none"
                                                        value={formData.financialYear}
                                                        onChange={(e) => setFormData({ ...formData, financialYear: parseInt(e.target.value) })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 mb-1">Banking Interest</label>
                                                    <input type="number" className="w-full p-2 border border-gray-200 rounded focus:ring-2 focus:ring-green-500 outline-none transition-all"
                                                        value={formData.bankingInterest} onChange={(e) => setFormData({ ...formData, bankingInterest: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 mb-1">STL Interest</label>
                                                    <input type="number" className="w-full p-2 border border-gray-200 rounded focus:ring-2 focus:ring-green-500 outline-none transition-all"
                                                        value={formData.stlInterest} onChange={(e) => setFormData({ ...formData, stlInterest: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 mb-1">LTL Interest</label>
                                                    <input type="number" className="w-full p-2 border border-gray-200 rounded focus:ring-2 focus:ring-green-500 outline-none transition-all"
                                                        value={formData.ltlInterest} onChange={(e) => setFormData({ ...formData, ltlInterest: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 mb-1">Penalties (Auto/Manual)</label>
                                                    <input
                                                        type="number"
                                                        className="w-full p-2 border border-gray-200 rounded focus:ring-2 focus:ring-green-500 outline-none transition-all"
                                                        value={formData.penalties}
                                                        onChange={(e) => setFormData({ ...formData, penalties: parseFloat(e.target.value) || 0 })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 mb-1">Other Income</label>
                                                    <input type="number" className="w-full p-2 border border-gray-200 rounded focus:ring-2 focus:ring-green-500 outline-none transition-all"
                                                        value={formData.otherIncome} onChange={(e) => setFormData({ ...formData, otherIncome: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                            </div>

                                            <div className="bg-green-50 p-3 rounded-lg border border-green-100 flex justify-between items-center">
                                                <span className="text-sm font-bold text-green-800">Total Revenue (TRF)</span>
                                                <span className="text-lg font-black text-green-700">
                                                    KES {(
                                                        (formData.bankingInterest || 0) +
                                                        (formData.stlInterest || 0) +
                                                        (formData.ltlInterest || 0) +
                                                        (formData.penalties || 0) +
                                                        (formData.otherIncome || 0)
                                                    ).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Deductions Column */}
                                        <div className="space-y-4">
                                            <h5 className="text-sm font-black text-gray-400 uppercase border-b border-gray-100 pb-2">Deductions</h5>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="col-span-2">
                                                    <label className="block text-xs font-bold text-gray-500 mb-1">Operating Expenses</label>
                                                    <input type="number" className="w-full p-2 border border-blue-200 bg-blue-50/50 rounded focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                        value={formData.operatingExpenses} onChange={(e) => setFormData({ ...formData, operatingExpenses: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 mb-1">Reserves (10%)</label>
                                                    <input type="number" className="w-full p-2 border border-gray-200 rounded text-gray-600"
                                                        value={formData.mandatoryReserves} onChange={(e) => setFormData({ ...formData, mandatoryReserves: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 mb-1">Risk Buffer (5%)</label>
                                                    <input type="number" className="w-full p-2 border border-gray-200 rounded text-gray-600"
                                                        value={formData.riskBuffer} onChange={(e) => setFormData({ ...formData, riskBuffer: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="block text-xs font-bold text-gray-500 mb-1">Reinvested Capital</label>
                                                    <input type="number" className="w-full p-2 border border-gray-200 rounded text-gray-600"
                                                        value={formData.reinvestedCapital} onChange={(e) => setFormData({ ...formData, reinvestedCapital: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                            </div>

                                            <div className="bg-red-50 p-3 rounded-lg border border-red-100 flex justify-between items-center">
                                                <span className="text-sm font-bold text-red-800">Total Deductions</span>
                                                <span className="text-lg font-black text-red-700">
                                                    KES {(
                                                        (formData.operatingExpenses || 0) +
                                                        (formData.mandatoryReserves || 0) +
                                                        (formData.riskBuffer || 0) +
                                                        (formData.reinvestedCapital || 0)
                                                    ).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION C: POLICY & CONFIRMATION */}
                                <div className="border border-gray-200 rounded-xl overflow-hidden">
                                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                                        <h4 className="font-bold text-gray-700 flex items-center gap-2">
                                            <span className="bg-gray-800 text-white text-xs px-2 py-1 rounded">SECTION C</span>
                                            Policy & Confirmation
                                        </h4>
                                    </div>
                                    <div className="p-6 flex items-center gap-6">
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Profit Share Percentage</label>
                                            <div className="flex items-center gap-2">
                                                <input type="number" className="w-24 p-3 border-2 border-purple-200 rounded-lg text-lg font-black text-purple-800 text-center"
                                                    value={formData.profitSharePercentage} onChange={(e) => setFormData({ ...formData, profitSharePercentage: parseFloat(e.target.value) || 75 })} />
                                                <span className="font-bold text-gray-400">%</span>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-2">Default is 75% for mature groups.</p>
                                        </div>

                                        <div className="flex-1 bg-gray-50 rounded-lg p-4 border border-gray-200">
                                            <div className="flex items-center gap-3">
                                                <FaCalculator className="text-3xl text-gray-300" />
                                                <div className="w-full">
                                                    <div className="text-xs font-bold text-gray-400 uppercase">Estimated Allocable Profit</div>
                                                    <div className="text-xl font-black text-gray-700">
                                                        KES {(
                                                            ((formData.bankingInterest || 0) +
                                                                (formData.stlInterest || 0) +
                                                                (formData.ltlInterest || 0) +
                                                                (formData.penalties || 0) +
                                                                (formData.otherIncome || 0)) -
                                                            ((formData.operatingExpenses || 0) +
                                                                (formData.mandatoryReserves || 0) +
                                                                (formData.riskBuffer || 0) +
                                                                (formData.reinvestedCapital || 0))
                                                        ).toLocaleString()}
                                                    </div>

                                                    {/* Real-time Calculator Preview (Manual Mode Only) */}
                                                    {formData.isManual && formData.totalAverageShares > 0 && (
                                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-xs font-bold text-blue-600 uppercase">Est. Rate:</span>
                                                                <span className="text-sm font-black text-blue-800">
                                                                    {(((((formData.bankingInterest || 0) + (formData.stlInterest || 0) + (formData.ltlInterest || 0) + (formData.penalties || 0) + (formData.otherIncome || 0)) - ((formData.operatingExpenses || 0) + (formData.mandatoryReserves || 0) + (formData.riskBuffer || 0) + (formData.reinvestedCapital || 0))) * (formData.profitSharePercentage / 100)) / formData.totalAverageShares * 100).toFixed(2)}%
                                                                </span>
                                                            </div>
                                                            <div className="text-[10px] text-gray-400">Based on manual shares</div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </form>
                        </div>

                        {/* Footer Actions */}
                        <div className="bg-gray-50 p-6 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 z-10">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateRun}
                                className="px-8 py-3 bg-safaricom-green text-white font-bold rounded-lg hover:bg-green-700 shadow-lg shadow-green-200 transition-all flex items-center gap-2"
                            >
                                <FaPlus /> Create Dividend Run
                            </button>
                        </div>
                    </div >
                </div >
            )
            }

            {/* DETAILS MODAL (INSTITUTIONAL REDESIGN) */}
            {
                showDetailsModal && selectedRun && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full p-0 my-8 overflow-hidden flex flex-col max-h-[95vh]">

                            {/* Header */}
                            <div className="bg-gray-50 border-b border-gray-100 p-6 flex justify-between items-center sticky top-0 z-10">
                                <div>
                                    <h3 className="text-2xl font-black text-gray-800 flex items-center gap-3">
                                        {selectedRun.run_number}
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border flex items-center gap-1 w-fit ${getStatusColor(selectedRun.status)}`}>
                                            {getStatusIcon(selectedRun.status)}
                                            {selectedRun.status}
                                        </span>
                                    </h3>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mt-1">
                                        Financial Year {selectedRun.financial_year} • Institutional Dividend Engine
                                    </p>
                                </div>
                                <button onClick={() => setShowDetailsModal(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                                    <FaCircleXmark size={28} />
                                </button>
                            </div>

                            <div className="p-8 overflow-y-auto custom-scrollbar space-y-8 bg-white">

                                {/* SECTION D: DIVIDEND RATE ENGINE */}
                                <div className="border border-gray-200 rounded-xl overflow-hidden">
                                    <div className="bg-purple-50 px-6 py-3 border-b border-purple-100 flex justify-between items-center">
                                        <h4 className="font-bold text-purple-900 flex items-center gap-2">
                                            <span className="bg-purple-800 text-white text-xs px-2 py-1 rounded">SECTION D</span>
                                            Dividend Rate Engine
                                        </h4>
                                        <span className="text-xs font-bold text-purple-600 flex items-center gap-1">
                                            <FaLock /> Read-Only • Derived
                                        </span>
                                    </div>
                                    <div className="p-6 grid grid-cols-4 gap-6 text-center">
                                        <div>
                                            <div className="text-xs font-bold text-gray-400 uppercase mb-1">Total Revenue</div>
                                            <div className="text-xl font-black text-gray-700">
                                                KES {(selectedRun.total_revenue_forecasted || 0).toLocaleString()}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-gray-400 uppercase mb-1">Net Distributable Profit</div>
                                            <div className="text-xl font-black text-green-600">
                                                KES {(selectedRun.total_payout || 0).toLocaleString()}
                                            </div>
                                            <div className="text-[10px] font-bold text-gray-400">
                                                ({selectedRun.profit_share_percentage}% of Profit)
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-gray-400 uppercase mb-1">Total Average Shares</div>
                                            <div className="text-xl font-black text-gray-700">
                                                {(selectedRun.total_average_shares || 0).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="bg-purple-100/50 rounded-lg py-2 border border-purple-100">
                                            <div className="text-xs font-bold text-purple-600 uppercase mb-1">Final Dividend Rate</div>
                                            <div className="text-3xl font-black text-purple-800">
                                                {((selectedRun.dividend_rate || 0) * 100).toFixed(4)}%
                                            </div>
                                            <div className="text-[10px] font-bold text-purple-400 uppercase">System Calculated</div>
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION E: MEMBER DISTRIBUTIONS */}
                                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                                        <h4 className="font-bold text-gray-700 flex items-center gap-2">
                                            <span className="bg-gray-800 text-white text-xs px-2 py-1 rounded">SECTION E</span>
                                            Member Dividend Distribution
                                        </h4>
                                        <div className="space-x-2">
                                            <button
                                                onClick={() => handleGeneratePDF(selectedRun)}
                                                className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded hover:bg-blue-100 transition-colors"
                                            >
                                                <FaFilePdf className="inline mr-1" /> Preview Statement
                                            </button>
                                            <button
                                                onClick={() => handleExportExcel(allocations, selectedRun)}
                                                className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded hover:bg-green-100 transition-colors"
                                            >
                                                <FaFileExcel className="inline mr-1" /> Export CSV
                                            </button>
                                        </div>
                                    </div>
                                    <div className="max-h-96 overflow-y-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-black text-gray-400 uppercase tracking-wider">Member Name</th>
                                                    <th className="px-6 py-3 text-right text-xs font-black text-gray-400 uppercase tracking-wider">Avg Shares</th>
                                                    <th className="px-6 py-3 text-right text-xs font-black text-gray-400 uppercase tracking-wider">Rate Applied</th>
                                                    <th className="px-6 py-3 text-right text-xs font-black text-gray-400 uppercase tracking-wider">Gross Dividend</th>
                                                    <th className="px-6 py-3 text-right text-xs font-black text-gray-400 uppercase tracking-wider">Tax/Ded</th>
                                                    <th className="px-6 py-3 text-right text-xs font-black text-safaricom-green uppercase tracking-wider">Net Payout</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {allocations.map((alloc) => (
                                                    <tr key={alloc.id} className="hover:bg-blue-50/30 transition-colors">
                                                        <td className="px-6 py-3 font-bold text-gray-700">
                                                            {alloc.members?.full_name || 'Unknown'}
                                                            <div className="text-[10px] text-gray-400">{alloc.members?.phone}</div>
                                                        </td>
                                                        <td className="px-6 py-3 text-right font-mono text-gray-600">
                                                            {(alloc.average_shares || 0).toLocaleString()}
                                                        </td>
                                                        <td className="px-6 py-3 text-right font-mono text-gray-400">
                                                            {((selectedRun.dividend_rate || 0) * 100).toFixed(4)}%
                                                        </td>
                                                        <td className="px-6 py-3 text-right font-mono font-bold text-gray-600">
                                                            KES {(alloc.gross_dividend || 0).toLocaleString()}
                                                        </td>
                                                        <td className="px-6 py-3 text-right font-mono text-red-400">
                                                            - KES 0.00
                                                        </td>
                                                        <td className="px-6 py-3 text-right font-mono font-black text-safaricom-green bg-green-50/30">
                                                            KES {(alloc.net_dividend || 0).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {/* Total Row */}
                                                <tr className="bg-gray-50 border-t-2 border-gray-200">
                                                    <td className="px-6 py-4 font-black text-gray-800 uppercase text-right">Total Distribution</td>
                                                    <td className="px-6 py-4 text-right font-mono font-bold text-gray-800">
                                                        {allocations.reduce((sum, a) => sum + (a.average_shares || 0), 0).toLocaleString()}
                                                    </td>
                                                    <td></td>
                                                    <td className="px-6 py-4 text-right font-mono font-bold text-gray-800">
                                                        KES {allocations.reduce((sum, a) => sum + (a.gross_dividend || 0), 0).toLocaleString()}
                                                    </td>
                                                    <td></td>
                                                    <td className="px-6 py-4 text-right font-mono font-black text-safaricom-green text-lg">
                                                        KES {allocations.reduce((sum, a) => sum + (a.net_dividend || 0), 0).toLocaleString()}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* SECTION F: APPROVAL & AUDIT */}
                                <div className="grid md:grid-cols-2 gap-8">
                                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                                        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                                            <h4 className="font-bold text-gray-700 flex items-center gap-2">
                                                <span className="bg-gray-800 text-white text-xs px-2 py-1 rounded">SECTION F</span>
                                                Approval Workflow
                                            </h4>
                                        </div>
                                        <div className="p-6 space-y-4">
                                            <div className="flex justify-between items-center text-sm border-b border-gray-100 pb-2">
                                                <span className="text-gray-500 font-bold">Prepared By:</span>
                                                <span className="font-mono">System (Automated)</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm border-b border-gray-100 pb-2">
                                                <span className="text-gray-500 font-bold">Reviewed By:</span>
                                                <span className="font-mono">Admin</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm pb-2">
                                                <span className="text-gray-500 font-bold">Approved By:</span>
                                                <span className="font-mono font-bold text-green-600">
                                                    {selectedRun.approved_at ? 'Director' : 'Pending...'}
                                                </span>
                                            </div>

                                            <div className="pt-4 flex gap-3">
                                                {selectedRun.status === 'CALCULATED' && user?.role === 'director' && (
                                                    <button
                                                        onClick={() => handleApprove(selectedRun.id)}
                                                        className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 flex items-center justify-center gap-2 shadow-lg shadow-green-200"
                                                    >
                                                        <FaCircleCheck /> Approve Dividends
                                                    </button>
                                                )}
                                                {selectedRun.status === 'APPROVED' && user?.role === 'director' && (
                                                    <button
                                                        onClick={() => handlePost(selectedRun.id)}
                                                        className="w-full py-3 bg-safaricom-green text-white rounded-lg font-bold hover:bg-green-700 flex items-center justify-center gap-2 shadow-lg shadow-green-200"
                                                    >
                                                        <FaMoneyBillWave /> Post to Member Ledgers
                                                    </button>
                                                )}
                                                {selectedRun.status === 'POSTED' && (
                                                    <div className="w-full py-3 bg-gray-100 text-gray-500 rounded-lg font-bold text-center flex items-center justify-center gap-2 cursor-not-allowed">
                                                        <FaLock /> Run Posted & Locked
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                                        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                                            <h4 className="font-bold text-gray-700 flex items-center gap-2">
                                                <FaShieldHalved className="text-gray-400" /> Audit Trail
                                            </h4>
                                        </div>
                                        <div className="p-6 space-y-3 text-xs font-mono text-gray-500 bg-gray-50/50 h-full">
                                            <div className="flex gap-2">
                                                <span className="text-gray-400">[{new Date(selectedRun.created_at).toLocaleString()}]</span>
                                                <span>Run Initialized (DRAFT)</span>
                                            </div>
                                            {selectedRun.calculated_at && (
                                                <div className="flex gap-2">
                                                    <span className="text-gray-400">[{new Date(selectedRun.calculated_at).toLocaleString()}]</span>
                                                    <span>Calculation Engine Executed</span>
                                                </div>
                                            )}
                                            {selectedRun.approved_at && (
                                                <div className="flex gap-2">
                                                    <span className="text-gray-400">[{new Date(selectedRun.approved_at).toLocaleString()}]</span>
                                                    <span className="text-green-600 font-bold">Director Approval Granted</span>
                                                </div>
                                            )}
                                            {selectedRun.posted_at && (
                                                <div className="flex gap-2">
                                                    <span className="text-gray-400">[{new Date(selectedRun.posted_at).toLocaleString()}]</span>
                                                    <span className="text-blue-600 font-bold">Transactions Posted to Ledger</span>
                                                </div>
                                            )}
                                            <div className="mt-4 pt-4 border-t border-gray-200 text-center italic text-gray-400">
                                                Hash: {selectedRun.id.split('-')[0]}... (Immutable)
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="bg-gray-50 p-6 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 z-10">
                                <button
                                    onClick={() => setShowDetailsModal(false)}
                                    className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 shadow-sm"
                                >
                                    Close View
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* QUICK REGISTER MEMBER MODAL */}
            {
                showAddMemberModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-slideUp">
                            <div className="bg-gray-900 px-6 py-4 flex justify-between items-center">
                                <h3 className="text-white font-bold flex items-center gap-2">
                                    <FaUserPlus className="text-green-400" /> Register New Member
                                </h3>
                                <button onClick={() => setShowAddMemberModal(false)} className="text-gray-400 hover:text-white">
                                    <FaCircleXmark size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Full Name</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border border-gray-300 rounded focus:border-green-500 outline-none font-bold"
                                        value={newMember.name}
                                        onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                                        placeholder="Enter full name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Phone Number</label>
                                    <input
                                        type="tel"
                                        className="w-full p-2 border border-gray-300 rounded focus:border-green-500 outline-none font-bold"
                                        value={newMember.phone}
                                        onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                                        placeholder="07..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Group</label>
                                    <select
                                        className="w-full p-2 border border-gray-300 rounded focus:border-green-500 outline-none font-bold bg-gray-50"
                                        value={newMember.groupId}
                                        onChange={(e) => setNewMember({ ...newMember, groupId: e.target.value })}
                                    >
                                        <option value="">Select Group</option>
                                        {groups.map(g => (
                                            <option key={g.id} value={g.id}>{g.group_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    onClick={async () => {
                                        if (!newMember.name || !newMember.phone || !newMember.groupId) {
                                            toast.warning("Please fill all fields");
                                            return;
                                        }
                                        try {
                                            await api.createMember({
                                                full_name: newMember.name,
                                                phone: newMember.phone,
                                                group_id: newMember.groupId
                                            });
                                            toast.success("✅ Member Added Successfully");

                                            // Refresh groups to update count
                                            const groupsData = await api.getGroups();
                                            setGroups(groupsData || []);

                                            // If the new member is in the currently selected group, verify count updates
                                            if (formData.groupId == newMember.groupId) {
                                                toast.info("Group member count updated.");
                                            }

                                            setShowAddMemberModal(false);
                                            setNewMember({ name: '', phone: '', groupId: '' });
                                        } catch (e) {
                                            console.error(e);
                                            toast.error("Failed to add member");
                                        }
                                    }}
                                    className="w-full bg-safaricom-green text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors shadow-lg flex justify-center items-center gap-2"
                                >
                                    <FaPlus /> Register Member
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default DividendManagement;
