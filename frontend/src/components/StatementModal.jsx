import React, { useState } from 'react';
import { FaTimes, FaFileDownload, FaCalendarAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../services/api';

const StatementModal = ({ isOpen, onClose, member, transactions }) => {
    const [periodType, setPeriodType] = useState('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    if (!isOpen) return null;

    const handleGenerate = async () => {
        try {
            let startDate = null;
            let endDate = null;

            switch (periodType) {
                case '3months':
                    const threeMonthsAgo = new Date();
                    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                    startDate = threeMonthsAgo.toISOString().split('T')[0];
                    break;

                case '6months':
                    const sixMonthsAgo = new Date();
                    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                    startDate = sixMonthsAgo.toISOString().split('T')[0];
                    break;

                case '12months':
                    const twelveMonthsAgo = new Date();
                    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
                    startDate = twelveMonthsAgo.toISOString().split('T')[0];
                    break;

                case 'custom':
                    if (!customStartDate || !customEndDate) {
                        toast.error('Please select both start and end dates');
                        return;
                    }
                    startDate = customStartDate;
                    endDate = customEndDate;
                    break;

                case 'all':
                default:
                    break;
            }

            toast.info('📄 Generating Statement PDF...');
            await api.downloadMemberStatement(member.id, startDate, endDate);
            toast.success(`Statement generated successfully`);
            onClose();
        } catch (error) {
            console.error('Statement generation error:', error);
            toast.error('Failed to generate statement from server');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-safaricom-green to-safaricom-dark p-5 text-white">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <FaFileDownload className="text-2xl" />
                            <div>
                                <h3 className="text-xl font-bold">Generate Member Statement</h3>
                                <p className="text-sm text-blue-100">{member.name}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <FaTimes />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3">
                            <FaCalendarAlt className="inline mr-2" />
                            Select Statement Period
                        </label>

                        <div className="space-y-3">
                            {/* Predefined periods */}
                            <label className="flex items-center p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                <input
                                    type="radio"
                                    name="period"
                                    value="3months"
                                    checked={periodType === '3months'}
                                    onChange={(e) => setPeriodType(e.target.value)}
                                    className="mr-3 w-4 h-4 text-safaricom-green"
                                />
                                <div>
                                    <p className="font-bold text-gray-800">Last 3 Months</p>
                                    <p className="text-xs text-gray-500">Most recent quarterly statement</p>
                                </div>
                            </label>

                            <label className="flex items-center p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                <input
                                    type="radio"
                                    name="period"
                                    value="6months"
                                    checked={periodType === '6months'}
                                    onChange={(e) => setPeriodType(e.target.value)}
                                    className="mr-3 w-4 h-4 text-safaricom-green"
                                />
                                <div>
                                    <p className="font-bold text-gray-800">Last 6 Months</p>
                                    <p className="text-xs text-gray-500">Half-yearly statement</p>
                                </div>
                            </label>

                            <label className="flex items-center p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                <input
                                    type="radio"
                                    name="period"
                                    value="12months"
                                    checked={periodType === '12months'}
                                    onChange={(e) => setPeriodType(e.target.value)}
                                    className="mr-3 w-4 h-4 text-safaricom-green"
                                />
                                <div>
                                    <p className="font-bold text-gray-800">Last 12 Months</p>
                                    <p className="text-xs text-gray-500">Annual statement</p>
                                </div>
                            </label>

                            <label className="flex items-center p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                <input
                                    type="radio"
                                    name="period"
                                    value="all"
                                    checked={periodType === 'all'}
                                    onChange={(e) => setPeriodType(e.target.value)}
                                    className="mr-3 w-4 h-4 text-safaricom-green"
                                />
                                <div>
                                    <p className="font-bold text-gray-800">All Time</p>
                                    <p className="text-xs text-gray-500">Complete transaction history</p>
                                </div>
                            </label>

                            <label className="flex items-start p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                <input
                                    type="radio"
                                    name="period"
                                    value="custom"
                                    checked={periodType === 'custom'}
                                    onChange={(e) => setPeriodType(e.target.value)}
                                    className="mr-3 w-4 h-4 text-safaricom-green mt-1"
                                />
                                <div className="flex-1">
                                    <p className="font-bold text-gray-800 mb-2">Custom Range</p>
                                    {periodType === 'custom' && (
                                        <div className="grid grid-cols-2 gap-3 mt-2">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1">Start Date</label>
                                                <input
                                                    type="date"
                                                    value={customStartDate}
                                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-safaricom-green/20"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1">End Date</label>
                                                <input
                                                    type="date"
                                                    value={customEndDate}
                                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-safaricom-green/20"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Info box */}
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r-lg">
                        <p className="text-xs text-blue-700">
                            <span className="font-bold">ℹ️ Statement Information:</span><br />
                            The PDF will include member details, financial summary, detailed transaction history,
                            and active loan information. This is an official, system-generated document suitable
                            for audits and dispute resolution.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors font-bold"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleGenerate}
                        className="px-5 py-2 bg-safaricom-green text-white rounded-lg hover:bg-safaricom-dark transition-colors shadow-sm font-bold flex items-center gap-2"
                    >
                        <FaFileDownload />
                        Generate Statement
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StatementModal;
