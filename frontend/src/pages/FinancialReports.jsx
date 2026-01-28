import React, { useState, useEffect } from 'react';
import { FaBuildingColumns, FaChartLine, FaMoneyBillWave, FaScaleBalanced, FaFilePdf, FaArrowRight } from 'react-icons/fa6';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-toastify';

const FinancialReports = () => {
    const [loading, setLoading] = useState(true);
    const [balanceSheet, setBalanceSheet] = useState(null);
    const [incomeData, setIncomeData] = useState(null);
    const [cashFlow, setCashFlow] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const today = new Date().toISOString().split('T')[0];
                const startOfYear = `${new Date().getFullYear()}-01-01`;

                const [bs, is, cf] = await Promise.all([
                    api.getBalanceSheet(today),
                    api.getIncomeStatement(startOfYear, today),
                    api.getDailyCashFlow(today)
                ]);

                setBalanceSheet(bs);
                setIncomeData(is);
                setCashFlow(cf);
            } catch (error) {
                console.error("Financial Data Error", error);
                toast.error("Failed to load financial data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-safaricom-green"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 p-6 pb-20">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                        <FaBuildingColumns className="text-safaricom-green" />
                        Financial Reports
                    </h2>
                    <p className="text-gray-500 font-medium mt-1">Real-time Financial Position & Performance</p>
                </div>
                <div className="mt-4 md:mt-0 px-4 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-100">
                    FY {new Date().getFullYear()}
                </div>
            </div>

            {/* EXECUTIVE SUMMARY CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. ASSETS (Balance Sheet) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FaScaleBalanced size={100} className="text-blue-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Total Assets</p>
                        <p className="text-3xl font-black text-blue-900">
                            KES {balanceSheet?.assets.totalAssets.toLocaleString()}
                        </p>
                        <div className="mt-4 flex flex-col gap-1 text-sm">
                            <div className="flex justify-between text-gray-600">
                                <span>Loans Portfolio</span>
                                <span className="font-bold">KES {balanceSheet?.assets.loansPortfolio.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>Cash Equivalents</span>
                                <span className="font-bold">KES {balanceSheet?.assets.cashAtHand.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. NET INCOME (Income Statement) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FaChartLine size={100} className="text-green-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">YTD Net Income</p>
                        <p className="text-3xl font-black text-green-900">
                            KES {incomeData?.netIncome.toLocaleString()}
                        </p>
                        <div className="mt-4 flex flex-col gap-1 text-sm">
                            <div className="flex justify-between text-gray-600">
                                <span>Interest Income</span>
                                <span className="font-bold">KES {incomeData?.revenue.interestIncome.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>Fees & Fines</span>
                                <span className="font-bold">KES {incomeData?.revenue.feesAndPenalties.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. CASH FLOW (Daily) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FaMoneyBillWave size={100} className="text-purple-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Today's Net Cash Flow</p>
                        <p className={`text-3xl font-black ${cashFlow?.netFlow >= 0 ? 'text-purple-900' : 'text-red-700'}`}>
                            {cashFlow?.netFlow >= 0 ? '+' : ''}KES {cashFlow?.netFlow.toLocaleString()}
                        </p>
                        <div className="mt-4 flex flex-col gap-1 text-sm">
                            <div className="flex justify-between text-gray-600">
                                <span>Total In (Collections)</span>
                                <span className="font-bold text-green-600">+{cashFlow?.cashIn.total.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>Total Out (Disbursements)</span>
                                <span className="font-bold text-red-600">-{cashFlow?.cashOut.total.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ACTION GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* RECONCILIATION SHORTCUT */}
                <Link to="/cash-reconciliation" className="group bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-2xl text-white shadow-lg hover:shadow-xl transition-all">
                    <div className="flex justify-between items-center mb-4">
                        <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                            <FaScaleBalanced className="text-2xl text-green-400" />
                        </div>
                        <FaArrowRight className="opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Daily Reconciliation</h3>
                    <p className="text-gray-400 text-sm">Review, approve, or flag today's cash reconciliation reports from field officers.</p>
                </Link>

                {/* PDF EXPORTS */}
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <FaFilePdf className="text-red-600" />
                        Export Standard Reports
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <button className="p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left group">
                            <p className="font-bold text-gray-800 group-hover:text-safaricom-green transition-colors">Balance Sheet</p>
                            <p className="text-xs text-gray-500 mt-1">Statement of Financial Position</p>
                        </button>
                        <button className="p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left group">
                            <p className="font-bold text-gray-800 group-hover:text-safaricom-green transition-colors">Income Statement</p>
                            <p className="text-xs text-gray-500 mt-1">Profit & Loss Statement</p>
                        </button>
                        <button className="p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left group">
                            <p className="font-bold text-gray-800 group-hover:text-safaricom-green transition-colors">Cash Flow</p>
                            <p className="text-xs text-gray-500 mt-1">Statement of Cash Flows</p>
                        </button>
                        <button className="p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left group">
                            <p className="font-bold text-gray-800 group-hover:text-safaricom-green transition-colors">Member Ledger</p>
                            <p className="text-xs text-gray-500 mt-1">Individual Account Statement</p>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinancialReports;
