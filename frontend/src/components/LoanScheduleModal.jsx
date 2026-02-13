import React from 'react';
import { X, Calendar, CheckCircle, Clock } from 'lucide-react';
import { pdfReportService } from '../services/PDFReportService';

const LoanScheduleModal = ({ isOpen, onClose, schedule, loanDetails }) => {

    const handleExportPDF = () => {
        if (!schedule || schedule.length === 0) return;
        pdfReportService.generateLoanSchedule(loanDetails, schedule);
    };

    if (!isOpen) return null;

    const getStatusIcon = (status) => {
        switch (status?.toLowerCase()) {
            case 'paid':
                return <CheckCircle className="w-4 h-4 text-safaricom-green" />;
            case 'pending':
                return <Clock className="w-4 h-4 text-amber-500" />;
            case 'overdue':
                return <Clock className="w-4 h-4 text-red-500" />;
            default:
                return null;
        }
    };

    const getStatusClass = (status) => {
        switch (status?.toLowerCase()) {
            case 'paid':
                return 'bg-green-100 text-green-700';
            case 'pending':
                return 'bg-amber-100 text-amber-700';
            case 'overdue':
                return 'bg-red-100 text-red-700';
            default:
                return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <Calendar className="text-safaricom-green" />
                            Repayment Schedule
                        </h2>
                        <p className="text-gray-500 mt-1">
                            Loan ID: <span className="font-mono font-bold text-gray-700">{loanDetails?.id}</span> •
                            Member: <span className="font-bold text-gray-700">{loanDetails?.member_name}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {schedule && schedule.length > 0 && (
                            <button
                                onClick={handleExportPDF}
                                className="px-4 py-2 bg-safaricom-green/10 text-safaricom-green hover:bg-safaricom-green hover:text-white rounded-lg font-bold transition-all flex items-center gap-2"
                                title="Download PDF"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <path d="M12 18v-6" />
                                    <path d="M9 15l3 3 3-3" />
                                </svg>
                                Export PDF
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                        >
                            <X className="w-6 h-6 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Content - Unchanged */}
                <div className="p-6 overflow-y-auto">
                    {!schedule || schedule.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Calendar className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-gray-500 font-medium italic">No repayment schedule found for this loan.</p>
                            <p className="text-sm text-gray-400 mt-2">Historical loans or non-standardized products may not have a digital schedule.</p>
                        </div>
                    ) : (
                        <div className="border rounded-xl overflow-hidden overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-700 font-bold uppercase tracking-wider text-xs">
                                    <tr>
                                        <th className="px-4 py-3 border-b">Inst. #</th>
                                        <th className="px-4 py-3 border-b">Due Date</th>
                                        <th className="px-4 py-3 border-b">Expected Installment</th>
                                        <th className="px-4 py-3 border-b text-blue-600">Principal</th>
                                        <th className="px-4 py-3 border-b text-amber-600">Interest</th>
                                        <th className="px-4 py-3 border-b text-emerald-600">Shares</th>
                                        <th className="px-4 py-3 border-b">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {schedule.map((inst, index) => (
                                        <tr key={index} className="hover:bg-gray-50/80 transition-colors">
                                            <td className="px-4 py-3 font-medium text-gray-600">
                                                {inst.installment_number}
                                            </td>
                                            <td className="px-4 py-3 text-gray-700">
                                                {new Date(inst.due_date).toLocaleDateString(undefined, {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })}
                                            </td>
                                            <td className="px-4 py-3 font-bold text-gray-900">
                                                KES {inst.expected_installment?.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-blue-700 font-medium">
                                                KES {inst.expected_principal?.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-amber-700 font-medium">
                                                KES {inst.expected_interest?.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-emerald-700 font-medium">
                                                KES {inst.expected_shares?.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${getStatusClass(inst.status)}`}>
                                                    {getStatusIcon(inst.status)}
                                                    {inst.status}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 text-center">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-800 text-white rounded-lg font-bold hover:bg-gray-700 transition-colors shadow-sm"
                    >
                        Close Schedule
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoanScheduleModal;
