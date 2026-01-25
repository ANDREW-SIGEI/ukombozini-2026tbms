import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
    FaCircleCheck,
    FaCircleXmark,
    FaHourglassHalf,
    FaEye,
    FaMoneyBillWave,
    FaUserTie,
    FaShieldHalved,
    FaClockRotateLeft,
    FaTriangleExclamation,
    FaPlus,
    FaRotate,
    FaCalculator
} from 'react-icons/fa6';
import { toast } from 'react-toastify';
import api from '../services/api';
import LoanAdvisoryPanel from '../components/LoanAdvisoryPanel';

import { useAuth } from '../context/AuthContext';


const LoanApprovals = () => {
    const { user } = useAuth();
    const location = useLocation();
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [selectedApplication, setSelectedApplication] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showAdvisoryPanel, setShowAdvisoryPanel] = useState(false);

    // Action State
    const [comments, setComments] = useState('');
    const [actionType, setActionType] = useState(''); // 'APPROVE' or 'REJECT'
    const [processing, setProcessing] = useState(false);

    // Create Form State
    const [formData, setFormData] = useState({
        memberId: '',
        groupId: '',
        loanType: 'STL',
        amount: '',
        duration: '',
        purpose: '',
        selectedProduct: null // Track selected loan product
    });
    const [members, setMembers] = useState([]);
    const [groups, setGroups] = useState([]);

    // Initial Data Fetch
    useEffect(() => {
        fetchApplications();
        fetchDropdowns();
    }, []);

    // Check for Auto-Open from URL
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const memberId = params.get('memberId');
        if (memberId) {
            setShowCreateModal(true);
            setFormData(prev => ({ ...prev, memberId: memberId }));
        }
    }, [location]);

    const fetchApplications = async () => {
        setLoading(true);
        try {
            const data = await api.getLoanApplications();
            if (data) {
                setApplications(data);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load loan applications");
        } finally {
            setLoading(false);
        }
    };

    const fetchDropdowns = async () => {
        try {
            const mData = await api.getMembers();
            const gData = await api.getGroups();
            setMembers(mData || []);
            setGroups(gData || []);
        } catch (error) {
            console.error("Error fetching dropdowns", error);
        }
    };

    // Filter Logic
    const filteredApplications = applications.filter(app => {
        if (filterStatus === 'ALL') return true;
        return app.status === filterStatus;
    });

    // Helper: Status Colors
    const getStatusColor = (status) => {
        const colors = {
            'PENDING': 'bg-yellow-100 text-yellow-700 border-yellow-200',
            'OFFICER_SUBMITTED': 'bg-blue-50 text-blue-600 border-blue-200',
            'ADMIN_REVIEW': 'bg-blue-100 text-blue-700 border-blue-200',
            'ADMIN_APPROVED': 'bg-green-100 text-green-700 border-green-200',
            'ADMIN_REJECTED': 'bg-red-100 text-red-700 border-red-200',
            'DIRECTOR_REVIEW': 'bg-purple-100 text-purple-700 border-purple-200',
            'APPROVED': 'bg-green-100 text-green-800 border-green-300',
            'REJECTED': 'bg-red-100 text-red-800 border-red-300',
            'DISBURSED': 'bg-teal-100 text-teal-700 border-teal-200',
            'CANCELLED': 'bg-gray-100 text-gray-700 border-gray-200'
        };
        return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
    };

    const getStatusIcon = (status) => {
        if (['APPROVED', 'DISBURSED', 'ADMIN_APPROVED'].includes(status)) return <FaCircleCheck />;
        if (['REJECTED', 'ADMIN_REJECTED', 'CANCELLED'].includes(status)) return <FaCircleXmark />;
        return <FaHourglassHalf />;
    };

    // Helper: Access Control
    const canApprove = (application) => {
        if (user?.role === 'admin' && ['PENDING', 'OFFICER_SUBMITTED', 'ADMIN_REVIEW'].includes(application.status)) {
            return true;
        }
        if (user?.role === 'director' && ['ADMIN_APPROVED', 'DIRECTOR_REVIEW'].includes(application.status)) {
            return true;
        }
        return false;
    };

    // Handle Loan Product Selection (From Advisory Panel)
    const handleLoanProductSelect = (product) => {
        setFormData({
            ...formData,
            amount: product.loan_amount.toString(),
            duration: product.repayment_period_months.toString(),
            selectedProduct: product
        });
        toast.success(`✓ Selected: KES ${product.loan_amount.toLocaleString()} loan product`);
    };

    // Handle Create Application
    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        setProcessing(true);
        try {
            const selectedMember = members.find(m => m.id === parseInt(formData.memberId));
            if (!selectedMember) {
                toast.error("Invalid Member Selected");
                return;
            }

            const payload = {
                memberId: selectedMember.id,
                groupId: selectedMember.groupId,
                loanType: formData.loanType,
                amount: parseFloat(formData.amount),
                duration: parseInt(formData.duration),
                purpose: formData.purpose,
                monthly_installment: formData.selectedProduct?.monthly_installment || 0,
                principal_portion: formData.selectedProduct?.principal_portion || 0,
                interest_portion: formData.selectedProduct?.interest_portion || 0,
                shares_contribution: formData.selectedProduct?.shares_contribution || 0,
                officerId: user?.id || 'SYSTEM' // Fallback if auto-processing
            };

            await api.submitLoanApplication(payload);
            toast.success("Application Submitted Successfully!");
            setShowCreateModal(false);
            setFormData({ memberId: '', groupId: '', loanType: 'STL', amount: '', duration: '', purpose: '' });
            fetchApplications();
        } catch (error) {
            console.error(error);
            toast.error("Failed to submit application");
        } finally {
            setProcessing(false);
        }
    };

    // Handle Approve/Reject Action
    const handleAction = async () => {
        if (!comments.trim() && actionType === 'REJECT') {
            toast.error('Please provide a reason for rejection');
            return;
        }

        setProcessing(true);
        try {
            let newStatus;
            if (actionType === 'APPROVE') {
                if (user?.role === 'admin') newStatus = 'ADMIN_APPROVED';
                else if (user?.role === 'director') newStatus = 'APPROVED';
                else newStatus = 'OFFICER_SUBMITTED'; // Fallback
            } else {
                if (user?.role === 'admin') newStatus = 'ADMIN_REJECTED';
                else if (user?.role === 'director') newStatus = 'REJECTED';
                else newStatus = 'REJECTED';
            }

            await api.updateApplicationStatus(
                selectedApplication.id,
                newStatus,
                comments,
                user?.id,
                user?.role
            );

            toast.success(`Application ${actionType === 'APPROVE' ? 'approved' : 'rejected'} successfully!`);
            setShowApprovalModal(false);
            setShowDetailModal(false);
            setComments('');
            fetchApplications();
        } catch (error) {
            console.error('Action error:', error);
            toast.error('Failed to process application');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Loan Approval Workflow</h2>
                    <p className="text-sm text-gray-500 mt-1">Institutional Multi-level authorization system</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchApplications}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                        title="Refresh Data"
                    >
                        <FaRotate className={loading ? "animate-spin" : ""} />
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 bg-safaricom-green text-white font-bold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                        <FaPlus /> New Application
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 overflow-x-auto">
                <div className="flex flex-nowrap gap-2">
                    {['ALL', 'PENDING', 'ADMIN_REVIEW', 'ADMIN_APPROVED', 'APPROVED', 'REJECTED'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-4 py-2 rounded-lg font-bold text-xs whitespace-nowrap transition-colors ${filterStatus === status
                                ? 'bg-gray-800 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {status.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </div>

            {/* Applications Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">App #</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Member</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Type</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Amount</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-10 text-center text-gray-500">
                                        <FaHourglassHalf className="animate-spin inline mr-2" /> Loading applications...
                                    </td>
                                </tr>
                            ) : filteredApplications.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-10 text-center text-gray-500">
                                        No applications found in this category.
                                    </td>
                                </tr>
                            ) : (
                                filteredApplications.map(app => (
                                    <tr key={app.id} className="hover:bg-blue-50/50 transition-colors group">
                                        <td className="px-6 py-4 font-mono text-xs font-bold text-gray-600">{app.application_number}</td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-bold text-gray-900">{app.member?.name || 'Unknown'}</p>
                                                <p className="text-[10px] text-gray-500 uppercase">{app.member?.groups?.name || 'Unknown Group'}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${app.loan_type === 'LTL' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {app.loan_type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-bold text-gray-800">
                                            {app.amount_requested?.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border flex items-center gap-1 w-fit ${getStatusColor(app.status)}`}>
                                                {getStatusIcon(app.status)}
                                                {app.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-gray-500">
                                            {new Date(app.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => { setSelectedApplication(app); setShowDetailModal(true); }}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                                    title="View Details"
                                                >
                                                    <FaEye />
                                                </button>
                                                {canApprove(app) && (
                                                    <button
                                                        onClick={() => { setSelectedApplication(app); setActionType('APPROVE'); setShowApprovalModal(true); }}
                                                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                                        title="Approve"
                                                    >
                                                        <FaCircleCheck />
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

            {/* CREATE MODAL */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800">New Loan Application</h3>
                            <button onClick={() => setShowCreateModal(false)}><FaCircleXmark className="text-gray-400 hover:text-red-500 text-xl" /></button>
                        </div>
                        <form onSubmit={handleCreateSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Member</label>
                                <select
                                    className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-green-500 outline-none"
                                    value={formData.memberId}
                                    onChange={e => setFormData({ ...formData, memberId: e.target.value })}
                                    required
                                >
                                    <option value="">Select Member...</option>
                                    {members.map(m => (
                                        <option key={m.id} value={m.id}>{m.name} - {m.groupName}</option>
                                    ))}
                                </select>
                            </div>

                            {/* LOAN ADVISORY PANEL BUTTON */}
                            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <FaCalculator className="text-blue-600" />
                                        <span className="text-xs font-bold text-gray-700 uppercase">Official Loan Products</span>
                                    </div>
                                    {formData.selectedProduct && (
                                        <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full font-bold">
                                            ✓ Selected
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowAdvisoryPanel(true)}
                                    className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-md"
                                >
                                    <FaCalculator />
                                    {formData.selectedProduct ? 'Change Loan Product' : 'View Loan Products'}
                                </button>
                                {formData.selectedProduct && (
                                    <p className="text-xs text-gray-600 mt-2 text-center">
                                        Selected: KES {parseInt(formData.amount).toLocaleString()} for {formData.duration} months
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Loan Type</label>
                                    <select
                                        className="w-full p-3 border rounded-lg bg-gray-50 outline-none"
                                        value={formData.loanType}
                                        onChange={e => setFormData({ ...formData, loanType: e.target.value })}
                                    >
                                        <option value="STL">STL (Short Term)</option>
                                        <option value="LTL">LTL (Long Term)</option>
                                        <option value="EMERGENCY">Emergency</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">
                                        Amount (KES) {formData.selectedProduct && '🔒'}
                                    </label>
                                    <input
                                        type="number"
                                        className={`w-full p-3 border rounded-lg outline-none ${formData.selectedProduct
                                            ? 'bg-gray-100 cursor-not-allowed font-bold text-safaricom-green'
                                            : 'bg-gray-50'
                                            }`}
                                        value={formData.amount}
                                        onChange={e => !formData.selectedProduct && setFormData({ ...formData, amount: e.target.value })}
                                        required
                                        min="100"
                                        readOnly={!!formData.selectedProduct}
                                        title={formData.selectedProduct ? 'Amount locked by selected loan product' : ''}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">
                                        Duration (Months) {formData.selectedProduct && '🔒'}
                                    </label>
                                    <input
                                        type="number"
                                        className={`w-full p-3 border rounded-lg outline-none ${formData.selectedProduct
                                            ? 'bg-gray-100 cursor-not-allowed font-bold text-safaricom-green'
                                            : 'bg-gray-50'
                                            }`}
                                        value={formData.duration}
                                        onChange={e => !formData.selectedProduct && setFormData({ ...formData, duration: e.target.value })}
                                        required
                                        min="1"
                                        readOnly={!!formData.selectedProduct}
                                        title={formData.selectedProduct ? 'Duration locked by selected loan product' : ''}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Purpose</label>
                                <textarea
                                    className="w-full p-3 border rounded-lg bg-gray-50 outline-none"
                                    rows="3"
                                    value={formData.purpose}
                                    onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                                    placeholder="e.g. School fees, Business stock..."
                                    required
                                ></textarea>
                            </div>
                            <button
                                type="submit"
                                disabled={processing}
                                className="w-full py-3 bg-safaricom-green text-white font-bold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                                {processing ? 'Submitting...' : 'Submit Application'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* APPROVAL MODAL */}
            {showApprovalModal && selectedApplication && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-2">
                            {actionType === 'APPROVE' ? `Approve Application` : `Reject Application`}
                        </h3>
                        <div className="bg-gray-50 p-3 rounded-lg mb-4 text-sm">
                            <div className="flex justify-between mb-1">
                                <span className="text-gray-500">Applicant:</span>
                                <span className="font-bold">{selectedApplication.member?.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Amount:</span>
                                <span className="font-bold">KES {selectedApplication.amount_requested?.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                Reviewer Comments {actionType === 'REJECT' && <span className="text-red-500">*</span>}
                            </label>
                            <textarea
                                value={comments}
                                onChange={(e) => setComments(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 outline-none"
                                rows="3"
                                placeholder={actionType === 'APPROVE' ? 'Optional notes...' : 'Reason for rejection required...'}
                            />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowApprovalModal(false)} className="flex-1 py-2 border rounded-lg font-bold text-gray-600 hover:bg-gray-50">Cancel</button>
                            <button
                                onClick={handleAction}
                                disabled={processing}
                                className={`flex-1 py-2 rounded-lg font-bold text-white ${actionType === 'APPROVE' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                            >
                                {processing ? 'Processing...' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DETAIL MODAL (Simplified) */}
            {showDetailModal && selectedApplication && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-800">Application Details</h3>
                                <p className="text-sm font-mono text-gray-500">{selectedApplication.application_number}</p>
                            </div>
                            <button onClick={() => setShowDetailModal(false)}><FaCircleXmark className="text-gray-400 hover:text-red-500 text-2xl" /></button>
                        </div>

                        <div className="grid grid-cols-2 gap-6 mb-6">
                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs text-gray-500 font-bold uppercase">Applicant</p>
                                    <p className="text-lg font-bold text-gray-900">{selectedApplication.member?.name}</p>
                                    <p className="text-sm text-gray-600">{selectedApplication.member?.groups?.name}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-bold uppercase">Loan Amount</p>
                                    <p className="text-2xl font-black text-safaricom-green">KES {selectedApplication.amount_requested?.toLocaleString()}</p>
                                    <p className="text-sm font-bold text-gray-500">{selectedApplication.loan_type} loan for {selectedApplication.duration_months} months</p>
                                    {selectedApplication.monthly_installment > 0 && (
                                        <div className="mt-2 space-y-1 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-gray-500">Monthly:</span>
                                                <span className="font-bold text-gray-800 text-sm">KES {selectedApplication.monthly_installment.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-[10px]">
                                                <span className="text-gray-500">Interest:</span>
                                                <span className="text-gray-700">KES {selectedApplication.interest_portion?.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-[10px]">
                                                <span className="text-gray-500">Shares:</span>
                                                <span className="text-gray-700">KES {selectedApplication.shares_contribution?.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs text-gray-500 font-bold uppercase">Current Status</p>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase inline-block mt-1 ${getStatusColor(selectedApplication.status)}`}>
                                        {selectedApplication.status.replace('_', ' ')}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-bold uppercase">Purpose</p>
                                    <p className="text-sm text-gray-700 italic">"{selectedApplication.purpose}"</p>
                                </div>
                            </div>
                        </div>

                        {/* ACTION BUTTONS IN DETAIL VIEW */}
                        {canApprove(selectedApplication) && (
                            <div className="flex gap-4 pt-6 border-t border-gray-100">
                                <button
                                    onClick={() => { setActionType('APPROVE'); setShowApprovalModal(true); setShowDetailModal(false); }}
                                    className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold flex justify-center items-center gap-2"
                                >
                                    <FaCircleCheck /> Approve Request
                                </button>
                                <button
                                    onClick={() => { setActionType('REJECT'); setShowApprovalModal(true); setShowDetailModal(false); }}
                                    className="flex-1 py-3 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 font-bold flex justify-center items-center gap-2"
                                >
                                    <FaCircleXmark /> Reject Request
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* LOAN ADVISORY PANEL */}
            <LoanAdvisoryPanel
                isOpen={showAdvisoryPanel}
                onClose={() => setShowAdvisoryPanel(false)}
                onSelectLoan={handleLoanProductSelect}
            />
        </div>
    );
};

export default LoanApprovals;
