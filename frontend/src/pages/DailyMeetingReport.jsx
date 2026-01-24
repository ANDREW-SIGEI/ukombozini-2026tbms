import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTransactions } from '../context/TransactionContext';
import { mockGroups, mockMembers } from '../data/mockData';
import { validateCashReport, checkSystemAccessBlock } from '../utils/cashReportEnforcement';
import { validateTransaction, requiresSupervisorApproval, getBalanceAlert, validateDisbursement } from '../utils/validationRules';
import { toast } from 'react-toastify';
import {
    FaSave, FaPaperPlane, FaLock, FaCheckCircle, FaTimesCircle,
    FaExclamationTriangle, FaCalculator, FaUsers, FaCalendarAlt, FaBan, FaUserShield
} from 'react-icons/fa';

/**
 * Daily Meeting Report Component
 * Replaces paper cashbook - ONE meeting = ONE session
 * ONE row = ONE member transaction
 */
// Input cell component with Excel-like navigation
const TransactionInput = ({ value, onChange, disabled, memberId, field, rowIndex, colIndex, totalRows, totalCols }) => {
    const inputRef = useRef(null);

    const handleKeyDown = (e) => {
        const { key } = e;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) {
            e.preventDefault();

            let nextRow = rowIndex;
            let nextCol = colIndex;

            if (key === 'ArrowUp') nextRow = Math.max(0, rowIndex - 1);
            if (key === 'ArrowDown' || key === 'Enter') nextRow = Math.min(totalRows - 1, rowIndex + 1);
            if (key === 'ArrowLeft') nextCol = Math.max(0, colIndex - 1);
            if (key === 'ArrowRight') nextCol = Math.min(totalCols - 1, colIndex + 1);

            const nextInput = document.querySelector(`input[data-row="${nextRow}"][data-col="${nextCol}"]`);
            if (nextInput) {
                nextInput.focus();
                nextInput.select();
            }
        }
    };

    return (
        <input
            ref={inputRef}
            type="number"
            min="0"
            step="0.01"
            value={value === 0 ? '' : value} // Show empty for 0 to make typing easier
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            data-row={rowIndex}
            data-col={colIndex}
            className={`w-full px-2 py-1 text-right border rounded focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none font-mono ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                }`}
            placeholder="0"
        />
    );
};

