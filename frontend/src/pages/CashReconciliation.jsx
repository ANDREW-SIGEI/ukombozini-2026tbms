import React, { useState, useEffect } from 'react';
import {
    FaCircleCheck,
    FaTriangleExclamation,
    FaCircleXmark,
    FaMoneyBillWave,
    FaMobileScreen,
    FaBuildingColumns,
    FaCalculator,
    FaLock,
    FaChartLine
} from 'react-icons/fa6';
import { toast } from 'react-toastify';
import NotificationService from '../services/NotificationService';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

// Mock data - replace with API
const mockReconciliations = [
    {
        id: 1,
        reconciliation_number: 'REC-20250119-001',
        reconciliation_date: '2025-01-19',
        officer_name: 'John Kamau',
        expected_cash: 125000,
        declared_physical_cash: 123000,
        declared_mobile_money: 2000,
        banked_amount: 0,
        total_declared: 125000,
        variance: 0,
        variance_type: 'BALANCED',
        status: 'BALANCED',
        officer_notes: 'All collections verified and counted',
        meetings_breakdown: [
            { session_number: 'MTG-202501-GRP-001', group_name: 'Ukombozi Group A', total_collected: 45000 },
            { session_number: 'MTG-202501-GRP-002', group_name: 'Ukombozi Group B', total_collected: 80000 }
        ]
    },
    {
        id: 2,
        reconciliation_number: 'REC-20250118-001',
        reconciliation_date: '2025-01-18',
        officer_name: 'Jane Achieng',
        expected_cash: 95000,
        declared_physical_cash: 93000,
        declared_mobile_money: 0,
        banked_amount: 0,
        total_declared: 93000,
        variance: -2000,
        variance_type: 'SHORTAGE',
        variance_explanation: 'Member Joseph Mutua paid KES 2,000 late after closing. Will be included in tomorrow\'s reconciliation.',
        status: 'VARIANCE_FLAGGED',
        officer_notes: 'One late payment pending',
        meetings_breakdown: [
            { session_number: 'MTG-202501-GRP-003', group_name: 'Ukombozi Group C', total_collected: 95000 }
        ]
    }
];

