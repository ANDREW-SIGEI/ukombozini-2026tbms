import React, { useState } from 'react';
import { api } from '../services/api';
import { Calendar, Search, FileText, Smartphone, Download } from 'lucide-react';

const AuditorMode = () => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [snapshot, setSnapshot] = useState(null);
    const [filterGroup, setFilterGroup] = useState('');

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
                                        <th className="px-6 py-3 text-right">Savings</th>
                                        <th className="px-6 py-3 text-right">Project</th>
                                        <th className="px-6 py-3 text-right">Welfare</th>
                                        <th className="px-6 py-3 text-right">Loan Bal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredData.map((row) => (
                                        <tr key={row.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-3 font-medium text-gray-900">{row.name}</td>
                                            <td className="px-6 py-3 text-gray-500">{row.group_name}</td>
                                            <td className="px-6 py-3 text-right font-mono">{formatCurrency(row.historical_savings)}</td>
                                            <td className="px-6 py-3 text-right font-mono">{formatCurrency(row.historical_project)}</td>
                                            <td className="px-6 py-3 text-right font-mono">{formatCurrency(row.historical_welfare)}</td>
                                            <td className="px-6 py-3 text-right font-mono text-red-600">{formatCurrency(row.historical_loan_balance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t bg-gray-50 text-xs text-gray-400 text-center">
                            * Balances are reconstructed by summing all transactions on or before {date}. This is a read-only audit view.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditorMode;
