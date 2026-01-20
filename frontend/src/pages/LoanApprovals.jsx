import React, { useState, useEffect } from 'react';
import {
    FaCheckCircle,
    FaTimesCircle,
    FaHourglassHalf,
    FaEye,
    FaMoneyBillWave,
    FaUserTie,
    FaShieldAlt,
    FaHistory,
    FaExclamationTriangle
} from 'react-icons/fa';
import { toast } from 'react-toastify';

// Mock data - replace with API calls
const mockApplications = [
    {
        id: 1,
        application_number: 'APP-202501-0001',
        member_name: 'Hilda Sigei',
        member_phone: '+254712345678',
        group_name: 'Ukombozi Group A',
        loan_type: 'LTL',
        amount: 50000,
        interest_rate: 10,
        duration_months: 12,
        monthly_installment: 4583.33,
        total_repayable: 55000,
        purpose: 'Business expansion - buying stock for my shop',
        status: 'PENDING',
        officer_name: 'John Kamau',
        created_at: '2025-01-19T10:30:00',
        guarantors: [
            { name: 'Mary Wanjiru', phone: '+254722111222' },
            { name: 'Peter Omondi', phone: '+254733444555' }
        ]
    },
    {
        id: 2,
        application_number: 'APP-202501-0002',
        member_name: 'Grace Muthoni',
        member_phone: '+254723456789',
        group_name: 'Ukombozi Group B',
        loan_type: 'STL',
        amount: 10000,
        interest_rate: 5,
        duration_months: 3,
        monthly_installment: 3500,
        total_repayable: 10500,
        purpose: 'School fees for child',
        status: 'ADMIN_REVIEW',
        officer_name: 'Jane Achieng',
        created_at: '2025-01-18T14:20:00',
        guarantors: []
    },
    {
        id: 3,
        application_number: 'APP-202501-0003',
        member_name: 'David Kipchoge',
        member_phone: '+254734567890',
        group_name: 'Ukombozi Group A',
        loan_type: 'LTL',
        amount: 75000,
        interest_rate: 10,
        duration_months: 18,
        monthly_installment: 4583,
        total_repayable: 82500,
        purpose: 'Purchase of dairy cow',
        status: 'ADMIN_APPROVED',
        officer_name: 'John Kamau',
        admin_name: 'Sarah Admin',
        admin_reviewed_at: '2025-01-19T09:15:00',
        admin_comments: 'Member has good repayment history. Approved.',
        created_at: '2025-01-17T11:00:00',
        guarantors: [
            { name: 'Joseph Mutua', phone: '+254745678901' }
        ]
    }
];

