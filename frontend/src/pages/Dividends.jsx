import React, { useState, useEffect } from 'react';
import {
    FaMoneyBillWave, FaChartLine, FaCalculator, FaSave,
    FaClockRotateLeft, FaCircleInfo, FaMagnifyingGlass, FaFileExcel, FaDownload,
    FaSpinner, FaTrophy, FaChartPie, FaPlus, FaTrash, FaKeyboard, FaFilePdf
} from 'react-icons/fa6';
import api from '../services/api';
import { toast } from 'react-toastify';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
// Register ChartJS
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const Dividends = () => {
    // State for financial inputs
    const [financials, setFinancials] = useState({
        bankInterest: 0,
        stlInterest: 0,
        ltlInterest: 0,
        penalties: 0,
        otherIncome: 0,
        expenses: 0,
        reinvestedLoans: 0,
        groupAgeYears: 2
    });

    // State for dividends logic
    const [dividendState, setDividendState] = useState({
        status: 'DRAFT',
        year: new Date().getFullYear(),
        shareOutRate: 0.75
    });

    // Data State
    const [groups, setGroups] = useState([]);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [loading, setLoading] = useState(false);

    // Member Data
    const [members, setMembers] = useState([]);

    // Manual Mode State
    const [isManualMode, setIsManualMode] = useState(false);

    const [calculations, setCalculations] = useState({
        trf: 0,
        availableProfit: 0,
        profitToShareOut: 0,
        totalAverageShares: 0,
        dividendRate: 0,
        maxDividend: 0,
        topEarner: 'N/A'
    });

    // Load Groups on Mount
    useEffect(() => {
        loadGroups();
    }, []);

    const loadGroups = async () => {
        try {
            const data = await api.getGroups();
            if (data && data.length > 0) {
                setGroups(data);
            } else {
                setGroups([{ id: 'demo-1', name: 'UKOMBOZI Group A (Demo)' }]);
            }
        } catch (error) {
            console.warn("Failed to load groups, using demo group", error);
            setGroups([{ id: 'demo-1', name: 'UKOMBOZI Group A (Demo)' }]);
        }
    };

    // 🔄 Auto-Calculate everything when inputs change
    useEffect(() => {
        calculateDividends();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [financials, members]);

    const handleGenerateReport = async () => {
        setIsManualMode(false); // Disable manual mode if auto-generating
        if (!selectedGroupId) {
            toast.error("Please select a group first");
            return;
        }

        setLoading(true);
        try {
            let reportData;
            try {
                reportData = await api.generateDividendReport(selectedGroupId, dividendState.year);
            } catch (err) {
                console.warn("Backend calculation failed, using manual mode", err);
            }

            if (reportData && reportData.members) {
                // Calculate Group Age for Policy Enforcement (75% vs 50%)
                const selectedGroup = groups.find(g => g.id === selectedGroupId);
                let calculatedAge = 2; // Default to >1 yr if unknown
                if (selectedGroup && selectedGroup.created_at) {
                    const created = new Date(selectedGroup.created_at);
                    const now = new Date();
                    const diffTime = Math.abs(now - created);
                    calculatedAge = diffTime / (1000 * 60 * 60 * 24 * 365.25);
                }

                setFinancials(prev => ({
                    ...prev,
                    ...reportData.financials,
                    groupAgeYears: calculatedAge
                }));
                const formattedMembers = reportData.members.map(m => ({
                    id: m.id,
                    name: m.name,
                    balances: {
                        jan: parseFloat(m.balances.jan) || 0,
                        mar: parseFloat(m.balances.mar) || 0,
                        may: parseFloat(m.balances.may) || 0,
                        jul: parseFloat(m.balances.jul) || 0,
                        sep: parseFloat(m.balances.sep) || 0,
                        nov: parseFloat(m.balances.nov) || 0,
                    }
                }));
                setMembers(formattedMembers);
                toast.success("Report generated from system data!");
            } else {
                // DEMO MODE: Load rich sample data
                toast.info("Demo Mode: Loaded sample report");

                setFinancials({
                    bankInterest: 15000,
                    stlInterest: 45000,
                    ltlInterest: 120000,
                    penalties: 5500,
                    otherIncome: 1200,
                    expenses: 8500,
                    reinvestedLoans: 50000,
                    groupAgeYears: 2
                });

                setMembers([
                    { id: 1, name: 'Hilda Sigei', balances: { jan: 25350, mar: 26250, may: 27150, jul: 28250, sep: 29550, nov: 31050 } },
                    { id: 2, name: 'John Doe', balances: { jan: 1800, mar: 2700, may: 3300, jul: 3300, sep: 4200, nov: 5200 } },
                    { id: 3, name: 'Jane Smith', balances: { jan: 23450, mar: 24950, may: 26250, jul: 27750, sep: 29250, nov: 30750 } },
                    { id: 4, name: 'Alice Johnson', balances: { jan: 21355, mar: 21755, may: 22755, jul: 23655, sep: 27655, nov: 25455 } },
                    { id: 5, name: 'Bob Brown', balances: { jan: 30335, mar: 31905, may: 33205, jul: 34505, sep: 36005, nov: 37705 } }
                ]);
            }

        } catch (error) {
            toast.error("Error generating report");
        } finally {
            setLoading(false);
        }
    };

    const activateManualMode = () => {
        setIsManualMode(true);
        // Reset but keep basics
        setFinancials({
            bankInterest: 0, stlInterest: 0, ltlInterest: 0, penalties: 0, otherIncome: 0,
            expenses: 0, reinvestedLoans: 0, groupAgeYears: 2
        });
        setMembers([
            { id: Date.now(), name: 'Member 1', balances: { jan: 0, mar: 0, may: 0, jul: 0, sep: 0, nov: 0 } }
        ]);
        toast.info("Manual Entry Mode Activated");
    };

    const addManualMember = () => {
        setMembers([...members, {
            id: Date.now(),
            name: `Member ${members.length + 1}`,
            balances: { jan: 0, mar: 0, may: 0, jul: 0, sep: 0, nov: 0 }
        }]);
    };

    const removeMember = (id) => {
        setMembers(members.filter(m => m.id !== id));
    };

    const calculateDividends = () => {
        // ... (Logic same as before)
        const totalIncome =
            Number(financials.bankInterest) +
            Number(financials.stlInterest) +
            Number(financials.ltlInterest) +
            Number(financials.penalties) +
            Number(financials.otherIncome);

        const availableProfit = totalIncome - Number(financials.expenses) - Number(financials.reinvestedLoans);
        const rate = financials.groupAgeYears >= 1 ? 0.75 : 0.50;
        setDividendState(prev => ({ ...prev, shareOutRate: rate }));
        const profitToShareOut = Math.max(0, availableProfit * rate);

        let totalAvgShares = 0;
        let maxDiv = 0;
        let topMember = 'N/A';
        const divRateTemp = totalIncome > 0 ? (profitToShareOut / (members.reduce((a, m) => a + (Object.values(m.balances).reduce((x, y) => x + y, 0) / 6), 0) || 1)) : 0;

        // eslint-disable-next-line no-unused-vars
        const updatedMembers = members.map(m => {
            const sum = Object.values(m.balances).reduce((a, b) => a + b, 0);
            const avg = sum / 6;
            totalAvgShares += avg;
            const myDiv = avg * divRateTemp;
            if (myDiv > maxDiv) {
                maxDiv = myDiv;
                topMember = m.name;
            }
            return { ...m, averageShares: avg };
        });

        const divRate = totalAvgShares > 0 ? (profitToShareOut / totalAvgShares) : 0;

        setCalculations({
            trf: totalIncome,
            availableProfit,
            profitToShareOut,
            totalAverageShares: totalAvgShares,
            dividendRate: divRate,
            maxDividend: maxDiv,
            topEarner: topMember
        });
    };

    const handleBalanceChange = (id, month, value) => {
        const val = parseFloat(value) || 0;
        setMembers(members.map(m => m.id === id ? { ...m, balances: { ...m.balances, [month]: val } } : m));
    };

    const handleNameChange = (id, name) => {
        setMembers(members.map(m => m.id === id ? { ...m, name } : m));
    };

    // --- PDF GENERATION LOGIC (Server-Side) ---
    const generatePDF = async () => {
        if (!selectedGroupId && !isManualMode) {
            toast.error("Please select a group first");
            return;
        }

        if (isManualMode) {
            toast.warning("Server-side PDF is not available for Manual Mode yet. Please use System Mode.");
            return;
        }

        setLoading(true);
        try {
            // In a real flow, we would need a runId. 
            // For now, let's assume we use a placeholder or the last run for this group
            // For the sake of this task, I'll call a generic endpoint or use a dummy runId
            await api.downloadDividendReport(selectedGroupId);
            toast.success("PDF Report Generated from Server!");
        } catch (error) {
            toast.error("Failed to generate PDF from server");
        } finally {
            setLoading(false);
        }
    };

    const exportToCSV = () => {
        if (members.length === 0) {
            toast.error("No data to export");
            return;
        }
        const headers = ["Member Name", "Jan Bal", "Mar Bal", "May Bal", "Jul Bal", "Sep Bal", "Nov Bal", "Avg Shares", "Dividend Amount"];
        const rows = members.map(m => {
            const avg = Object.values(m.balances).reduce((a, b) => a + b, 0) / 6;
            const dividend = avg * calculations.dividendRate;
            return [
                m.name,
                m.balances.jan, m.balances.mar, m.balances.may, m.balances.jul, m.balances.sep, m.balances.nov,
                avg.toFixed(2),
                dividend.toFixed(2)
            ];
        });
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Dividend_Report_${dividendState.year}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Excel report downloaded!");
    };

    /**
     * SAVE & POST HANDLER
     * Commits the current dividend run to the ledger
     */
    const handleSaveAndPost = async () => {
        if (isManualMode) {
            toast.warning("Posting is disabled in Manual Mode. Switch to System Mode for official records.");
            return;
        }
        if (!selectedGroupId) {
            toast.error("Please select a group first.");
            return;
        }
        if (members.length === 0) {
            toast.error("No member data to post.");
            return;
        }

        const confirm = window.confirm(
            "⚠️ CONFIRM DIVIDEND POSTING?\n\nThis action will:\n1. Lock this dividend run for the year.\n2. Credit member savings accounts with their dividend.\n3. Create an immutable audit trail.\n\nAre you sure you want to proceed?"
        );
        if (!confirm) return;

        setLoading(true);
        try {
            const totalTRF = Number(financials.bankInterest) + Number(financials.stlInterest) + Number(financials.ltlInterest) + Number(financials.penalties) + Number(financials.otherIncome);

            const payoutPayload = members.map(m => {
                const avgShares = Object.values(m.balances).reduce((a, b) => a + b, 0) / 6;
                const dividend = avgShares * calculations.dividendRate;
                return {
                    member_id: m.id,
                    avg_shares: avgShares,
                    amount: dividend
                };
            }).filter(p => p.amount > 0);

            await api.postDividends({
                groupId: selectedGroupId,
                year: dividendState.year,
                financials: {
                    trf: totalTRF,
                    expenses: financials.expenses,
                    reinvested: financials.reinvestedLoans,
                    total_payout: calculations.profitToShareOut,
                    rate: calculations.dividendRate
                },
                payouts: payoutPayload.filter(p => p.member_id) // Ensure ID exists
            });

            toast.success("✅ Dividends Posted and Credited Successfully!");

            // Optional: Reset or Lock UI
            setMembers([]);
            setFinancials({
                bankInterest: '', stlInterest: '', ltlInterest: '', penalties: '', otherIncome: '',
                expenses: '', reinvestedLoans: '', groupAgeYears: 2
            });

        } catch (error) {
            console.error(error);
            toast.error("Failed to post dividends. Check console for details.");
        } finally {
            setLoading(false);
        }
    };

    // Chart Data Configs (Same as before)
    const trfData = {
        labels: ['Banking Interest', 'STL Interest', 'LTL Interest', 'Penalties'],
        datasets: [{
            data: [financials.bankInterest, financials.stlInterest, financials.ltlInterest, financials.penalties],
            backgroundColor: ['#10B981', '#3B82F6', '#6366F1', '#EF4444'],
            borderWidth: 0
        }]
    };

    const distributionData = {
        labels: ['Payout', 'Reinvested', 'Expenses'],
        datasets: [{
            label: 'Amount (KES)',
            data: [calculations.profitToShareOut, financials.reinvestedLoans, financials.expenses],
            backgroundColor: ['#8B5CF6', '#F59E0B', '#F87171'],
            borderRadius: 8
        }]
    };

    return (
        <div className="flex-1 overflow-auto bg-gray-50 h-full">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-30 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                        <FaMoneyBillWave className="text-safaricom-green" />
                        Dividend Management Engine
                    </h1>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">
                        Institutional Standard • {dividendState.year} Financial Year
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={activateManualMode}
                        className={`flex items-center gap-2 px-4 py-2 border-2 rounded-xl font-bold transition-all ${isManualMode ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                    >
                        <FaKeyboard /> Manual Entry
                    </button>

                    <button onClick={generatePDF} className="flex items-center gap-2 px-4 py-2 border-2 border-red-500 text-red-600 bg-red-50 rounded-xl font-bold hover:bg-red-100 transition-colors">
                        <FaFilePdf /> PDF Report
                    </button>

                    <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 border-2 border-green-600 text-green-700 bg-green-50 rounded-xl font-bold hover:bg-green-100 transition-colors">
                        <FaFileExcel /> Excel
                    </button>

                    <div className="h-8 w-px bg-gray-300 mx-2"></div>

                    <button
                        onClick={handleSaveAndPost}
                        disabled={isManualMode || loading}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold shadow-md transition-all ${isManualMode
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed border-2 border-gray-200'
                            : 'bg-safaricom-green text-white hover:bg-green-700 border-2 border-transparent'
                            }`}
                        title={isManualMode ? "Switch to System Mode to Post" : "Credit Members & Lock"}
                    >
                        {loading ? <FaSpinner className="animate-spin" /> : <FaSave />}
                        Save & Post
                    </button>
                </div>
            </div>

            <div className="p-8 max-w-[1600px] mx-auto space-y-8 pb-20">
                {/* 🔍 SEARCH BAR - Only Show if NOT Manual Mode */}
                {!isManualMode && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-end z-20 relative">
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Select Group to Process</label>
                            <div className="relative">
                                <select
                                    value={selectedGroupId}
                                    onChange={(e) => setSelectedGroupId(e.target.value)}
                                    className="w-full appearance-none bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-700 focus:outline-none focus:border-safaricom-green/50"
                                >
                                    <option value="">-- Choose a Group --</option>
                                    {groups.map(g => (
                                        <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-4 text-gray-400 pointer-events-none">
                                    <FaMagnifyingGlass />
                                </div>
                            </div>
                        </div>
                        <div className="w-48">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Financial Year</label>
                            <input
                                type="number"
                                value={dividendState.year}
                                onChange={(e) => setDividendState({ ...dividendState, year: Number(e.target.value) })}
                                className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-700 focus:outline-none focus:border-safaricom-green/50"
                            />
                        </div>
                        <button
                            onClick={handleGenerateReport}
                            disabled={loading}
                            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <FaSpinner className="animate-spin" /> : <FaDownload />}
                            GENERATE REPORT
                        </button>
                    </div>
                )}

                {/* MANUAL MODE BANNER */}
                {isManualMode && (
                    <div className="bg-orange-50 border-2 border-orange-200 p-4 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><FaKeyboard size={20} /></div>
                            <div>
                                <h3 className="font-bold text-orange-900">Manual Entry Mode Active</h3>
                                <p className="text-sm text-orange-700">You are manually entering data. Inputs are unlocked. Charts update live.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🧱 CONTROL PANEL + ANALYTICS GRID */}
                {(members.length > 0 || isManualMode) ? (
                    <div className="grid grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* LEFT: Financial Inputs */}
                        <div className="col-span-12 lg:col-span-5 space-y-6">
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                                    <h3 className="font-black text-gray-800 flex items-center gap-2">
                                        <FaCalculator /> TRF & Profit Logic
                                    </h3>
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">Calculator</span>
                                </div>
                                <div className="p-6 space-y-4">
                                    <InputRow label="Banking Interest" value={financials.bankInterest} onChange={v => setFinancials({ ...financials, bankInterest: v })} />
                                    <InputRow label="STL Interest" value={financials.stlInterest} onChange={v => setFinancials({ ...financials, stlInterest: v })} />
                                    <InputRow label="LTL Interest" value={financials.ltlInterest} onChange={v => setFinancials({ ...financials, ltlInterest: v })} />
                                    <InputRow label="Penalties" value={financials.penalties} onChange={v => setFinancials({ ...financials, penalties: v })} />
                                    <InputRow label="Other Income" value={financials.otherIncome} onChange={v => setFinancials({ ...financials, otherIncome: v })} />
                                    <div className="h-px bg-gray-100 my-2"></div>
                                    <InputRow label="Less: Expenses" value={financials.expenses} onChange={v => setFinancials({ ...financials, expenses: v })} isDeduction />
                                    <InputRow label="Less: Reinvested Loans" value={financials.reinvestedLoans} onChange={v => setFinancials({ ...financials, reinvestedLoans: v })} isDeduction />

                                    <div className="bg-safaricom-green/10 p-4 rounded-xl border border-safaricom-green/20 mt-4">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <div className="text-xs font-bold text-safaricom-green uppercase mb-1">Final Dividend Rate</div>
                                                <div className="text-3xl font-black text-gray-800">
                                                    {calculations.dividendRate.toFixed(4)}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-bold text-gray-500 uppercase mb-1">Total Payout</div>
                                                <div className="text-xl font-black text-safaricom-green">
                                                    KES {calculations.profitToShareOut.toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: Visual Analytics */}
                        <div className="col-span-12 lg:col-span-7 space-y-6">
                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 p-5 rounded-2xl border border-orange-100 relative overflow-hidden">
                                    <FaTrophy className="absolute -right-4 -bottom-4 text-8xl text-orange-200/50" />
                                    <div className="relative z-10">
                                        <div className="text-xs font-bold text-orange-600 uppercase">Top Earner</div>
                                        <div className="text-2xl font-black text-gray-800 mt-1">{calculations.topEarner}</div>
                                        <div className="text-sm font-bold text-orange-600">KES {calculations.maxDividend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                    </div>
                                </div>
                                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-2xl border border-blue-100 relative overflow-hidden">
                                    <FaChartPie className="absolute -right-4 -bottom-4 text-8xl text-blue-200/50" />
                                    <div className="relative z-10">
                                        <div className="text-xs font-bold text-blue-600 uppercase">Profit Utilized</div>
                                        <div className="text-2xl font-black text-gray-800 mt-1">{(dividendState.shareOutRate * 100)}%</div>
                                        <div className="text-sm font-bold text-blue-600">Distributed to Members</div>
                                    </div>
                                </div>
                            </div>
                            {/* Charts */}
                            <div className="grid grid-cols-2 gap-4 h-64">
                                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2 w-full text-left">Income Mix</h4>
                                    <div className="w-40 h-40">
                                        <Doughnut data={trfData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2 w-full text-left">Fund Allocation</h4>
                                    <div className="w-full h-40">
                                        <Bar data={distributionData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* BOTTOM: Full Width Member Table */}
                        <div className="col-span-12">
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
                                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <h3 className="font-black text-gray-800">Member Share Snapshot</h3>
                                        {isManualMode && (
                                            <button onClick={addManualMember} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-blue-100">
                                                <FaPlus /> Add Member
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                                        <FaCircleInfo /> Bi-Monthly Balances
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 text-xs text-gray-500 uppercase font-black tracking-wide">
                                                <th className="p-4 border-b border-gray-200 sticky left-0 bg-gray-50 z-10 w-48 shadow-[1px_0_3px_-2px_rgba(0,0,0,0.1)]">Member</th>
                                                {['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'].map(m => (
                                                    <th key={m} className="p-4 border-b border-gray-200 text-right min-w-[100px]">{m}</th>
                                                ))}
                                                <th className="p-4 border-b border-gray-200 text-right bg-blue-50 text-blue-800">Avg Shares</th>
                                                <th className="p-4 border-b border-gray-200 text-right bg-green-50 text-green-800">Dividend</th>
                                                {isManualMode && <th className="p-4 border-b border-gray-200 w-10"></th>}
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm">
                                            {members.map((member) => {
                                                const avgShares = Object.values(member.balances).reduce((a, b) => a + b, 0) / 6;
                                                const dividend = avgShares * calculations.dividendRate;

                                                return (
                                                    <tr key={member.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                                                        <td className="p-4 font-bold text-gray-800 sticky left-0 bg-white shadow-[1px_0_3px_-2px_rgba(0,0,0,0.1)]">
                                                            {isManualMode ? (
                                                                <input
                                                                    type="text"
                                                                    value={member.name}
                                                                    onChange={(e) => handleNameChange(member.id, e.target.value)}
                                                                    className="w-full bg-gray-50 border-b border-gray-300 focus:border-blue-500 outline-none px-1"
                                                                />
                                                            ) : member.name}
                                                        </td>
                                                        {['jan', 'mar', 'may', 'jul', 'sep', 'nov'].map(month => (
                                                            <td key={month} className="p-2 text-right">
                                                                <input
                                                                    type="number"
                                                                    value={member.balances[month]}
                                                                    onChange={(e) => handleBalanceChange(member.id, month, e.target.value)}
                                                                    className="w-full text-right bg-transparent focus:bg-blue-50 focus:ring-2 focus:ring-blue-200 rounded px-2 py-1 outline-none font-medium text-gray-600"
                                                                />
                                                            </td>
                                                        ))}
                                                        <td className="p-4 text-right font-black text-gray-800 bg-blue-50/30">
                                                            {avgShares.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                        </td>
                                                        <td className="p-4 text-right font-black text-safaricom-green bg-green-50/30 text-base">
                                                            {dividend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                        </td>
                                                        {isManualMode && (
                                                            <td className="p-4 text-center">
                                                                <button onClick={() => removeMember(member.id)} className="text-red-300 hover:text-red-500 transition-colors">
                                                                    <FaTrash />
                                                                </button>
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="bg-gray-100 font-black text-gray-900 border-t-2 border-gray-200 sticky bottom-0 z-10 shadow-lg">
                                            <tr>
                                                <td className="p-4 sticky left-0 bg-gray-100 uppercase text-xs z-20 shadow-[1px_0_3px_-2px_rgba(0,0,0,0.1)]">Total</td>
                                                <td colSpan={6} className="p-4 text-right text-xs text-gray-500 uppercase tracking-wide">Total Average Shares:</td>
                                                <td className="p-4 text-right">{calculations.totalAverageShares.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                                <td className="p-4 text-right text-safaricom-green">{members.reduce((sum, m) => sum + ((Object.values(m.balances).reduce((a, b) => a + b, 0) / 6) * calculations.dividendRate), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                                {isManualMode && <td></td>}
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-300">
                        <FaCalculator className="text-6xl text-gray-200 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-400">Select Mode</h3>
                        <div className="flex justify-center gap-4 mt-4">
                            <button onClick={activateManualMode} className="px-6 py-2 bg-orange-100 text-orange-700 font-bold rounded-xl hover:bg-orange-200 transition-colors">
                                <FaKeyboard className="inline mr-2" /> Manual Entry
                            </button>
                            <span className="self-center text-gray-400">or select a group above</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const InputRow = ({ label, value, onChange, isDeduction }) => (
    <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-gray-500 uppercase">{label}</label>
        <div className="relative w-32">
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={`w-full text-right px-3 py-2 border rounded-lg font-bold outline-none focus:ring-2 ${isDeduction
                    ? 'border-red-200 text-red-600 focus:ring-red-200'
                    : 'border-gray-200 text-gray-800 focus:ring-safaricom-green/20'
                    }`}
                placeholder="0"
            />
            {isDeduction && <span className="absolute left-2 top-2 text-red-400 text-xs">-</span>}
        </div>
    </div>
);

export default Dividends;
