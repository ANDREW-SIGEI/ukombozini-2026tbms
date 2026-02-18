import React, { useState, useEffect, useMemo } from 'react';
import {
    FaMoneyBillWave, FaCalculator, FaCheckCircle,
    FaExclamationTriangle, FaFileInvoiceDollar, FaHandHoldingDollar,
    FaArrowRight, FaSync
} from 'react-icons/fa';

/**
 * UKOMBOZINI Allocation Matrix - Table Banking "Sharing" Component
 * Used to distribute "Money on the Table" before closing a meeting session.
 */
const AllocationMatrix = ({ totalCashIn, onAllocationChange, onSubmit, isSubmitting }) => {
    const [allocations, setAllocations] = useState({
        stl_disbursed: 0,
        ltl_disbursed: 0,
        withdrawals: 0,
        welfare_out: 0,
        edu_project_out: 0,
        agri_project_out: 0,
        service_fees: 0
    });

    const [manualServiceFee, setManualServiceFee] = useState(false);

    // Calculate Service Fee automatically based on loans
    const autoServiceFee = useMemo(() => {
        const totalLoans = parseFloat(allocations.stl_disbursed || 0) + parseFloat(allocations.ltl_disbursed || 0);
        if (totalLoans < 10000) return 0;
        if (totalLoans > 300000) return 3000;
        return Math.round(totalLoans * 0.01);
    }, [allocations.stl_disbursed, allocations.ltl_disbursed]);

    // Update service fee when auto-calculation changes (unless user manual override)
    useEffect(() => {
        if (!manualServiceFee) {
            setAllocations(prev => ({ ...prev, service_fees: autoServiceFee }));
        }
    }, [autoServiceFee, manualServiceFee]);

    const totalAllocated = useMemo(() => {
        return Object.values(allocations).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    }, [allocations]);

    const balance = totalCashIn - totalAllocated;
    const isBalanced = Math.abs(balance) < 1; // Allow for small rounding error

    const handleInputChange = (field, value) => {
        const val = parseFloat(value) || 0;
        setAllocations(prev => ({ ...prev, [field]: val }));
        if (field === 'service_fees') setManualServiceFee(true);
    };

    const resetManualFee = () => {
        setManualServiceFee(false);
        setAllocations(prev => ({ ...prev, service_fees: autoServiceFee }));
    };

    // Notify parent of changes
    useEffect(() => {
        if (onAllocationChange) {
            onAllocationChange(allocations, isBalanced);
        }
    }, [allocations, isBalanced, onAllocationChange]);

    return (
        <div className="allocation-matrix-container" style={{
            backgroundColor: '#f8f9fa',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid #dee2e6',
            marginTop: '20px'
        }}>
            <div className="matrix-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, color: '#1a5f2a', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FaCalculator /> Table Banking Allocation Matrix
                </h3>
                <div style={{
                    padding: '8px 15px',
                    borderRadius: '8px',
                    backgroundColor: isBalanced ? '#d4edda' : '#fff3cd',
                    color: isBalanced ? '#155724' : '#856404',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    {isBalanced ? <FaCheckCircle /> : <FaExclamationTriangle />}
                    {isBalanced ? 'Balanced' : `Unbalanced: KES ${balance.toLocaleString()}`}
                </div>
            </div>

            <div className="matrix-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                {/* Total Collections (Reference) */}
                <div className="matrix-card" style={{ padding: '15px', backgroundColor: '#e9ecef', borderRadius: '8px' }}>
                    <label style={{ fontSize: '12px', color: '#6c757d', display: 'block' }}>Money on Table (In)</label>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1a5f2a' }}>
                        KES {totalCashIn.toLocaleString()}
                    </div>
                </div>

                {/* Loans (Out) */}
                <div className="matrix-card" style={{ padding: '15px', backgroundColor: '#fff', border: '1px solid #dee2e6', borderRadius: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#495057' }}>STL Disbursed</label>
                    <input
                        type="number"
                        className="form-control"
                        value={allocations.stl_disbursed || ''}
                        onChange={(e) => handleInputChange('stl_disbursed', e.target.value)}
                        placeholder="0"
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
                    />
                </div>

                <div className="matrix-card" style={{ padding: '15px', backgroundColor: '#fff', border: '1px solid #dee2e6', borderRadius: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#495057' }}>LTL Disbursed</label>
                    <input
                        type="number"
                        className="form-control"
                        value={allocations.ltl_disbursed || ''}
                        onChange={(e) => handleInputChange('ltl_disbursed', e.target.value)}
                        placeholder="0"
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
                    />
                </div>

                {/* Service Fee */}
                <div className="matrix-card" style={{ padding: '15px', backgroundColor: '#fff', border: '1px solid #dee2e6', borderRadius: '8px', position: 'relative' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#495057' }}>Service Fee (Income)</label>
                    <div style={{ display: 'flex', gap: '5px' }}>
                        <input
                            type="number"
                            className="form-control"
                            value={allocations.service_fees || ''}
                            onChange={(e) => handleInputChange('service_fees', e.target.value)}
                            placeholder="0"
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '4px',
                                border: `1px solid ${manualServiceFee ? '#ffc107' : '#ced4da'}`,
                                backgroundColor: manualServiceFee ? '#fffaf0' : '#fff'
                            }}
                        />
                        {manualServiceFee && (
                            <button
                                onClick={resetManualFee}
                                title="Reset to auto-calculated (1%)"
                                style={{ padding: '8px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                <FaSync />
                            </button>
                        )}
                    </div>
                    {!manualServiceFee && (
                        <span style={{ fontSize: '10px', color: '#28a745', position: 'absolute', bottom: '2px', left: '15px' }}>
                            Auto-calculated (1%)
                        </span>
                    )}
                </div>

                {/* Withdrawals */}
                <div className="matrix-card" style={{ padding: '15px', backgroundColor: '#fff', border: '1px solid #dee2e6', borderRadius: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#495057' }}>Withdrawals</label>
                    <input
                        type="number"
                        className="form-control"
                        value={allocations.withdrawals || ''}
                        onChange={(e) => handleInputChange('withdrawals', e.target.value)}
                        placeholder="0"
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
                    />
                </div>

                {/* Projects */}
                <div className="matrix-card" style={{ padding: '15px', backgroundColor: '#fff', border: '1px solid #dee2e6', borderRadius: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#495057' }}>Agri Project Out</label>
                    <input
                        type="number"
                        className="form-control"
                        value={allocations.agri_project_out || ''}
                        onChange={(e) => handleInputChange('agri_project_out', e.target.value)}
                        placeholder="0"
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
                    />
                </div>

                <div className="matrix-card" style={{ padding: '15px', backgroundColor: '#fff', border: '1px solid #dee2e6', borderRadius: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#495057' }}>Edu Project Out</label>
                    <input
                        type="number"
                        className="form-control"
                        value={allocations.edu_project_out || ''}
                        onChange={(e) => handleInputChange('edu_project_out', e.target.value)}
                        placeholder="0"
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
                    />
                </div>

                {/* Welfare */}
                <div className="matrix-card" style={{ padding: '15px', backgroundColor: '#fff', border: '1px solid #dee2e6', borderRadius: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#495057' }}>Welfare Disbursed</label>
                    <input
                        type="number"
                        className="form-control"
                        value={allocations.welfare_out || ''}
                        onChange={(e) => handleInputChange('welfare_out', e.target.value)}
                        placeholder="0"
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
                    />
                </div>
            </div>

            <div className="matrix-footer" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f1f3f5', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="matrix-totals">
                    <span style={{ fontSize: '14px', color: '#495057' }}>Total Allocated: </span>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1a5f2a' }}>KES {totalAllocated.toLocaleString()}</span>
                </div>

                <button
                    onClick={onSubmit}
                    disabled={!isBalanced || isSubmitting}
                    className={`btn ${isBalanced ? 'btn-success' : 'btn-secondary'}`}
                    style={{
                        padding: '10px 30px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        cursor: isBalanced && !isSubmitting ? 'pointer' : 'not-allowed',
                        opacity: isBalanced && !isSubmitting ? 1 : 0.6
                    }}
                >
                    {isSubmitting ? 'Processing...' : 'Submit Final Report'}
                    <FaArrowRight />
                </button>
            </div>

            {!isBalanced && (
                <div style={{ marginTop: '10px', color: '#dc3545', fontSize: '12px', fontStyle: 'italic', textAlign: 'right' }}>
                    * Account must be perfectly balanced (0 variance) to submit.
                </div>
            )}
        </div>
    );
};

export default AllocationMatrix;
