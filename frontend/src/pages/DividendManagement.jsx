import React, { useState, useEffect } from 'react';
import { FaMoneyBillWave, FaCalculator, FaLock, FaCheckCircle, FaSpinner, FaFilePdf } from 'react-icons/fa';
import api from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import PdfService from '../services/pdfService';

const DividendManagement = () => {
    const { user } = useAuth();
    const [year, setYear] = useState(new Date().getFullYear());
    const [groups, setGroups] = useState([]);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [expenses, setExpenses] = useState(0);
    const [previewData, setPreviewData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [history, setHistory] = useState([]);

    useEffect(() => {
        loadGroups();
        loadHistory();
    }, []);

    const loadGroups = async () => {
        try {
            const data = await api.getGroups();
            setGroups(data || []);
            if (data && data.length > 0) setSelectedGroupId(data[0].id);
        } catch (error) {
            console.error(error);
        }
    };

    const loadHistory = async () => {
        try {
            const res = await api.getDividendRuns();
            setHistory(res || []);
        } catch (error) {
            console.error(error);
        }
    };

    const handlePreview = async () => {
        if (!selectedGroupId) return;
        setLoading(true);
        try {
            const data = await api.previewDividends({
                year: parseInt(year),
                groupId: parseInt(selectedGroupId),
                expenses: parseFloat(expenses)
            });
            setPreviewData(data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to generate preview. Ensure transactions exist.");
        } finally {
            setLoading(false);
        }
    };

    const handlePost = async () => {
        if (!previewData) return;
        setProcessing(true);
        try {
            await api.postDividends({
                runData: previewData,
                officerId: user.id
            });
            toast.success("✅ Dividends Distributed Successfully!");
            setPreviewData(null);
            loadHistory();
        } catch (error) {
            console.error(error);
            toast.error("Failed to post dividends.");
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 tracking-tight">Dividend Engine</h2>
                    <p className="text-sm text-gray-500 font-medium">Automated Profit Sharing & Distribution</p>
                </div>
            </div>

            {/* CONTROL PANEL */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-3xl shadow-xl shadow-gray-100/50 border border-gray-100">
                        <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                            <FaCalculator className="text-safaricom-green" />
                            Configuration
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Financial Year</label>
                                <input
                                    type="number"
                                    value={year}
                                    onChange={(e) => setYear(e.target.value)}
                                    className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-700 border-none focus:ring-2 focus:ring-safaricom-green/20"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Target Group</label>
                                <select
                                    value={selectedGroupId}
                                    onChange={(e) => setSelectedGroupId(e.target.value)}
                                    className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-700 border-none focus:ring-2 focus:ring-safaricom-green/20"
                                >
                                    {groups.map(g => (
                                        <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Operating Expenses (KES)</label>
                                <input
                                    type="number"
                                    value={expenses}
                                    onChange={(e) => setExpenses(e.target.value)}
                                    className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-700 border-none focus:ring-2 focus:ring-safaricom-green/20"
                                    placeholder="0.00"
                                />
                            </div>

                            <button
                                onClick={handlePreview}
                                disabled={loading}
                                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black shadow-lg hover:bg-gray-800 transition-all flex justify-center items-center gap-2"
                            >
                                {loading ? <FaSpinner className="animate-spin" /> : "CALCULATE PREVIEW"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* PREVIEW PANEL */}
                <div className="lg:col-span-2">
                    {previewData ? (
                        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-green-100/50 border border-green-100 animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-xl font-black text-gray-800">Distribution Preview</h3>
                                    <p className="text-sm text-gray-500">Review calculated figures before locking.</p>
                                </div>
                                <div className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-black uppercase">
                                    DRAFT PREVIEW
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                <div className="p-4 bg-gray-50 rounded-2xl">
                                    <p className="text-[10px] uppercase font-black text-gray-400">Total Revenue (TRF)</p>
                                    <p className="text-lg font-black text-gray-800">KES {previewData.trf.toLocaleString()}</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl">
                                    <p className="text-[10px] uppercase font-black text-gray-400">Net Profit (AP)</p>
                                    <p className="text-lg font-black text-green-600">KES {previewData.ap.toLocaleString()}</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl">
                                    <p className="text-[10px] uppercase font-black text-gray-400">Ratio Applied</p>
                                    <p className="text-lg font-black text-blue-600">{previewData.ratio * 100}%</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl border-2 border-green-100">
                                    <p className="text-[10px] uppercase font-black text-green-600">Dividend Rate</p>
                                    <p className="text-lg font-black text-green-700">{(previewData.dividendRate || 0).toFixed(4)} / Share</p>
                                </div>
                            </div>

                            <div className="mb-8">
                                <h4 className="text-sm font-black text-gray-800 mb-3 uppercase tracking-wider">Top 5 Allocations</h4>
                                <div className="overflow-hidden rounded-xl border border-gray-100">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="p-3 font-bold text-gray-500">Member</th>
                                                <th className="p-3 font-bold text-gray-500 text-right">Avg Shares</th>
                                                <th className="p-3 font-bold text-gray-500 text-right">Payout (KES)</th>
                                                <th className="p-3 font-bold text-gray-500 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {previewData.allocations.slice(0, 5).map((alloc, i) => (
                                                <tr key={i}>
                                                    <td className="p-3 font-bold text-gray-800">{alloc.name}</td>
                                                    <td className="p-3 text-gray-600 text-right">{alloc.averageShares.toLocaleString()}</td>
                                                    <td className="p-3 font-black text-green-600 text-right">+{alloc.grossDividend.toLocaleString()}</td>
                                                    <td className="p-3 text-right">
                                                        <button
                                                            onClick={() => PdfService.generateDividendVoucher({ year, dividendRate: previewData.dividendRate }, alloc)}
                                                            className="text-gray-400 hover:text-red-500 transition-colors"
                                                            title="Download Voucher"
                                                        >
                                                            <FaFilePdf />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {previewData.allocations.length > 5 && (
                                    <p className="text-center text-xs text-gray-400 mt-2 font-bold">+ {previewData.allocations.length - 5} more members</p>
                                )}
                            </div>

                            <div className="p-4 bg-red-50 rounded-2xl text-red-700 text-xs font-bold mb-6 flex gap-3 items-center">
                                <FaLock size={20} />
                                <div>
                                    <p>WARNING: Clicking declare will LOCK this financial period.</p>
                                    <p className="opacity-75">Transactions cannot be edited after distribution.</p>
                                </div>
                            </div>

                            <button
                                onClick={handlePost}
                                disabled={processing}
                                className="w-full py-4 bg-gradient-to-r from-safaricom-green to-green-600 text-white rounded-2xl font-black text-sm shadow-xl hover:shadow-2xl hover:scale-[1.01] transition-all flex justify-center items-center gap-2"
                            >
                                {processing ? <FaSpinner className="animate-spin" /> : "DECLARE & DISTRIBUTE DIVIDENDS"}
                            </button>
                        </div>
                    ) : (
                        <div className="h-full bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 p-12">
                            <FaMoneyBillWave size={48} className="mb-4 opacity-20" />
                            <p className="font-bold">Select parameters and calculate to see preview</p>
                        </div>
                    )}
                </div>
            </div>

            {/* HISTORY TABLE */}
            <div className="mt-12">
                <h3 className="text-lg font-black text-gray-800 mb-6">Declaration History</h3>
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase">Run ID</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase">Year</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase">Total Payout</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase">Rate</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase">Status</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {history.length > 0 ? history.map(run => (
                                <tr key={run.id} className="hover:bg-gray-50/50">
                                    <td className="px-6 py-4 font-bold text-gray-500">#{run.id}</td>
                                    <td className="px-6 py-4 font-bold text-gray-800">{run.financial_year}</td>
                                    <td className="px-6 py-4 font-black text-green-600">KES {run.total_payout?.toLocaleString()}</td>
                                    <td className="px-6 py-4 font-bold text-gray-700">{run.dividend_rate?.toFixed(4)}</td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md text-[10px] font-black uppercase">
                                            {run.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs font-bold text-gray-400">
                                        {new Date(run.created_at).toLocaleDateString()}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-400 text-sm font-bold">
                                        No dividend runs found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DividendManagement;