const LoanApprovals = () => {
    const [applications, setApplications] = useState(mockApplications);
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [selectedApplication, setSelectedApplication] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [comments, setComments] = useState('');
    const [actionType, setActionType] = useState(''); // 'APPROVE' or 'REJECT'

    // Mock current user - replace with actual auth
    const currentUser = {
        id: 2,
        name: 'Sarah Admin',
        role: 'Admin' // Can be 'Officer', 'Admin', 'Director'
    };

    // Filter applications
    const filteredApplications = applications.filter(app => {
        if (filterStatus === 'ALL') return true;
        return app.status === filterStatus;
    });

    // Get status color
    const getStatusColor = (status) => {
        const colors = {
            'PENDING': 'bg-yellow-100 text-yellow-700 border-yellow-200',
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

    // Get status icon
    const getStatusIcon = (status) => {
        switch (status) {
            case 'PENDING':
            case 'ADMIN_REVIEW':
            case 'DIRECTOR_REVIEW':
                return <FaHourglassHalf />;
            case 'ADMIN_APPROVED':
            case 'APPROVED':
            case 'DISBURSED':
                return <FaCheckCircle />;
            case 'ADMIN_REJECTED':
            case 'REJECTED':
            case 'CANCELLED':
                return <FaTimesCircle />;
            default:
                return <FaHourglassHalf />;
        }
    };

    // Check if current user can approve this application
    const canApprove = (application) => {
        if (currentUser.role === 'Admin' && ['PENDING', 'ADMIN_REVIEW'].includes(application.status)) {
            return true;
        }
        if (currentUser.role === 'Director' && ['ADMIN_APPROVED', 'DIRECTOR_REVIEW'].includes(application.status)) {
            return true;
        }
        return false;
    };

    // Handle approval/rejection
    const handleAction = async (action) => {
        if (!comments.trim() && action === 'REJECT') {
            toast.error('Please provide a reason for rejection');
            return;
        }

        try {
            // Determine next status
            let newStatus;
            if (action === 'APPROVE') {
                if (currentUser.role === 'Admin') {
                    newStatus = 'ADMIN_APPROVED';
                } else if (currentUser.role === 'Director') {
                    newStatus = 'APPROVED';
                }
            } else {
                if (currentUser.role === 'Admin') {
                    newStatus = 'ADMIN_REJECTED';
                } else if (currentUser.role === 'Director') {
                    newStatus = 'REJECTED';
                }
            }

            // Update application (would be API call)
            setApplications(prev => prev.map(app =>
                app.id === selectedApplication.id
                    ? {
                        ...app,
                        status: newStatus,
                        [currentUser.role.toLowerCase() + '_reviewed_by']: currentUser.id,
                        [currentUser.role.toLowerCase() + '_reviewed_at']: new Date().toISOString(),
                        [currentUser.role.toLowerCase() + '_comments']: comments
                    }
                    : app
            ));

            toast.success(`Application ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully!`);
            setShowApprovalModal(false);
            setShowDetailModal(false);
            setComments('');
        } catch (error) {
            console.error('Action error:', error);
            toast.error('Failed to process application');
        }
    };

    // Statistics
    const stats = {
        total: applications.length,
        pending: applications.filter(a => a.status === 'PENDING').length,
        adminReview: applications.filter(a => a.status === 'ADMIN_REVIEW').length,
        directorReview: applications.filter(a => ['ADMIN_APPROVED', 'DIRECTOR_REVIEW'].includes(a.status)).length,
        approved: applications.filter(a => a.status === 'APPROVED').length,
        rejected: applications.filter(a => ['ADMIN_REJECTED', 'REJECTED'].includes(a.status)).length
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-gray-800">Loan Approval Workflow</h2>
                <p className="text-sm text-gray-500 mt-1">Multi-level authorization system for loan applications</p>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-xs text-gray-500 uppercase font-bold">Total Applications</p>
                    <p className="text-2xl font-black text-gray-800 mt-1">{stats.total}</p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-xl shadow-sm border border-yellow-100">
                    <p className="text-xs text-yellow-700 uppercase font-bold">Pending</p>
                    <p className="text-2xl font-black text-yellow-800 mt-1">{stats.pending}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-xl shadow-sm border border-blue-100">
                    <p className="text-xs text-blue-700 uppercase font-bold">Admin Review</p>
                    <p className="text-2xl font-black text-blue-800 mt-1">{stats.adminReview}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-xl shadow-sm border border-purple-100">
                    <p className="text-xs text-purple-700 uppercase font-bold">Director Review</p>
                    <p className="text-2xl font-black text-purple-800 mt-1">{stats.directorReview}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-xl shadow-sm border border-green-100">
                    <p className="text-xs text-green-700 uppercase font-bold">Approved</p>
                    <p className="text-2xl font-black text-green-800 mt-1">{stats.approved}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-xl shadow-sm border border-red-100">
                    <p className="text-xs text-red-700 uppercase font-bold">Rejected</p>
                    <p className="text-2xl font-black text-red-800 mt-1">{stats.rejected}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex flex-wrap gap-2">
                    {['ALL', 'PENDING', 'ADMIN_REVIEW', 'ADMIN_APPROVED', 'DIRECTOR_REVIEW', 'APPROVED', 'REJECTED'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${filterStatus === status
                                    ? 'bg-safaricom-green text-white'
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
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Application #</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Member</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Officer</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredApplications.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="px-6 py-10 text-center text-gray-500">
                                        No loan applications found.
                                    </td>
                                </tr>
                            ) : (
                                filteredApplications.map(app => (
                                    <tr key={app.id} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-gray-900 font-bold">{app.application_number}</td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-bold text-gray-900">{app.member_name}</p>
                                                <p className="text-xs text-gray-500">{app.group_name}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${app.loan_type === 'LTL'
                                                    ? 'bg-purple-100 text-purple-700'
                                                    : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                {app.loan_type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-bold text-gray-900">
                                            KES {app.amount.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border flex items-center gap-1 w-fit ${getStatusColor(app.status)}`}>
                                                {getStatusIcon(app.status)}
                                                {app.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 text-xs">{app.officer_name}</td>
                                        <td className="px-6 py-4 text-gray-500 text-xs">
                                            {new Date(app.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        setSelectedApplication(app);
                                                        setShowDetailModal(true);
                                                    }}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <FaEye />
                                                </button>
                                                {canApprove(app) && (
                                                    <>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedApplication(app);
                                                                setActionType('APPROVE');
                                                                setShowApprovalModal(true);
                                                            }}
                                                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                            title="Approve"
                                                        >
                                                            <FaCheckCircle />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedApplication(app);
                                                                setActionType('REJECT');
                                                                setShowApprovalModal(true);
                                                            }}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Reject"
                                                        >
                                                            <FaTimesCircle />
                                                        </button>
                                                    </>
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

            {/* Detail Modal */}
            {showDetailModal && selectedApplication && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Modal content - keeping it concise for now */}
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-800">Loan Application Details</h3>
                                    <p className="text-sm text-gray-500 mt-1">{selectedApplication.application_number}</p>
                                </div>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <FaTimesCircle className="text-gray-600" />
                                </button>
                            </div>

                            {/* Application details would go here */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500 font-bold uppercase">Member</p>
                                        <p className="text-lg font-bold text-gray-900">{selectedApplication.member_name}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 font-bold uppercase">Amount</p>
                                        <p className="text-lg font-bold text-gray-900">KES {selectedApplication.amount.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 font-bold uppercase">Purpose</p>
                                        <p className="text-sm text-gray-700">{selectedApplication.purpose}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 font-bold uppercase">Duration</p>
                                        <p className="text-sm text-gray-700">{selectedApplication.duration_months} months</p>
                                    </div>
                                </div>

                                {canApprove(selectedApplication) && (
                                    <div className="flex gap-3 pt-4 border-t">
                                        <button
                                            onClick={() => {
                                                setActionType('APPROVE');
                                                setShowApprovalModal(true);
                                            }}
                                            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold"
                                        >
                                            <FaCheckCircle className="inline mr-2" />
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => {
                                                setActionType('REJECT');
                                                setShowApprovalModal(true);
                                            }}
                                            className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-bold"
                                        >
                                            <FaTimesCircle className="inline mr-2" />
                                            Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Approval/Rejection Modal */}
            {showApprovalModal && selectedApplication && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-gray-800 mb-4">
                                {actionType === 'APPROVE' ? 'Approve' : 'Reject'} Application
                            </h3>

                            <div className="mb-4">
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Comments {actionType === 'REJECT' && <span className="text-red-600">*</span>}
                                </label>
                                <textarea
                                    value={comments}
                                    onChange={(e) => setComments(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green"
                                    rows="4"
                                    placeholder={actionType === 'APPROVE' ? 'Optional comments...' : 'Please provide reason for rejection...'}
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowApprovalModal(false);
                                        setComments('');
                                    }}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleAction(actionType)}
                                    className={`flex-1 px-4 py-2 rounded-lg text-white transition-colors font-bold ${actionType === 'APPROVE'
                                            ? 'bg-green-600 hover:bg-green-700'
                                            : 'bg-red-600 hover:bg-red-700'
                                        }`}
                                >
                                    Confirm {actionType === 'APPROVE' ? 'Approval' : 'Rejection'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoanApprovals;
