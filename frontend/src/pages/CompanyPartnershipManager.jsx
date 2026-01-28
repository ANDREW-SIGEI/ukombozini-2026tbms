import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { FaHandshake, FaMoneyBillTrendUp, FaShieldHalved, FaTv, FaBriefcase, FaArrowRight, FaRotate, FaUnlockKeyhole, FaFilePdf } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import { saveAs } from 'file-saver';
import api from '../services/api';
import { mockGroups, mockMembers } from '../data/mockData'; // Fallback for list

const CompanyPartnershipManager = () => {
    const [activeTab, setActiveTab] = useState('overview');
    const [exposureData, setExposureData] = useState(null);
    const [scoreData, setScoreData] = useState(null);
    const [selectedGroupId, setSelectedGroupId] = useState(mockGroups[0]?.id || 1);
    const [loading, setLoading] = useState(false);

    const { register: registerTopUp, handleSubmit: handleSubmitTopUp, reset: resetTopUp } = useForm();
    const { register: registerCommitment, handleSubmit: handleSubmitCommitment, reset: resetCommitment } = useForm();
    const { register: registerProduct, handleSubmit: handleSubmitProduct, reset: resetProduct } = useForm();
    const { register: registerOffset, handleSubmit: handleSubmitOffset, reset: resetOffset } = useForm();
    const [supervisorOverride, setSupervisorOverride] = useState(false);

    // Fetch Exposure Data
    useEffect(() => {
        loadExposure();
    }, [selectedGroupId]);

    const loadExposure = async () => {
        try {
            const [exposure, score] = await Promise.all([
                api.getPartnershipExposure(selectedGroupId),
                api.getRelationshipScore(selectedGroupId)
            ]);
            setExposureData(exposure);
            setScoreData(score);
        } catch (error) {
            console.error("Exposure/Score Load Fail", error);
        }
    };

    // 1. Submit Top-Up
    const onTopUpSubmit = async (data) => {
        try {
            setLoading(true);
            await api.addCompanyTopUp({ ...data, groupId: selectedGroupId });
            toast.success("Company Top-Up Injected Successfully!");
            resetTopUp();
            loadExposure();
        } catch (error) {
            toast.error("Failed to inject Top-Up");
        } finally {
            setLoading(false);
        }
    };

    // 2. Submit Commitment
    const onCommitmentSubmit = async (data) => {
        try {
            setLoading(true);
            await api.addCommitmentDeposit({ ...data, groupId: selectedGroupId });
            toast.success("Group Commitment Recorded!");
            resetCommitment();
            loadExposure();
        } catch (error) {
            toast.error("Failed to record Commitment");
        } finally {
            setLoading(false);
        }
    };

    // 3. Submit Product
    const onProductSubmit = async (data) => {
        try {
            setLoading(true);
            await api.issueProduct(data); // memberId is in data
            toast.success("Product Issued & Financed!");
            resetProduct();
        } catch (error) {
            toast.error("Failed to issue product");
        } finally {
            setLoading(false);
        }
    };

    // 5. Download Statement
    const downloadStatement = async () => {
        try {
            toast.info("Generating Statement...");
            const blob = await api.downloadPartnershipStatement(selectedGroupId);
            if (blob) {
                saveAs(blob, `Partnership_Statement_Group_${selectedGroupId}.pdf`);
                toast.success("Downloaded!");
            }
        } catch (error) {
            toast.error("Download Failed");
        }
    };

    // 4. Submit Offset (Auto-Clear)
    const onOffsetSubmit = async (data) => {
        try {
            setLoading(true);
            await api.applyPartnerOffset({ ...data }); // memberId, amount, notes
            toast.success("Debt Cleared using Commitment!");
            resetOffset();
            loadExposure();
        } catch (error) {
            toast.error("Failed to Offset. Check Balance.");
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { id: 'overview', label: 'Overview', icon: <FaBriefcase /> },
        { id: 'topup', label: 'Company Top-Up', icon: <FaMoneyBillTrendUp /> },
        { id: 'commitment', label: 'Commitment Deposit', icon: <FaShieldHalved /> },
        { id: 'products', label: 'Product Financing', icon: <FaTv /> },
        { id: 'offset', label: 'Clear Debt (Auto-Offset)', icon: <FaUnlockKeyhole className="text-yellow-400" /> },
    ];

    return (
        <div className="max-w-7xl mx-auto p-6 pb-20 space-y-8">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-900 to-blue-800 p-8 rounded-2xl text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-3xl font-black mb-2 flex items-center gap-3">
                        <FaHandshake className="text-yellow-400" />
                        Ukombozi Loan & Top-Up Manager
                    </h1>
                    <p className="text-blue-200">Manage Partnership Capital, Group Commitments, and Asset Financing.</p>
                </div>
                <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 skew-x-12 transform translate-x-10"></div>
            </div>

            {/* Group Selector */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                <label className="font-bold text-gray-700">Select Partner Group:</label>
                <select
                    className="p-2 border rounded-lg bg-gray-50 flex-1 font-medium"
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                >
                    {mockGroups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                </select>
            </div>

            {/* Navigation Tabs */}
            <div className="flex space-x-2 border-b overflow-x-auto pb-1">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-bold transition-colors whitespace-nowrap ${activeTab === tab.id
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* CONTENT AREA */}
            <div className="bg-white p-8 rounded-b-xl rounded-r-xl shadow-sm border border-gray-100 min-h-[400px]">

                {/* 1. OVERVIEW */}
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        <div className="flex justify-end">
                            <button onClick={downloadStatement} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold shadow transition-colors">
                                <FaFilePdf /> Download Partnership Statement
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                                <p className="text-xs font-bold text-gray-500 uppercase">Total Company Investment (Top-Ups)</p>
                                <p className="text-3xl font-black text-blue-900 mt-2">
                                    KES {exposureData?.portfolio?.totalTopUp?.toLocaleString() || '0'}
                                </p>
                            </div>
                            <div className="bg-green-50 p-6 rounded-xl border border-green-100">
                                <p className="text-xs font-bold text-gray-500 uppercase">Security Held (Commitments)</p>
                                <p className="text-3xl font-black text-green-900 mt-2">
                                    KES {exposureData?.security?.totalCommitment?.toLocaleString() || '0'}
                                </p>
                            </div>
                            <div className="bg-purple-50 p-6 rounded-xl border border-purple-100">
                                <p className="text-xs font-bold text-gray-500 uppercase">Net Exposure</p>
                                <p className="text-3xl font-black text-purple-900 mt-2">
                                    KES {exposureData?.netExposure?.toLocaleString() || '0'}
                                </p>
                            </div>
                        </div>

                        {/* Relationship Score Widget */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-8 items-center">
                            <div className="relative w-32 h-32">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-gray-100" />
                                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="12" fill="transparent"
                                        strokeDasharray={364.42}
                                        strokeDashoffset={364.42 - (364.42 * (scoreData?.score || 0) / 100)}
                                        className={`${(scoreData?.score || 0) >= 80 ? 'text-green-500' : (scoreData?.score || 0) >= 50 ? 'text-yellow-500' : 'text-red-500'} transition-all duration-1000 ease-out`}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-2xl font-black">{scoreData?.score || 0}%</span>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Trust</span>
                                </div>
                            </div>

                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-xl font-black text-gray-800 tracking-tight">GROUP RELATIONSHIP SCORE</h3>
                                    <span className={`px-3 py-1 rounded-full text-xs font-black ${scoreData?.label === 'EXCELLENT' ? 'bg-green-100 text-green-700' :
                                        scoreData?.label === 'RISKY' ? 'bg-red-100 text-red-700' :
                                            'bg-yellow-100 text-yellow-700'
                                        }`}>
                                        {scoreData?.label}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {scoreData?.reasons?.map((reason, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                                            <div className={`w-2 h-2 rounded-full ${reason.includes('Warning') ? 'bg-red-500' : 'bg-green-500'}`}></div>
                                            {reason}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center w-full md:w-auto">
                                <p className="text-xs font-bold text-blue-800 uppercase mb-1">Impact</p>
                                <p className="text-sm text-blue-900 font-medium mb-2">
                                    {(scoreData?.score || 0) >= 80 ? '🌟 Eligible for 0.5% Discount' : (scoreData?.score || 0) <= 40 ? '⚠️ High Risk: Lock Active' : 'Standard Terms Apply'}
                                </p>
                                {(scoreData?.score || 0) <= 40 && (
                                    <label className="flex items-center justify-center gap-2 cursor-pointer bg-white p-2 rounded border border-orange-200">
                                        <input
                                            type="checkbox"
                                            checked={supervisorOverride}
                                            onChange={(e) => setSupervisorOverride(e.target.checked)}
                                            className="w-4 h-4 text-orange-600"
                                        />
                                        <span className="text-[10px] font-black text-orange-800 uppercase">Supervisor Override</span>
                                    </label>
                                )}
                            </div>
                        </div>

                        {/* Recent Activity Table */}
                        <h3 className="font-bold text-gray-800 mt-8 mb-4">Recent Top-Ups</h3>
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-600 uppercase">
                                <tr>
                                    <th className="p-3">Date</th>
                                    <th className="p-3">Amount</th>
                                    <th className="p-3">Notes</th>
                                    <th className="p-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {exposureData?.portfolio?.investments?.map((inv, idx) => (
                                    <tr key={idx}>
                                        <td className="p-3">{new Date(inv.created_at).toLocaleDateString()}</td>
                                        <td className="p-3 font-bold">KES {inv.amount.toLocaleString()}</td>
                                        <td className="p-3 text-gray-500">{inv.notes}</td>
                                        <td className="p-3"><span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">{inv.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* 2. TOP-UP MANAGER */}
                {activeTab === 'topup' && (
                    <form onSubmit={handleSubmitTopUp(onTopUpSubmit)} className="max-w-xl mx-auto space-y-6">
                        <div className="text-center mb-8">
                            <div className="inline-block p-4 bg-blue-100 rounded-full text-blue-600 mb-4">
                                <FaMoneyBillTrendUp size={40} />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800">Inject Capital (Top-Up)</h2>
                            <p className="text-gray-500">Add funds to the Group Table to increase loan capacity.</p>
                        </div>

                        <div>
                            <label className="block font-bold text-gray-700 mb-1">Amount (KES)</label>
                            <input {...registerTopUp('amount', { required: true })} type="number" className="w-full border p-3 rounded-lg text-lg" placeholder="e.g. 50000" />
                        </div>
                        <div>
                            <label className="block font-bold text-gray-700 mb-1">Notes / Reference</label>
                            <textarea {...registerTopUp('notes')} className="w-full border p-3 rounded-lg" placeholder="e.g. Top-Up Batch #104" rows="3"></textarea>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6 flex justify-between items-center text-sm">
                            <span className="text-blue-800 font-bold">AI Suggestion:</span>
                            <span className="font-medium text-blue-900">
                                {(scoreData?.score || 0) >= 80 ? 'Recommend 0.5% Interest Discount' : 'Standard Interest Rate'}
                            </span>
                        </div>

                        <button
                            disabled={loading || ((scoreData?.score || 0) < 35 && !supervisorOverride)}
                            className={`w-full font-bold py-4 rounded-xl shadow-lg transition-transform hover:scale-[1.02] ${(scoreData?.score || 0) < 35 && !supervisorOverride
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                        >
                            {loading ? 'Processing...' : (scoreData?.score || 0) < 35 && !supervisorOverride ? 'Locked: Score Too Low' : 'Inject Capital Now'}
                        </button>
                    </form>
                )}

                {/* 3. COMMITMENT DEPOSIT */}
                {activeTab === 'commitment' && (
                    <form onSubmit={handleSubmitCommitment(onCommitmentSubmit)} className="max-w-xl mx-auto space-y-6">
                        <div className="text-center mb-8">
                            <div className="inline-block p-4 bg-green-100 rounded-full text-green-600 mb-4">
                                <FaShieldHalved size={40} />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800">Record Commitment Deposit</h2>
                            <p className="text-gray-500">Log security deposit paid by the group. Non-refundable.</p>
                        </div>

                        <div>
                            <label className="block font-bold text-gray-700 mb-1">Amount (KES)</label>
                            <input {...registerCommitment('amount', { required: true })} type="number" className="w-full border p-3 rounded-lg text-lg" placeholder="e.g. 20000" />
                        </div>
                        <div>
                            <label className="block font-bold text-gray-700 mb-1">Notes</label>
                            <textarea {...registerCommitment('notes')} className="w-full border p-3 rounded-lg" placeholder="Details..." rows="3"></textarea>
                        </div>
                        <button disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl shadow-lg transition-transform hover:scale-[1.02]">
                            {loading ? 'Processing...' : 'Record Commitment'}
                        </button>
                    </form>
                )}

                {/* 4. PRODUCT FINANCING */}
                {activeTab === 'products' && (
                    <form onSubmit={handleSubmitProduct(onProductSubmit)} className="max-w-2xl mx-auto space-y-6">
                        <div className="text-center mb-8">
                            <div className="inline-block p-4 bg-purple-100 rounded-full text-purple-600 mb-4">
                                <FaTv size={40} />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800">Issue Product (Asset Financing)</h2>
                            <p className="text-gray-500">Finance a product for a member.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block font-bold text-gray-700 mb-1">Select Member</label>
                                <select {...registerProduct('memberId', { required: true })} className="w-full border p-3 rounded-lg bg-gray-50">
                                    <option value="">-- Choose Member --</option>
                                    {mockMembers.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block font-bold text-gray-700 mb-1">Product Name</label>
                                <input {...registerProduct('productName', { required: true })} className="w-full border p-3 rounded-lg" placeholder="e.g. 32 inch TV" />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6">
                            <div>
                                <label className="block font-bold text-gray-700 mb-1">Total Value</label>
                                <input {...registerProduct('totalValue', { required: true })} type="number" className="w-full border p-3 rounded-lg" placeholder="0.00" />
                            </div>
                            <div>
                                <label className="block font-bold text-gray-700 mb-1">Commitment Paid</label>
                                <input {...registerProduct('commitmentPaid', { required: true })} type="number" className="w-full border p-3 rounded-lg" placeholder="0.00" />
                            </div>
                            <div>
                                <label className="block font-bold text-gray-700 mb-1">Monthly Installment</label>
                                <input {...registerProduct('monthlyInstallment', { required: true })} type="number" className="w-full border p-3 rounded-lg" placeholder="0.00" />
                            </div>
                        </div>

                        <button
                            disabled={loading || ((scoreData?.score || 0) < 35 && !supervisorOverride)}
                            className={`w-full font-bold py-4 rounded-xl shadow-lg transition-transform hover:scale-[1.02] ${(scoreData?.score || 0) < 35 && !supervisorOverride
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                                }`}
                        >
                            {loading ? 'Processing...' : (scoreData?.score || 0) < 35 && !supervisorOverride ? 'Locked: High Risk' : 'Issue Product'}
                        </button>
                    </form>
                )}

                {/* 5. AUTO OFFSET (CLEAR DEBT) */}
                {activeTab === 'offset' && (
                    <form onSubmit={handleSubmitOffset(onOffsetSubmit)} className="max-w-xl mx-auto space-y-6">
                        <div className="text-center mb-8">
                            <div className="inline-block p-4 bg-yellow-100 rounded-full text-yellow-600 mb-4">
                                <FaUnlockKeyhole size={40} />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800">Clear Debt (Auto-Offset)</h2>
                            <p className="text-gray-500">Use the Group's Commitment Deposit to clear a member's final balance.</p>
                        </div>

                        <div>
                            <label className="block font-bold text-gray-700 mb-1">Select Member to Clear</label>
                            <select {...registerOffset('memberId', { required: true })} className="w-full border p-3 rounded-lg bg-gray-50">
                                <option value="">-- Choose Member --</option>
                                {mockMembers.filter(m => m.groupId === parseInt(selectedGroupId)).map(m => ( // Filter mainly for UX
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block font-bold text-gray-700 mb-1">Amount to Offset (KES)</label>
                            <div className="relative">
                                <input {...registerOffset('amount', { required: true })} type="number" className="w-full border p-3 rounded-lg text-lg pl-10" placeholder="0.00" />
                                <span className="absolute left-3 top-3 text-gray-400 font-bold">KES</span>
                            </div>
                            <p className="text-xs text-blue-600 mt-1">* Deducts from Group Commitment Balance ({exposureData?.security?.totalCommitment?.toLocaleString()})</p>
                        </div>

                        <div>
                            <label className="block font-bold text-gray-700 mb-1">Notes / Reason</label>
                            <textarea {...registerOffset('notes')} className="w-full border p-3 rounded-lg" placeholder="e.g. Final Installment Offset..." rows="2"></textarea>
                        </div>

                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded text-sm text-yellow-800 mb-4">
                            <strong>Warning:</strong> This action is irreversible. It credits the member's loan and reduces the group's locked commitment.
                        </div>

                        <button disabled={loading} className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-4 rounded-xl shadow-lg transition-transform hover:scale-[1.02]">
                            {loading ? 'Processing...' : 'Confirm Offset Transaction'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default CompanyPartnershipManager;