const DailyMeetingReport = () => {
    const { user } = useAuth();
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
    const [sessionStatus, setSessionStatus] = useState('draft'); // draft, POSTED, approved, rejected, locked
    const [openingBalance, setOpeningBalance] = useState(0);
    const [closingBalance, setClosingBalance] = useState(0);
    const [sessionId, setSessionId] = useState(null);
    const [supervisorApprovalRequested, setSupervisorApprovalRequested] = useState(false);
    const [approvalReason, setApprovalReason] = useState('');

    // Cash Verification State
    const [actualCashStart, setActualCashStart] = useState('');
    const [actualCashEnd, setActualCashEnd] = useState('');

    // Access Transaction Context
    const {
        activeSession,
        startSession,
        closeSession,
        extendSession,
        postSession, // Renamed flow: Close -> (Supervisor) -> Post/Approve
        groups // Get groups from context
    } = useTransactions();

    // Timer State
    const [timeRemaining, setTimeRemaining] = useState('');
    const [isExpired, setIsExpired] = useState(false);

    // Sync state with Active Session
    useEffect(() => {
        if (activeSession) {
            setSessionId(activeSession.id);
            setSessionStatus(activeSession.status);

            // Find group from ID
            const group = groups.find(g => g.id === activeSession.groupId);
            setSelectedGroup(group);
            setMeetingDate(activeSession.date);
        } else {
            setSessionId(null);
            setSessionStatus('draft'); // Or 'idle'
            setSelectedGroup(null);
        }
    }, [activeSession, groups]);

    // Timer Logic
    useEffect(() => {
        if (!activeSession || activeSession.status !== 'ACTIVE') return;

        const interval = setInterval(() => {
            const now = new Date();
            const end = new Date(activeSession.endTime);
            const diff = end - now;

            if (diff <= 0) {
                setTimeRemaining("00:00:00");
                setIsExpired(true);
                clearInterval(interval);
            } else {
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeRemaining(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
                setIsExpired(false);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [activeSession]);

    // Member transactions state - ONE ROW PER MEMBER
    const [memberTransactions, setMemberTransactions] = useState([]);

    // Cash out tracking (for loans disbursed)
    const [cashOut, setCashOut] = useState(0);

    // Load members when group is selected
    useEffect(() => {
        if (selectedGroup) {
            const groupMembers = mockMembers.filter(m => m.groupId === selectedGroup.id);
            const groupOpeningBalance = selectedGroup.openingBalance || 0;

            // Initialize member transactions (one row per member)
            const initialTransactions = groupMembers.map(member => ({
                id: `temp-${member.id}`,
                memberId: member.id,
                memberName: member.name,
                // MOCK BF VALUES (Read-Only)
                ltl_bf: Math.floor(Math.random() * 50000) + 10000,
                stl_bf: Math.floor(Math.random() * 20000) + 5000,
                savings_bf: Math.floor(Math.random() * 100000) + 20000,
                savings_amount: 0,
                stl_repayment: 0,
                ltl_repayment: 0,
                loan_interest: 0,
                loan_principal: 0,
                welfare: 0,
                project: 0,
                fines: 0,
            }));

            setMemberTransactions(initialTransactions);
            setOpeningBalance(groupOpeningBalance);
            setClosingBalance(groupOpeningBalance);
        }
    }, [selectedGroup]);

    // Calculate totals in real-time (SYSTEM-ONLY, prevents tampering)
    const systemTotals = useMemo(() => {
        return memberTransactions.reduce((totals, transaction) => {
            totals.total_savings += parseFloat(transaction.savings_amount || 0);
            totals.total_stl += parseFloat(transaction.stl_repayment || 0) +
                parseFloat(transaction.loan_interest || 0) +
                parseFloat(transaction.loan_principal || 0);
            totals.total_ltl += parseFloat(transaction.ltl_repayment || 0);
            totals.total_welfare += parseFloat(transaction.welfare || 0);
            totals.total_fines += parseFloat(transaction.fines || 0);
            totals.total_cash_in += parseFloat(transaction.savings_amount || 0) +
                parseFloat(transaction.stl_repayment || 0) +
                parseFloat(transaction.ltl_repayment || 0) +
                parseFloat(transaction.loan_interest || 0) +
                parseFloat(transaction.loan_principal || 0) +
                parseFloat(transaction.welfare || 0) +
                parseFloat(transaction.project || 0) +
                parseFloat(transaction.fines || 0);
            return totals;
        }, {
            total_savings: 0,
            total_stl: 0,
            total_ltl: 0,
            total_welfare: 0,
            total_fines: 0,
            total_cash_in: 0,
        });
    }, [memberTransactions]);

    // Calculate closing balance (opening + cash in - cash out)
    useEffect(() => {
        const calculatedClosing = openingBalance + systemTotals.total_cash_in - cashOut;
        setClosingBalance(calculatedClosing);
    }, [openingBalance, systemTotals.total_cash_in, cashOut]);

    // Get balance alert
    const balanceAlert = useMemo(() => {
        return getBalanceAlert(closingBalance, openingBalance);
    }, [closingBalance, openingBalance]);

    // Check if supervisor approval is required
    const needsSupervisorApproval = useMemo(() => {
        const sessionData = {
            openingBalance,
            closingBalance,
            cashIn: systemTotals.total_cash_in,
            cashOut,
        };
        // Mock validation - in production, validate all transactions
        return requiresSupervisorApproval(sessionData, []);
    }, [openingBalance, closingBalance, systemTotals.total_cash_in, cashOut]);

    // Update member transaction field with validation
    const updateMemberTransaction = (memberId, field, value) => {
        if (sessionStatus !== 'draft') {
            toast.error('Cannot edit after submission. Contact supervisor to unlock.');
            return;
        }

        const numValue = parseFloat(value) || 0;
        if (numValue < 0) {
            toast.error('Negative values not allowed');
            return;
        }

        // If updating loan principal, validate disbursement
        if (field === 'loan_principal' && numValue > 0) {
            const availableCash = openingBalance + systemTotals.total_cash_in;
            const validation = validateDisbursement(numValue, availableCash);
            if (!validation.allowed) {
                toast.error(validation.reason);
                return;
            }
            // Update cash out
            setCashOut(prev => {
                const member = memberTransactions.find(t => t.memberId === memberId);
                const oldLoanPrincipal = member?.loan_principal || 0;
                return prev - oldLoanPrincipal + numValue;
            });
        }

        setMemberTransactions(prev => prev.map(t => {
            if (t.memberId === memberId) {
                return { ...t, [field]: numValue };
            }
            return t;
        }));
    };

    // Calculate total paid for a member (auto-calculated, not editable)
    const calculateMemberTotal = (transaction) => {
        return (
            parseFloat(transaction.savings_amount || 0) +
            parseFloat(transaction.stl_repayment || 0) +
            parseFloat(transaction.ltl_repayment || 0) +
            parseFloat(transaction.loan_interest || 0) +
            parseFloat(transaction.loan_principal || 0) +
            parseFloat(transaction.welfare || 0) +
            parseFloat(transaction.project || 0) +
            parseFloat(transaction.fines || 0)
        );
    };

    // Validate before submission
    const validateSession = () => {
        const errors = [];
        const warnings = [];

        if (!selectedGroup) {
            errors.push('Please select a group');
        }

        if (memberTransactions.length === 0) {
            errors.push('No members found for this group');
        }

        // Check for negative balances (CRITICAL)
        if (closingBalance < 0) {
            errors.push({
                type: 'NEGATIVE_BALANCE',
                message: `Negative closing balance: KES ${Math.abs(closingBalance).toLocaleString()}. Requires supervisor approval.`,
                severity: 'critical',
            });
        }

        // Check if all members have at least one transaction
        const membersWithNoTransactions = memberTransactions.filter(t => calculateMemberTotal(t) === 0);
        if (membersWithNoTransactions.length === memberTransactions.length) {
            errors.push('At least one member must have transactions');
        }

        // Validate each transaction
        memberTransactions.forEach(t => {
            const member = mockMembers.find(m => m.id === t.memberId);
            const sessionData = {
                openingBalance,
                closingBalance,
                cashIn: systemTotals.total_cash_in,
                cashOut,
            };
            const validation = validateTransaction(t, member || {}, sessionData);
            errors.push(...validation.errors);
            warnings.push(...validation.warnings);
        });

        return { errors, warnings };
    };

    // Save draft
    const handleSaveDraft = () => {
        // In production: Save to IndexedDB for offline support
        toast.success('Draft saved locally');
        // TODO: Save to IndexedDB
    };

    // Start Meeting (was handleOpenSession)
    const handleStartMeeting = () => {
        if (!selectedGroup) {
            toast.error('Please select a group first');
            return;
        }

        // Use context to start (persisted)
        // Mock Officer
        const officer = { id: user?.id || 1, name: user?.name || 'Hilda Sigei' };
        startSession(selectedGroup, officer);
    };

    // Submit session (Close Meeting)
    const handleCloseMeeting = () => {
        const validation = validateSession();

        // Show warnings
        validation.warnings.forEach(warning => {
            toast.warning(warning.message, { autoClose: 5000 });
        });

        // Check for critical errors (same logic as before)
        const criticalErrors = validation.errors.filter(e =>
            typeof e === 'object' && e.severity === 'critical'
        );

        if (criticalErrors.length > 0) {
            if (criticalErrors.some(e => e.type === 'NEGATIVE_BALANCE')) {
                if (!supervisorApprovalRequested) {
                    toast.error('Cannot close: Negative balance requires supervisor approval');
                    return;
                }
            } else {
                criticalErrors.forEach(error => toast.error(error.message || error));
                return;
            }
        }
        // ... (rest of validation)

        // Submit to Context as PENDING_APPROVAL
        const balances = { opening: openingBalance, closing: closingBalance };
        closeSession(systemTotals, memberTransactions, balances);
    };

    // Request supervisor approval
    const handleRequestSupervisorApproval = () => {
        if (!approvalReason.trim()) {
            toast.error('Please provide a reason for supervisor approval');
            return;
        }

        setSupervisorApprovalRequested(true);
        toast.success('Supervisor approval requested. Waiting for approval...');

        // TODO: Send approval request to supervisor via API
    };

    // Submit session
    const handleSubmit = () => {
        const validation = validateSession();

        // Show warnings
        validation.warnings.forEach(warning => {
            toast.warning(warning.message, { autoClose: 5000 });
        });

        // Check for critical errors
        const criticalErrors = validation.errors.filter(e =>
            typeof e === 'object' && e.severity === 'critical'
        );

        if (criticalErrors.length > 0) {
            // Negative balance requires supervisor approval
            if (criticalErrors.some(e => e.type === 'NEGATIVE_BALANCE')) {
                if (!supervisorApprovalRequested) {
                    toast.error('Cannot submit: Negative balance requires supervisor approval');
                    return;
                }
            } else {
                criticalErrors.forEach(error => toast.error(error.message || error));
                return;
            }
        }

        // Regular errors
        const regularErrors = validation.errors.filter(e => typeof e === 'string' || (typeof e === 'object' && e.severity !== 'critical'));
        if (regularErrors.length > 0) {
            regularErrors.forEach(error => toast.error(typeof error === 'string' ? error : error.message));
            return;
        }

        // Validate using cash report enforcement
        const reportData = {
            openingBalance,
            cashCollected: systemTotals.total_cash_in,
            cashIssued: cashOut,
            expectedClosing: openingBalance + systemTotals.total_cash_in - cashOut,
            actualClosing: closingBalance,
            variance: 0,
            varianceExplanation: approvalReason,
            requireVarianceExplanation: closingBalance < 0,
        };

        const cashValidation = validateCashReport(reportData);
        if (!cashValidation.valid) {
            cashValidation.errors.forEach(error => toast.error(error));
            return;
        }

        // Submit to Transaction Context (Simulated Backend)
        const sessionMetadata = {
            id: sessionId,
            groupId: selectedGroup.id,
            groupName: selectedGroup.name,
            date: meetingDate,
            officerId: user?.id || '4052', // Mock ID if user not fully loaded
            status: 'POSTED',
            totals: systemTotals,
            openingBalance,
            closingBalance
        };

        const success = postSession(sessionMetadata, memberTransactions);

        if (success) {
            setSessionStatus('POSTED');
            // toast handled in postSession
        }
    };

    // Open new session
    // SUPERVISOR APPROVAL (Mocked Action)
    const handleSupervisorApprove = () => {
        // This effectively POSTS the session to the ledger
        // In a real app, this would be a separate screen for the Supervisor
        const sessionMetadata = {
            id: sessionId, // This is the ID of the 'PENDING' session
            groupId: selectedGroup.id,
            groupName: selectedGroup.name,
            date: meetingDate,
            officerId: user?.id || '4052',
            status: 'POSTED',
            totals: systemTotals,
            openingBalance,
            closingBalance
        };

        const success = postSession(sessionMetadata, memberTransactions);
        if (success) {
            setSessionStatus('POSTED'); // Local update
        }
    };



    return (
        <div className="space-y-6 pb-10">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                            <FaCalendarAlt className="mr-3 text-safaricom-green" />
                            Daily Meeting Report
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Enter member transactions - ONE ROW PER MEMBER</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold ${sessionStatus === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                            sessionStatus === 'POSTED' ? 'bg-blue-100 text-blue-700' :
                                sessionStatus === 'approved' ? 'bg-green-100 text-green-700' :
                                    'bg-gray-100 text-gray-700'
                            }`}>
                            {sessionStatus.toUpperCase()}
                        </span>
                    </div>
                </div>

                {/* Group & Date Selection */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                            <FaUsers className="inline mr-1" /> Select Group
                        </label>
                        <select
                            value={selectedGroup?.id || ''}
                            onChange={(e) => {
                                const group = groups.find(g => g.id === parseInt(e.target.value));
                                setSelectedGroup(group);
                            }}
                            disabled={sessionStatus !== 'draft' && sessionId !== null}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none disabled:bg-gray-100"
                        >
                            <option value="">-- Select Group --</option>
                            {groups.map(group => (
                                <option key={group.id} value={group.id}>{group.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                            <FaCalendarAlt className="inline mr-1" /> Meeting Date
                        </label>
                        <input
                            type="date"
                            value={meetingDate}
                            onChange={(e) => setMeetingDate(e.target.value)}
                            disabled={sessionStatus !== 'draft' && sessionId !== null}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none disabled:bg-gray-100"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                            Opening Balance
                        </label>
                        <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg font-bold text-gray-800">
                            KES {openingBalance.toLocaleString()}
                        </div>
                    </div>
                </div>

                {/* Action Buttons: Start or Timer */}
                {!activeSession && !sessionId ? (
                    <button
                        onClick={handleStartMeeting}
                        disabled={!selectedGroup}
                        className="mt-4 w-full bg-safaricom-green hover:bg-safaricom-dark text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <FaCalculator /> Start Group Meeting (2 Hours)
                    </button>
                ) : (
                    /* ACTIVE SESSION HEADER */
                    <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-gray-800">Meeting in Progress</h3>
                                <p className="text-xs text-gray-500">Started at: {new Date(activeSession?.startTime).toLocaleTimeString()}</p>
                            </div>
                            <div className={`text-right ${isExpired ? 'text-red-600' : 'text-blue-600'}`}>
                                <div className="text-xs font-bold uppercase">Time Remaining</div>
                                <div className="text-2xl font-mono font-bold tracking-wider">
                                    {timeRemaining}
                                </div>
                                {isExpired && <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded">EXPIRED</span>}
                            </div>
                        </div>

                        {/* ADMIN EXTEND (Mock) */}
                        {isExpired && (
                            <div className="mt-3 pt-3 border-t border-gray-200 flex justify-end">
                                <button
                                    onClick={() => extendSession(30, "Officer Request")}
                                    className="text-xs bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-gray-700 font-bold"
                                >
                                    + Add 30 Mins (Admin)
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Balance Alert Banner */}
            {sessionId && (
                <div className={`${balanceAlert.bgColor} ${balanceAlert.borderColor} border-2 rounded-xl p-4`}>
                    <div className="flex items-start gap-3">
                        <div className={`text-2xl ${balanceAlert.textColor}`}>
                            {balanceAlert.icon}
                        </div>
                        <div className="flex-1">
                            <h3 className={`font-bold ${balanceAlert.textColor} mb-1`}>
                                {balanceAlert.level === 'critical' ? 'CRITICAL ALERT' :
                                    balanceAlert.level === 'warning' ? 'WARNING' : 'BALANCE STATUS'}
                            </h3>
                            <p className={`text-sm ${balanceAlert.textColor}`}>
                                {balanceAlert.message}
                            </p>
                            {balanceAlert.level === 'critical' && (
                                <div className="mt-3 text-xs font-bold">
                                    Available for Disbursement: <span className="text-red-700">KES {(openingBalance + systemTotals.total_cash_in).toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Supervisor Approval Request Form */}
            {sessionId && needsSupervisorApproval && !supervisorApprovalRequested && (
                <div className="bg-red-50 border-2 border-red-500 rounded-xl p-6">
                    <div className="flex items-start gap-3 mb-4">
                        <FaUserShield className="text-red-600 text-xl mt-1" />
                        <div>
                            <h3 className="font-bold text-red-900 text-lg">Supervisor Approval Required</h3>
                            <p className="text-sm text-red-700 mt-1">
                                This session cannot be submitted without supervisor approval due to negative balance or critical validation errors.
                            </p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-bold text-red-800 mb-2">
                                Reason for Approval Request *
                            </label>
                            <textarea
                                value={approvalReason}
                                onChange={(e) => setApprovalReason(e.target.value)}
                                placeholder="Explain why supervisor approval is needed (e.g., emergency loan, member withdrawal, etc.)"
                                className="w-full px-4 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                                rows="3"
                            />
                        </div>
                        <button
                            onClick={handleRequestSupervisorApproval}
                            disabled={!approvalReason.trim()}
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <FaUserShield /> Request Supervisor Approval
                        </button>
                    </div>
                </div>
            )}

            {/* Main Transaction Table */}
            {sessionId && memberTransactions.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Sticky Header */}
                    <div className="bg-safaricom-green text-white p-4 sticky top-0 z-10">
                        <h3 className="font-bold text-lg">Member Transactions</h3>
                        <p className="text-xs opacity-90">Enter amounts for each member - totals update automatically</p>
                    </div>

                    {/* Scrollable Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b-2 border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase sticky left-0 bg-gray-50 z-10 border-r border-gray-200">
                                        Member
                                    </th>
                                    {/* BF COLUMNS (READ-ONLY) */}
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase bg-gray-100 border-r border-gray-200">LTL BF</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase bg-gray-100 border-r border-gray-200">STL BF</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase bg-gray-100 border-r border-gray-200">Savings BF</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Savings</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">STL Repay</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">LTL Repay</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Interest</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Principal</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Welfare</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Project</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Fines</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase bg-green-50">Total Paid</th>
                                </tr>
                            </thead>
                            <tbody>
                                {memberTransactions.map((transaction, index) => {
                                    const memberTotal = calculateMemberTotal(transaction);
                                    // Define validation cols
                                    const cols = ['savings_amount', 'stl_repayment', 'ltl_repayment', 'loan_interest', 'loan_principal', 'welfare', 'project', 'fines'];

                                    return (
                                        <tr
                                            key={transaction.id}
                                            className={`border-b border-gray-100 hover:bg-gray-50 ${memberTotal > 0 ? 'bg-green-50/30' : ''
                                                }`}
                                        >
                                            <td className="px-4 py-3 font-bold text-gray-800 sticky left-0 bg-white z-10 border-r border-gray-100">
                                                {transaction.memberName}
                                            </td>
                                            {/* READ-ONLY BF VALUES */}
                                            <td className="px-4 py-3 text-right font-mono text-gray-500 bg-gray-50 text-xs border-r border-gray-100">
                                                {transaction.ltl_bf.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-gray-500 bg-gray-50 text-xs border-r border-gray-100">
                                                {transaction.stl_bf.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-gray-500 bg-gray-50 text-xs border-r border-gray-100">
                                                {transaction.savings_bf.toLocaleString()}
                                            </td>

                                            {cols.map((col, colIndex) => (
                                                <td key={col} className="px-2 py-2">
                                                    <TransactionInput
                                                        value={transaction[col]}
                                                        onChange={(v) => updateMemberTransaction(transaction.memberId, col, v)}
                                                        disabled={sessionStatus !== 'draft'}
                                                        memberId={transaction.memberId}
                                                        field={col}
                                                        rowIndex={index}
                                                        colIndex={colIndex}
                                                        totalRows={memberTransactions.length}
                                                        totalCols={cols.length}
                                                    />
                                                </td>
                                            ))}

                                            <td className="px-4 py-3 text-right font-bold text-green-700 bg-green-50">
                                                KES {memberTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Sticky Footer with Totals */}
                    <div className="bg-safaricom-green text-white p-4 sticky bottom-0 border-t-4 border-safaricom-dark">
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                            <div>
                                <div className="text-xs opacity-90">Total Savings</div>
                                <div className="font-bold text-lg">KES {systemTotals.total_savings.toLocaleString()}</div>
                            </div>
                            <div>
                                <div className="text-xs opacity-90">Total STL</div>
                                <div className="font-bold text-lg">KES {systemTotals.total_stl.toLocaleString()}</div>
                            </div>
                            <div>
                                <div className="text-xs opacity-90">Total LTL</div>
                                <div className="font-bold text-lg">KES {systemTotals.total_ltl.toLocaleString()}</div>
                            </div>
                            <div>
                                <div className="text-xs opacity-90">Total Welfare</div>
                                <div className="font-bold text-lg">KES {systemTotals.total_welfare.toLocaleString()}</div>
                            </div>
                            <div>
                                <div className="text-xs opacity-90">Total Fines</div>
                                <div className="font-bold text-lg">KES {systemTotals.total_fines.toLocaleString()}</div>
                            </div>
                            <div className="md:col-span-1">
                                <div className="text-xs opacity-90">Total Cash In</div>
                                <div className="font-bold text-xl">KES {systemTotals.total_cash_in.toLocaleString()}</div>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/20">
                            <div className="grid grid-cols-3 gap-4 mb-3">
                                <div>
                                    <div className="text-xs opacity-90">Opening Balance</div>
                                    <div className="font-bold">KES {openingBalance.toLocaleString()}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-xs opacity-90">Cash In</div>
                                    <div className="font-bold">KES {systemTotals.total_cash_in.toLocaleString()}</div>
                                </div>
                                {cashOut > 0 && (
                                    <div className="text-center">
                                        <div className="text-xs opacity-90">Cash Out</div>
                                        <div className="font-bold text-red-200">KES {cashOut.toLocaleString()}</div>
                                    </div>
                                )}
                            </div>
                            <div className={`text-center pt-3 border-t border-white/20 ${closingBalance < 0 ? 'text-red-200' : ''
                                }`}>
                                <div className="text-xs opacity-90 mb-1">Closing Balance</div>
                                <div className={`font-bold text-3xl ${closingBalance < 0 ? 'text-red-200' : ''
                                    }`}>
                                    KES {closingBalance.toLocaleString()}
                                </div>
                                {closingBalance < 0 && (
                                    <div className="text-xs text-red-200 mt-1 font-bold">
                                        ⚠️ NEGATIVE BALANCE - SUPERVISOR APPROVAL REQUIRED
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Buttons & Cash Verification */}
            {sessionId && (sessionStatus === 'draft' || sessionStatus === 'ACTIVE') && (
                <>
                    {/* Cash Verification (Required) */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
                        <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <FaUserShield className="text-blue-600" /> Cash Verification (Required)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <label className="block text-sm font-bold text-gray-600 mb-2">Expected Cash in Hand</label>
                                <div className="text-3xl font-black text-gray-800">
                                    KES {(openingBalance + systemTotals.total_cash_in).toLocaleString()}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Opening ({openingBalance.toLocaleString()}) + Collected ({systemTotals.total_cash_in.toLocaleString()})</p>
                            </div>
                            <div className="p-4 bg-white border-2 border-green-100 rounded-lg">
                                <label className="block text-sm font-bold text-gray-600 mb-2">Actual Cash Counted *</label>
                                <input
                                    type="number"
                                    value={actualCashEnd}
                                    onChange={(e) => setActualCashEnd(e.target.value)}
                                    className={`w-full px-4 py-3 text-2xl font-bold border-2 rounded-xl outline-none transition-colors ${actualCashEnd && (parseFloat(actualCashEnd) !== (openingBalance + systemTotals.total_cash_in))
                                        ? 'border-red-300 bg-red-50 text-red-700'
                                        : 'border-green-200 focus:border-green-500 text-green-800'
                                        }`}
                                    placeholder="0.00"
                                />
                                {actualCashEnd && (parseFloat(actualCashEnd) !== (openingBalance + systemTotals.total_cash_in)) && (
                                    <p className="text-red-600 font-bold text-sm mt-2 flex items-center gap-2">
                                        <FaExclamationTriangle /> Variance: KES {(parseFloat(actualCashEnd) - (openingBalance + systemTotals.total_cash_in)).toLocaleString()}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-50 flex flex-col md:flex-row justify-between items-center md:px-10 gap-4">
                        <div className="text-sm">
                            <span className="font-bold text-gray-500 uppercase mr-2">Session Status:</span>
                            <span className="font-bold text-blue-600">IN PROGRESS</span>
                        </div>

                        <div className="flex gap-4 w-full md:w-auto">
                            <button
                                onClick={handleSaveDraft}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                <FaSave /> Save Draft
                            </button>

                            <button
                                onClick={handleCloseMeeting}
                                disabled={
                                    !actualCashEnd ||
                                    (parseFloat(actualCashEnd) !== (openingBalance + systemTotals.total_cash_in) && !approvalReason) ||
                                    closingBalance < 0
                                }
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-safaricom-green text-white font-bold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-900/20"
                            >
                                <FaPaperPlane /> Submit & Close Session
                            </button>
                        </div>
                    </div>
                    {/* Padding for fixed footer */}
                    <div className="h-24"></div>
                </>
            )}

            {/* SUPERVISOR VIEW (PENDING APPROVAL) */}
            {sessionStatus === 'PENDING_APPROVAL' && (
                <div className="bg-yellow-50 border-2 border-yellow-200 p-6 rounded-xl">
                    <div className="flex items-center gap-3 mb-2">
                        <FaExclamationTriangle className="text-yellow-600 text-xl" />
                        <h3 className="font-bold text-yellow-900">Meeting Pending Approval</h3>
                    </div>
                    <p className="text-sm text-yellow-700 mb-4">
                        This meeting has been closed by the Field Officer. Waiting for Supervisor approval to post to General Ledger.
                    </p>
                    <div className="flex gap-4">
                        <button
                            className="bg-red-100 text-red-700 px-4 py-2 rounded font-bold"
                            onClick={() => toast.info("Reject Logic Placeholder")}
                        >
                            Reject & Unlock
                        </button>
                        <button
                            className="bg-green-600 text-white px-4 py-2 rounded font-bold shadow"
                            onClick={handleSupervisorApprove}
                        >
                            APPROVE OB & POST
                        </button>
                    </div>
                </div>
            )}

            {/* Status Messages */}
            {sessionStatus === 'POSTED' && (
                <div className="bg-blue-50 border-2 border-blue-200 p-6 rounded-xl">
                    <div className="flex items-center gap-3 mb-2">
                        <FaCheckCircle className="text-blue-600 text-xl" />
                        <h3 className="font-bold text-blue-900">Meeting POSTED</h3>
                    </div>
                    <p className="text-sm text-blue-700">
                        This session has been POSTED to the General Ledger. Balances have been updated.
                    </p>
                </div>
            )}

            {sessionStatus === 'approved' && (
                <div className="bg-green-50 border-2 border-green-200 p-6 rounded-xl">
                    <div className="flex items-center gap-3 mb-2">
                        <FaLock className="text-green-600 text-xl" />
                        <h3 className="font-bold text-green-900">Session Approved & Locked</h3>
                    </div>
                    <p className="text-sm text-green-700">
                        This session has been approved and is now a permanent record. No further edits are allowed.
                    </p>
                </div>
            )}
        </div>
    );
};

export default DailyMeetingReport;

