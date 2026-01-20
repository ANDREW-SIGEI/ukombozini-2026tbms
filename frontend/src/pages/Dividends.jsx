import React, { useState, useEffect } from 'react';
import {
    FaMoneyBillWave, FaChartLine, FaCalculator, FaSave,
    FaHistory, FaInfoCircle, FaSearch, FaFileExcel, FaDownload, FaSpinner
} from 'react-icons/fa';
import api from '../services/api';
import { toast } from 'react-toastify';

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

    // Member Data (Initialized with empty or mock)
    const [members, setMembers] = useState([]);

    const [calculations, setCalculations] = useState({
        trf: 0,
        availableProfit: 0,
        profitToShareOut: 0,
        totalAverageShares: 0,
        dividendRate: 0
    });

    // Load Groups on Mount
    useEffect(() => {
        loadGroups();
    }, []);

    const loadGroups = async () => {
        try {
            const data = await api.getGroups();
            if (data) setGroups(data);
        } catch (error) {
            console.error("Failed to load groups", error);
        }
    };

    // 🔄 Auto-Calculate everything when inputs change
    useEffect(() => {
        calculateDividends();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [financials, members]);

    const handleGenerateReport = async () => {
        if (!selectedGroupId) {
            toast.error("Please select a group first");
            return;
        }

        setLoading(true);
        try {
            // Attempt to fetch real data from backend
            // Note: If RPC is not set up, this might fail, so we catch error
            let reportData;
            try {
                reportData = await api.generateDividendReport(selectedGroupId, dividendState.year);
            } catch (err) {
                console.warn("Backend calculation failed, using manual mode", err);
            }

            if (reportData && reportData.members) {
                // Populate from Backend
                setFinancials(prev => ({
                    ...prev,
                    ...reportData.financials
                }));
                // Map backend member data to frontend structure
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
                // FALLBACK: Load mock data if no real data found (for testing)
                toast.info("No data found for this period. Loaded template.");
                setMembers([
                    { id: 1, name: 'Hilda Sigei', balances: { jan: 0, mar: 0, may: 0, jul: 0, sep: 0, nov: 0 } },
                    { id: 2, name: 'John Doe', balances: { jan: 0, mar: 0, may: 0, jul: 0, sep: 0, nov: 0 } },
                    // ... empty template
                ]);
            }

        } catch (error) {
            toast.error("Error generating report");
        } finally {
            setLoading(false);
        }
    };

    const calculateDividends = () => {
        // 1. Calculate TRF
        const totalIncome =
            Number(financials.bankInterest) +
            Number(financials.stlInterest) +
            Number(financials.ltlInterest) +
            Number(financials.penalties) +
            Number(financials.otherIncome);

        // 2. Available Profit (AP)
        const availableProfit = totalIncome - Number(financials.expenses) - Number(financials.reinvestedLoans);

        // 3. Share Out Rate Rule
        const rate = financials.groupAgeYears >= 1 ? 0.75 : 0.50;
        setDividendState(prev => ({ ...prev, shareOutRate: rate }));

        // 4. Profit to Share Out (PSO)
        const profitToShareOut = Math.max(0, availableProfit * rate);

        // 5. Calculate Average Shares
        let totalAvgShares = 0;
        // eslint-disable-next-line no-unused-vars
        const updatedMembers = members.map(m => {
            const sum = Object.values(m.balances).reduce((a, b) => a + b, 0);
            const avg = sum / 6;
            totalAvgShares += avg;
            return { ...m, averageShares: avg };
        });

        // 6. Dividend Rate
        const divRate = totalAvgShares > 0 ? (profitToShareOut / totalAvgShares) : 0;

        setCalculations({
            trf: totalIncome,
            availableProfit,
            profitToShareOut,
            totalAverageShares: totalAvgShares,
            dividendRate: divRate
        });
    };

    const handleBalanceChange = (id, month, value) => {
        if (dividendState.status !== 'DRAFT') return;
        const val = parseFloat(value) || 0;
        setMembers(members.map(m => m.id === id ? { ...m, balances: { ...m.balances, [month]: val } } : m));
    };

    const exportToCSV = () => {
        if (members.length === 0) {
            toast.error("No data to export");
            return;
        }

        // Headers
        const headers = ["Member Name", "Jan Bal", "Mar Bal", "May Bal", "Jul Bal", "Sep Bal", "Nov Bal", "Avg Shares", "Dividend Amount"];

        // Rows
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

        // Convert to CSV string
        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        // Download link
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Dividend_Report_${dividendState.year}_${selectedGroupId}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Excel report downloaded!");
    };

    return (
        <div className="flex-1 overflow-auto bg-gray-50 h-full">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
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
                    <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 border-2 border-green-600 text-green-700 bg-green-50 rounded-xl font-bold hover:bg-green-100 transition-colors">
                        <FaFileExcel /> Export Excel
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-safaricom-green text-white rounded-xl font-bold hover:bg-green-700 shadow-md">
                        <FaSave /> Save & Post
                    </button>
                </div>
            </div>

            <div className="p-8 max-w-[1600px] mx-auto space-y-8">

                {/* 🔍 SEARCH & GENERATE BAR */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-end">
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
                                <FaSearch />
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

                {/* 🧱 CONTROL PANEL GRID */}
                {members.length > 0 ? (
                    <div className="grid grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* LEFT: Financial Inputs */}
                        <div className="col-span-12 lg:col-span-4 space-y-6">
                            {/* ... same as before, simplified for brevity ... */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                                    <h3 className="font-black text-gray-800 flex items-center gap-2">
                                        <FaCalculator /> Total Return Fund (TRF)
                                    </h3>
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">Income</span>
                                </div>
                                <div className="p-6 space-y-4">
                                    <InputRow label="Banking Interest" value={financials.bankInterest} onChange={v => setFinancials({ ...financials, bankInterest: v })} />
                                    <InputRow label="STL Interest" value={financials.stlInterest} onChange={v => setFinancials({ ...financials, stlInterest: v })} />
                                    <InputRow label="LTL Interest" value={financials.ltlInterest} onChange={v => setFinancials({ ...financials, ltlInterest: v })} />
                                    <InputRow label="Penalties" value={financials.penalties} onChange={v => setFinancials({ ...financials, penalties: v })} />
                                    <InputRow label="Other Income" value={financials.otherIncome} onChange={v => setFinancials({ ...financials, otherIncome: v })} />

                                    <div className="pt-4 border-t border-gray-100">
                                        <div className="flex justify-between items-center bg-green-50 p-3 rounded-lg border border-green-100">
                                            <span className="font-black text-green-800 uppercase text-xs">Total TRF</span>
                                            <span className="font-black text-xl text-green-700">KES {calculations.trf.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                                    <h3 className="font-black text-gray-800 flex items-center gap-2">
                                        <FaChartLine /> Profit Logic
                                    </h3>
                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-bold">Distribution</span>
                                </div>
                                <div className="p-6 space-y-4">
                                    <InputRow label="Less: Expenses" value={financials.expenses} onChange={v => setFinancials({ ...financials, expenses: v })} isDeduction />
                                    <InputRow label="Less: Reinvested Loans" value={financials.reinvestedLoans} onChange={v => setFinancials({ ...financials, reinvestedLoans: v })} isDeduction />

                                    <div className="h-px bg-gray-100 my-2"></div>

                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-500 uppercase">Available Profit</span>
                                        <span className="font-black text-gray-900">KES {calculations.availableProfit.toLocaleString()}</span>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-500 uppercase">Group Age</span>
                                        <select
                                            value={financials.groupAgeYears}
                                            onChange={(e) => setFinancials({ ...financials, groupAgeYears: Number(e.target.value) })}
                                            className="text-xs font-bold bg-gray-100 border-none rounded p-1"
                                        >
                                            <option value={0}>&lt; 1 Year (50%)</option>
                                            <option value={2}>&gt; 1 Year (75%)</option>
                                        </select>
                                    </div>

                                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-bold text-purple-800 uppercase">Profit to Share Out</span>
                                            <span className="text-xs font-bold text-purple-600 bg-white px-2 rounded-full">
                                                {(dividendState.shareOutRate * 100)}%
                                            </span>
                                        </div>
                                        <div className="text-2xl font-black text-purple-700">
                                            KES {calculations.profitToShareOut.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </div>
                                    </div>

                                    <div className="bg-safaricom-green p-4 rounded-xl text-white shadow-lg">
                                        <div className="text-xs font-bold opacity-80 uppercase mb-1">Final Dividend Rate</div>
                                        <div className="text-4xl font-black">
                                            {calculations.dividendRate.toFixed(4)}
                                        </div>
                                        <div className="text-[10px] opacity-80 mt-1">
                                            KES {calculations.dividendRate.toFixed(4)} per 1 Share Unit
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: Member Table */}
                        <div className="col-span-12 lg:col-span-8">
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
                                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                                    <h3 className="font-black text-gray-800">Member Share Snapshot</h3>
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                                        <FaInfoCircle /> Bi-Monthly Balances
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
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm">
                                            {members.map((member) => {
                                                const avgShares = Object.values(member.balances).reduce((a, b) => a + b, 0) / 6;
                                                const dividend = avgShares * calculations.dividendRate;

                                                return (
                                                    <tr key={member.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                                                        <td className="p-4 font-bold text-gray-800 sticky left-0 bg-white shadow-[1px_0_3px_-2px_rgba(0,0,0,0.1)]">{member.name}</td>
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
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="bg-gray-100 font-black text-gray-900 border-t-2 border-gray-200 sticky bottom-0 z-10 shadow-lg">
                                            <tr>
                                                <td className="p-4 sticky left-0 bg-gray-100 uppercase text-xs z-20 shadow-[1px_0_3px_-2px_rgba(0,0,0,0.1)]">Total</td>
                                                <td colSpan={6} className="p-4 text-right text-xs text-gray-500 uppercase tracking-wide">
                                                    Total Average Shares:
                                                </td>
                                                <td className="p-4 text-right">{calculations.totalAverageShares.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                                <td className="p-4 text-right text-safaricom-green">{members.reduce((sum, m) =>
                                                    sum + ((Object.values(m.balances).reduce((a, b) => a + b, 0) / 6) * calculations.dividendRate), 0
                                                ).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
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
                        <h3 className="text-xl font-bold text-gray-400">Select a Group & Generate Report</h3>
                        <p className="text-gray-400">Select a group above to calculate dividends according to institutional rules.</p>
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
