import React, { useState, useEffect } from 'react';
import {
    FaCalculator, FaXmark, FaMoneyBillWave, FaCalendarDays,
    FaPercent, FaHandHoldingDollar, FaCircleInfo
} from 'react-icons/fa6';
import api from '../services/api';

/**
 * UKOMBOZI LOAN ADVISORY PANEL
 * Read-only loan calculator for field officers
 * Shows official standardized loan products
 */
const LoanAdvisoryPanel = ({ isOpen, onClose, onSelectLoan }) => {
    const [loanProducts, setLoanProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            fetchLoanProducts();
        }
    }, [isOpen]);

    const fetchLoanProducts = async () => {
        setLoading(true);
        try {
            const products = await api.getLoanProducts();
            setLoanProducts(products || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectProduct = (product) => {
        setSelectedProduct(product);
    };

    const handleConfirmSelection = () => {
        if (selectedProduct && onSelectLoan) {
            onSelectLoan(selectedProduct);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <div className="bg-white rounded-3xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-safaricom-green to-green-600 p-6 text-white">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-2xl font-black flex items-center gap-3">
                                <div className="p-3 bg-white/20 rounded-2xl">
                                    <FaCalculator />
                                </div>
                                Official Loan Products
                            </h3>
                            <p className="text-sm opacity-90 mt-1">
                                UKOMBOZI Standardized Loan Matrix - Click to Select
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl transition-all"
                        >
                            <FaXmark size={20} />
                        </button>
                    </div>
                </div>

                {/* Products Grid */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin text-safaricom-green text-4xl mb-4">⏳</div>
                            <p className="text-gray-500 font-bold">Loading loan products...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {loanProducts.map((product) => (
                                <div
                                    key={product.id}
                                    onClick={() => handleSelectProduct(product)}
                                    className={`border-2 rounded-2xl p-5 cursor-pointer transition-all ${selectedProduct?.id === product.id
                                        ? 'border-safaricom-green bg-green-50 shadow-lg scale-105'
                                        : 'border-gray-200 hover:border-green-300 hover:shadow-md'
                                        }`}
                                >
                                    {/* Loan Amount Header */}
                                    <div className="text-center mb-4 pb-4 border-b-2 border-gray-100">
                                        <div className="text-xs font-bold text-gray-400 uppercase mb-1">Loan Amount</div>
                                        <div className="text-3xl font-black text-safaricom-green">
                                            KES {product.loan_amount.toLocaleString()}
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div className="space-y-3">
                                        <InfoRow
                                            icon={<FaMoneyBillWave className="text-blue-500" />}
                                            label="Monthly Installment"
                                            value={`KES ${product.monthly_installment.toLocaleString()}`}
                                            highlight={true}
                                        />
                                        <InfoRow
                                            icon={<FaCalendarDays className="text-purple-500" />}
                                            label="Repayment Period"
                                            value={`${product.repayment_period_months} Months`}
                                        />
                                        <InfoRow
                                            icon={<FaPercent className="text-orange-500" />}
                                            label="Total Interest"
                                            value={`KES ${product.interest_portion.toLocaleString()}`}
                                        />
                                        <InfoRow
                                            icon={<FaHandHoldingDollar className="text-green-500" />}
                                            label="Shares Contribution"
                                            value={`KES ${product.shares_contribution.toLocaleString()}`}
                                        />

                                        <div className="pt-3 mt-3 border-t-2 border-gray-100">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-bold text-gray-500 uppercase">Total Repayable</span>
                                                <span className="text-lg font-black text-gray-900">
                                                    KES {product.total_repayable.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {selectedProduct?.id === product.id && (
                                        <div className="mt-4 bg-safaricom-green/10 border-2 border-safaricom-green rounded-xl p-3 text-center">
                                            <div className="text-xs font-black text-safaricom-green uppercase">✓ Selected</div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t-2 border-gray-100 p-6 bg-gray-50">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-start gap-2 text-xs text-gray-600">
                            <FaCircleInfo className="text-blue-500 mt-0.5" />
                            <p>
                                <span className="font-bold">Policy-Controlled:</span> These are official UKOMBOZI loan products.
                                Officers cannot modify terms. Select a product to auto-fill the application.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="px-6 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmSelection}
                                disabled={!selectedProduct}
                                className="px-6 py-3 bg-safaricom-green text-white rounded-xl font-bold hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                            >
                                Use Selected Product
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper Component
const InfoRow = ({ icon, label, value, highlight }) => (
    <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
            {icon}
            <span className="text-xs text-gray-500 font-bold">{label}</span>
        </div>
        <span className={`font-bold ${highlight ? 'text-base text-safaricom-dark' : 'text-sm text-gray-700'}`}>
            {value}
        </span>
    </div>
);

export default LoanAdvisoryPanel;