const CashReconciliation = () => {
    const [reconciliations, setReconciliations] = useState([]);
    const [showNewReconciliation, setShowNewReconciliation] = useState(false);
    const [selectedReconciliation, setSelectedReconciliation] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [loading, setLoading] = useState(false);

    // New reconciliation form
    const [newRec, setNewRec] = useState({
        reconciliation_date: new Date().toISOString().split('T')[0],
        declared_physical_cash: '',
        declared_mobile_money: '',
        banked_amount: '',
        officer_notes: '',
        variance_explanation: ''
    });

    // Real expected cash from API
    const [expectedCash, setExpectedCash] = useState({
        total: 0,
        breakdown: []
    });

    const { user } = useAuth();

    // Load History
    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const data = await api.getReconciliations();
            setReconciliations(data || []);
        } catch (error) {
            console.error("Failed to load history", error);
        } finally {
            setLoading(false);
        }
    };

    // Load Daily Flow Data
    useEffect(() => {
        const fetchDailyData = async () => {
            try {
                const date = newRec.reconciliation_date;
                const flow = await api.getDailyCashFlow(date);
                if (flow) {
                    setExpectedCash({
                        total: flow.cashIn.total,
                        breakdown: flow.breakdown || []
                    });
                }
            } catch (error) {
                console.error("Failed to load cash flow", error);
            }
        };
        fetchDailyData();
    }, [newRec.reconciliation_date]);

    // Calculate variance
    const calculateVariance = () => {
        const physical = parseFloat(newRec.declared_physical_cash) || 0;
        const mobile = parseFloat(newRec.declared_mobile_money) || 0;
        const banked = parseFloat(newRec.banked_amount) || 0;
        const total = physical + mobile + banked;
        return total - expectedCash.total;
    };

    const variance = calculateVariance();
    const varianceType = variance === 0 ? 'BALANCED' : variance > 0 ? 'SURPLUS' : 'SHORTAGE';

    // Submit reconciliation
    const handleSubmit = async () => {
        // Validation
        if (!newRec.declared_physical_cash && !newRec.declared_mobile_money && !newRec.banked_amount) {
            toast.error('Please declare at least one payment method');
            return;
        }

        if (variance !== 0 && !newRec.variance_explanation.trim()) {
            toast.error('Variance explanation is required when there is a shortage or surplus');
            return;
        }

        if (variance !== 0 && newRec.variance_explanation.length < 10) {
            toast.error('Variance explanation must be at least 10 characters');
            return;
        }

        try {
            const physical = parseFloat(newRec.declared_physical_cash) || 0;
            const mobile = parseFloat(newRec.declared_mobile_money) || 0;
            const banked = parseFloat(newRec.banked_amount) || 0;

            const payload = {
                reconciliation_date: newRec.reconciliation_date,
                expected_cash: expectedCash.total,
                declared_physical_cash: physical,
                declared_mobile_money: mobile,
                banked_amount: banked,
                variance: variance,
                variance_type: varianceType,
                variance_explanation: newRec.variance_explanation,
                officer_notes: newRec.officer_notes
            };

            const res = await api.submitReconciliation(payload);

            if (res && res.success) {
                toast.success(variance === 0 ? '✅ Balanced!' : '⚠️ Submitted with variance');
                setShowNewReconciliation(false);
                fetchHistory();

                // NOTIFICATIONS (Optional - usually handled by backend but keeping logic)
                try {
                    if (variance !== 0) {
                        NotificationService.sendEmail(
                            'admin@ukombozi.co.ke',
                            `⚠️ VARIANCE FLAGGED - ${res.reference}`,
                            `Variance of KES ${variance} (${varianceType}) by ${user.name}`
                        );
                    }
                } catch (notiErr) { console.error("Notification failed", notiErr); }
            }
        } catch (error) {
            console.error('Submit error:', error);
            toast.error('Failed to submit reconciliation');
        }
    };

    // Get status color and icon
    const getStatusDisplay = (status, varianceType) => {
        switch (status) {
            case 'BALANCED':
                return {
                    color: 'bg-green-100 text-green-700 border-green-200',
                    icon: <FaCircleCheck />,
                    text: 'BALANCED'
                };
            case 'VARIANCE_FLAGGED':
                return {
                    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
                    icon: <FaTriangleExclamation />,
                    text: varianceType
                };
            case 'APPROVED':
                return {
                    color: 'bg-blue-100 text-blue-700 border-blue-200',
                    icon: <FaCircleCheck />,
                    text: 'APPROVED'
                };
            case 'REJECTED':
                return {
                    color: 'bg-red-100 text-red-700 border-red-200',
                    icon: <FaCircleXmark />,
                    text: 'REJECTED'
                };
            case 'LOCKED':
                return {
                    color: 'bg-gray-100 text-gray-700 border-gray-200',
                    icon: <FaLock />,
                    text: 'LOCKED'
                };
            default:
                return {
                    color: 'bg-gray-100 text-gray-700 border-gray-200',
                    icon: <FaTriangleExclamation />,
                    text: status
                };
        }
    };

    // Statistics
    const stats = {
        totalReconciliations: reconciliations.length,
        balanced: reconciliations.filter(r => r.variance === 0).length,
        variances: reconciliations.filter(r => r.variance !== 0).length,
        totalShortage: reconciliations.filter(r => r.variance < 0).reduce((sum, r) => sum + Math.abs(r.variance), 0),
        totalSurplus: reconciliations.filter(r => r.variance > 0).reduce((sum, r) => sum + r.variance, 0)
    };

    const accuracy = stats.totalReconciliations > 0
        ? ((stats.balanced / stats.totalReconciliations) * 100).toFixed(1)
        : 100;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Daily Cash Reconciliation</h2>
                    <p className="text-sm text-gray-500 mt-1">"Every shilling must be explained"</p>
                </div>
                <button
                    onClick={() => setShowNewReconciliation(true)}
                    className="flex items-center px-6 py-3 bg-safaricom-green text-white rounded-lg hover:bg-safaricom-dark transition-colors shadow-sm font-bold"
                >
                    <FaCalculator className="mr-2" /> New Reconciliation
                </button>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-xs text-gray-500 uppercase font-bold">Total Reports</p>
                    <p className="text-2xl font-black text-gray-800 mt-1">{stats.totalReconciliations}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-xl shadow-sm border border-green-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-green-700 uppercase font-bold">Balanced</p>
                            <p className="text-2xl font-black text-green-800 mt-1">{stats.balanced}</p>
                        </div>
                        <FaCircleCheck className="text-3xl text-green-400" />
                    </div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-xl shadow-sm border border-yellow-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-yellow-700 uppercase font-bold">Variances</p>
                            <p className="text-2xl font-black text-yellow-800 mt-1">{stats.variances}</p>
                        </div>
                        <FaTriangleExclamation className="text-3xl text-yellow-400" />
                    </div>
                </div>
                <div className="bg-red-50 p-4 rounded-xl shadow-sm border border-red-100">
                    <p className="text-xs text-red-700 uppercase font-bold">Total Shortage</p>
                    <p className="text-lg font-black text-red-800 mt-1">KES {stats.totalShortage.toLocaleString()}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-xl shadow-sm border border-blue-100">
                    <div className="flex items-center gap-2">
                        <FaChartLine className="text-2xl text-blue-600" />
                        <div>
                            <p className="text-xs text-blue-700 uppercase font-bold">Accuracy</p>
                            <p className="text-2xl font-black text-blue-800">{accuracy}%</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Reconciliations Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Rec #</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Officer</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Expected</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Declared</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Variance</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {reconciliations.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="px-6 py-10 text-center text-gray-500">
                                        No reconciliations yet. Start your first daily report!
                                    </td>
                                </tr>
                            ) : (
                                reconciliations.map(rec => {
                                    const statusDisplay = getStatusDisplay(rec.status, rec.variance_type);
                                    return (
                                        <tr key={rec.id} className="hover:bg-blue-50/50 transition-colors">
                                            <td className="px-6 py-4 font-mono font-bold text-gray-900 text-xs">{rec.reconciliation_number}</td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {new Date(rec.reconciliation_date).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900">{rec.officer_name}</td>
                                            <td className="px-6 py-4 text-right font-mono font-bold text-gray-900">
                                                KES {rec.expected_cash.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono font-bold text-gray-900">
                                                KES {rec.total_declared.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono font-bold">
                                                {rec.variance === 0 ? (
                                                    <span className="text-green-600">✓ 0</span>
                                                ) : rec.variance > 0 ? (
                                                    <span className="text-blue-600">+{rec.variance.toLocaleString()}</span>
                                                ) : (
                                                    <span className="text-red-600">{rec.variance.toLocaleString()}</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border flex items-center gap-1 w-fit ${statusDisplay.color}`}>
                                                    {statusDisplay.icon}
                                                    {statusDisplay.text}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => {
                                                        setSelectedReconciliation(rec);
                                                        setShowDetailModal(true);
                                                    }}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <FaCalculator />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* New Reconciliation Modal */}
            {showNewReconciliation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-8">
                        <div className="p-6">
                            <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <FaCalculator className="text-safaricom-green" />
                                Daily Cash Reconciliation
                            </h3>

                            {/* Expected Cash Summary */}
                            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg mb-6">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-sm font-bold text-blue-900">Expected Cash (from System)</p>
                                    <p className="text-2xl font-black text-blue-800">KES {expectedCash.total.toLocaleString()}</p>
                                </div>
                                <div className="text-xs text-blue-700 space-y-1">
                                    {expectedCash.breakdown.map((meeting, idx) => (
                                        <div key={idx} className="flex justify-between">
                                            <span>{meeting.session_number} - {meeting.group_name}</span>
                                            <span className="font-mono font-bold">KES {meeting.total_collected.toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Declaration Form */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                            <FaMoneyBillWave className="text-green-600" />
                                            Physical Cash
                                        </label>
                                        <input
                                            type="number"
                                            value={newRec.declared_physical_cash}
                                            onChange={(e) => setNewRec({ ...newRec, declared_physical_cash: e.target.value })}
                                            placeholder="0"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                            <FaMobileScreen className="text-blue-600" />
                                            Mobile Money
                                        </label>
                                        <input
                                            type="number"
                                            value={newRec.declared_mobile_money}
                                            onChange={(e) => setNewRec({ ...newRec, declared_mobile_money: e.target.value })}
                                            placeholder="0"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                            <FaBuildingColumns className="text-purple-600" />
                                            Banked
                                        </label>
                                        <input
                                            type="number"
                                            value={newRec.banked_amount}
                                            onChange={(e) => setNewRec({ ...newRec, banked_amount: e.target.value })}
                                            placeholder="0"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green font-mono"
                                        />
                                    </div>
                                </div>

                                {/* Variance Display */}
                                <div className={`p-4 rounded-lg border-l-4 ${variance === 0 ? 'bg-green-50 border-green-500' :
                                    variance > 0 ? 'bg-blue-50 border-blue-500' :
                                        'bg-red-50 border-red-500'
                                    }`}>
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-bold">
                                            {variance === 0 ? '✅ BALANCED' :
                                                variance > 0 ? '⚠️ SURPLUS' :
                                                    '❌ SHORTAGE'}
                                        </p>
                                        <p className={`text-2xl font-black ${variance === 0 ? 'text-green-600' :
                                            variance > 0 ? 'text-blue-600' :
                                                'text-red-600'
                                            }`}>
                                            {variance === 0 ? 'KES 0' :
                                                variance > 0 ? `+KES ${variance.toLocaleString()}` :
                                                    `KES ${variance.toLocaleString()}`}
                                        </p>
                                    </div>
                                    <p className="text-xs mt-2 text-gray-600">
                                        Total Declared: KES {((parseFloat(newRec.declared_physical_cash) || 0) +
                                            (parseFloat(newRec.declared_mobile_money) || 0) +
                                            (parseFloat(newRec.banked_amount) || 0)).toLocaleString()}
                                    </p>
                                </div>

                                {/* Variance Explanation (if needed) */}
                                {variance !== 0 && (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            Variance Explanation <span className="text-red-600">* (Required, min 20 characters)</span>
                                        </label>
                                        <textarea
                                            value={newRec.variance_explanation}
                                            onChange={(e) => setNewRec({ ...newRec, variance_explanation: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green"
                                            rows="3"
                                            placeholder="Explain the reason for the variance. Be specific..."
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            {newRec.variance_explanation.length} / 20 minimum characters
                                        </p>
                                    </div>
                                )}

                                {/* Officer Notes */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Officer Notes</label>
                                    <textarea
                                        value={newRec.officer_notes}
                                        onChange={(e) => setNewRec({ ...newRec, officer_notes: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green"
                                        rows="2"
                                        placeholder="Any additional notes or observations..."
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowNewReconciliation(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    className="flex-1 px-4 py-2 bg-safaricom-green text-white rounded-lg hover:bg-safaricom-dark transition-colors font-bold"
                                >
                                    Submit Reconciliation
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {showDetailModal && selectedReconciliation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-800">Reconciliation Details</h3>
                                    <p className="text-sm text-gray-500 mt-1">{selectedReconciliation.reconciliation_number}</p>
                                </div>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <FaCircleXmark className="text-gray-600" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Summary would go here */}
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-gray-500 font-bold">Date</p>
                                        <p className="text-gray-900">{new Date(selectedReconciliation.reconciliation_date).toLocaleDateString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 font-bold">Officer</p>
                                        <p className="text-gray-900">{selectedReconciliation.officer_name}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 font-bold">Expected Cash</p>
                                        <p className="text-gray-900 font-mono">KES {selectedReconciliation.expected_cash.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 font-bold">Declared Cash</p>
                                        <p className="text-gray-900 font-mono">KES {selectedReconciliation.total_declared.toLocaleString()}</p>
                                    </div>
                                    {selectedReconciliation.variance_explanation && (
                                        <div className="col-span-2">
                                            <p className="text-gray-500 font-bold">Variance Explanation</p>
                                            <p className="text-gray-900 bg-yellow-50 p-3 rounded">{selectedReconciliation.variance_explanation}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CashReconciliation;
