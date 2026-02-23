import React, { useState } from 'react';
import { api } from '../services/api';
import { Calendar, Search, FileText, Smartphone, Download, X, ArrowRight, TrendingUp } from 'lucide-react';
import { toast } from 'react-toastify';

const AuditorMode = () => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [snapshot, setSnapshot] = useState(null);
    const [filterGroup, setFilterGroup] = useState('');
    const [selectedMember, setSelectedMember] = useState(null);
    const [trail, setTrail] = useState([]);
    const [trailLoading, setTrailLoading] = useState(false);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const data = await api.getAuditSnapshot(date);
            setSnapshot(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDrillDown = async (member) => {
        setSelectedMember(member);
        setTrailLoading(true);
        try {
            const data = await api.getAuditTrail(member.id, date);
            setTrail(data || []);
        } catch (error) {
            toast.error("Failed to load transaction trail");
        } finally {
            setTrailLoading(false);
        }
    };

    const handleExportCSV = () => {
        if (!snapshot) return;
        const headers = ['Member', 'Group', 'Savings (Audit)', 'Savings Discrepancy', 'Loan Balance (Audit)', 'Loan Discrepancy'];
        const csvRows = [
            headers.join(','),
            ...snapshot.map(row => [
                `"${row.name}"`,
                `"${row.group_name}"`,
                row.historical_savings,
                row.savings_discrepancy,
                row.historical_loan_balance,
                row.loan_discrepancy
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvRows], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Audit_Snapshot_${date}.csv`;
        a.click();
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
    };

    // Derived Stats
    const totalSavings = snapshot?.reduce((sum, row) => sum + row.historical_savings, 0) || 0;
    const totalLoans = snapshot?.reduce((sum, row) => sum + row.historical_loan_balance, 0) || 0;
    const totalProject = snapshot?.reduce((sum, row) => sum + row.historical_project, 0) || 0;

    const filteredData = snapshot
        ? snapshot.filter(row => row.group_name.toLowerCase().includes(filterGroup.toLowerCase()) || row.name.toLowerCase().includes(filterGroup.toLowerCase()))
        : [];

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            <header className="border-b pb-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <FileText className="w-8 h-8 text-blue-600" />
                            Auditor Mode
                        </h1>
                        <p className="text-gray-500 mt-1">
                            Time-Travel Snapshot Engine. Reconstructs historical balances from transaction ledger.
                        </p>
                    </div>
                    {snapshot && (
                        <div className="flex gap-3">
                            <button
                                onClick={handleExportCSV}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                <Download className="w-4 h-4" /> Export CSV
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* CONTROLS */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Snapshot Date</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                    {loading ? 'Reconstructing...' : 'Generate Snapshot'}
                </button>
            </div>

            {/* RESULTS */}
            {snapshot && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* SUMMARY CARDS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                            <span className="text-blue-600 text-xs font-bold uppercase">Total Savings (As of {date})</span>
                            <div className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalSavings)}</div>
                        </div>
                        <div className="bg-purple-50 p-6 rounded-xl border border-purple-100">
                            <span className="text-purple-600 text-xs font-bold uppercase">Outstanding Loans (As of {date})</span>
                            <div className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalLoans)}</div>
                        </div>
                        <div className="bg-green-50 p-6 rounded-xl border border-green-100">
                            <span className="text-green-600 text-xs font-bold uppercase">Project Fund (As of {date})</span>
                            <div className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalProject)}</div>
                        </div>
                    </div>

                    {/* TABLE */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-700">Reconstructed Member Balances</h3>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Filter by name or group..."
                                    value={filterGroup}
                                    onChange={(e) => setFilterGroup(e.target.value)}
                                    className="pl-9 pr-4 py-2 text-sm border rounded-lg w-64 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-xs">
                                    <tr>
                                        <th className="px-6 py-3">Member</th>
                                        <th className="px-6 py-3">Group</th>
                                        <th className="px-6 py-3 text-right">Savings (Audit)</th>
                                        <th className="px-6 py-3 text-right text-blue-600">Discrepancy</th>
                                        <th className="px-6 py-3 text-right">Loan Bal (Audit)</th>
                                        <th className="px-6 py-3 text-right text-red-600">Discrepancy</th>
                                        <th className="px-6 py-3">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredData.map((row) => (
                                        <tr key={row.id} className={`hover:bg-gray-50 group ${Math.abs(row.savings_discrepancy || 0) > 0.1 || Math.abs(row.loan_discrepancy || 0) > 0.1 ? 'bg-red-50/50' : ''}`}>
                                            <td className="px-6 py-3 font-medium text-gray-900">
                                                {row.name}
                                                {(Math.abs(row.savings_discrepancy || 0) > 0.1 || Math.abs(row.loan_discrepancy || 0) > 0.1) && (
                                                    <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded uppercase">Ledger Mismatch</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-3 text-gray-500">{row.group_name}</td>
                                            <td className="px-6 py-3 text-right font-mono">{formatCurrency(row.historical_savings)}</td>
                                            <td className={`px-6 py-3 text-right font-mono font-bold ${row.savings_discrepancy !== 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                                                {row.savings_discrepancy !== 0 ? formatCurrency(row.savings_discrepancy) : '—'}
                                            </td>
                                            <td className="px-6 py-3 text-right font-mono text-gray-700">{formatCurrency(row.historical_loan_balance)}</td>
                                            <td className={`px-6 py-3 text-right font-mono font-bold ${row.loan_discrepancy !== 0 ? 'text-red-600' : 'text-gray-300'}`}>
                                                {row.loan_discrepancy !== 0 ? formatCurrency(row.loan_discrepancy) : '—'}
                                            </td>
                                            <td className="px-6 py-3">
                                                <button
                                                    onClick={() => handleDrillDown(row)}
                                                    className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 opacity-100 transition-opacity"
                                                >
                                                    Audit Trail <ArrowRight className="w-3 h-3" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t bg-gray-50 text-xs text-gray-400 text-center">
                            * Balances are reconstructed by summing all transactions on or before {date}.
                            <span className="text-red-400 ml-1 font-medium">"Ledger Mismatch"</span> indicates a discrepancy between reconstructed balances and the live ledger.
                        </div>
                    </div>
                </div>
            )}

            {/* DRILL DOWN MODAL */}
            {selectedMember && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">{selectedMember.name}</h2>
                                <p className="text-sm text-gray-500">Transaction Trail up to {date}</p>
                            </div>
                            <button onClick={() => setSelectedMember(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                <X className="w-6 h-6 text-gray-500" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {trailLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 grayscale">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                                    <p className="text-gray-500 font-medium">Tracing transactions...</p>
                                </div>
                            ) : trail.length === 0 ? (
                                <div className="text-center py-20">
                                    <p className="text-gray-400">No transactions found for this member up to {date}.</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Date</th>
                                            <th className="px-4 py-2 text-left">Type</th>
                                            <th className="px-4 py-2 text-right">Amount</th>
                                            <th className="px-4 py-2 text-right text-blue-600">Savings Δ</th>
                                            <th className="px-4 py-2 text-right text-red-600">Loan Δ</th>
                                            <th className="px-4 py-2 text-left">Description</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {trail.map((t, idx) => (
                                            <tr key={idx} className="hover:bg-blue-50/50">
                                                <td className="px-4 py-3 whitespace-nowrap text-gray-600 font-mono text-[10px]">{t.date}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${t.type.includes('WITHDRAWAL') ? 'bg-red-100 text-red-700' :
                                                        t.type.includes('LOAN') ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                                                        }`}>
                                                        {t.type.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-bold">{formatCurrency(t.amount)}</td>
                                                <td className={`px-4 py-3 text-right font-mono text-[11px] ${t.impact.savings > 0 ? 'text-green-600' : t.impact.savings < 0 ? 'text-red-600' : 'text-gray-300'}`}>
                                                    {t.impact.savings !== 0 ? formatCurrency(t.impact.savings) : '—'}
                                                </td>
                                                <td className={`px-4 py-3 text-right font-mono text-[11px] ${t.impact.loans > 0 ? 'text-red-600' : t.impact.loans < 0 ? 'text-green-600' : 'text-gray-300'}`}>
                                                    {t.impact.loans !== 0 ? formatCurrency(t.impact.loans) : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-gray-500 text-xs italic">{t.description}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="p-6 border-t bg-gray-50 rounded-b-2xl flex justify-between items-center">
                            <div className="flex gap-4">
                                <div className="text-xs">
                                    <span className="text-gray-400 block uppercase font-bold">Total Contribution</span>
                                    <span className="text-lg font-bold text-gray-900">{formatCurrency(selectedMember.historical_savings + selectedMember.historical_project)}</span>
                                </div>
                                <div className="text-xs">
                                    <span className="text-gray-400 block uppercase font-bold">Unpaid Loans</span>
                                    <span className="text-lg font-bold text-red-600">{formatCurrency(selectedMember.historical_loan_balance)}</span>
                                </div>
                            </div>
                            <button onClick={() => setSelectedMember(null)} className="px-6 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-black transition-colors">
                                Close Audit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditorMode;
