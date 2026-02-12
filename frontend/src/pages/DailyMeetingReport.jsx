import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTransactions } from '../context/TransactionContext';
import { api } from '../services/api'; // Import API
import { validateCashReport, checkSystemAccessBlock } from '../utils/cashReportEnforcement'; // Keep utils
import { validateTransaction, requiresSupervisorApproval, getBalanceAlert, validateDisbursement } from '../utils/validationRules';
import { toast } from 'react-toastify';
import {
    FaSave, FaPaperPlane, FaLock, FaCheckCircle, FaTimesCircle,
    FaExclamationTriangle, FaCalculator, FaUsers, FaCalendarAlt, FaBan, FaUserShield, FaSearch,
    FaFileInvoice
} from 'react-icons/fa';
import SearchableGroupSelector from '../components/SearchableGroupSelector';
import offlineManager from '../services/OfflineManager';
import OfflineIndicator from '../components/OfflineIndicator';

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
            onFocus={(e) => e.target.select()}
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
    const [memberSearchTerm, setMemberSearchTerm] = useState('');
    const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
    const [sessionStatus, setSessionStatus] = useState('draft'); // draft, POSTED, approved, rejected, locked
    const [openingBalance, setOpeningBalance] = useState(0);
    const [closingBalance, setClosingBalance] = useState(0);
    const [sessionId, setSessionId] = useState(null);
    const [supervisorApprovalRequested, setSupervisorApprovalRequested] = useState(false);
    const [approvalReason, setApprovalReason] = useState('');

    // SMART MEETING STATE
    const [meetingType, setMeetingType] = useState('Regular'); // Regular, AGM, Special
    const [meetingNotes, setMeetingNotes] = useState('');
    const [showNotes, setShowNotes] = useState(false);

    // Cash Verification State
    const [actualCashStart, setActualCashStart] = useState('');
    const [actualCashEnd, setActualCashEnd] = useState('');

    // Receipting State
    const [sessionTransactions, setSessionTransactions] = useState([]);

    // Partnership State
    const [partnershipExposure, setPartnershipExposure] = useState(null);
    const [ukomboziniRepayment, setUkomboziniRepayment] = useState(0);

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
    const [memberDues, setMemberDues] = useState({}); // { memberId: { principal: 0, interest: 0 } }
    const [hasRecoverableDraft, setHasRecoverableDraft] = useState(false);
    const [draftData, setDraftData] = useState(null);

    // Cash out tracking (for loans disbursed)
    const [cashOut, setCashOut] = useState(0);

    // Load members when group is selected
    useEffect(() => {
        const fetchMembers = async () => {
            if (selectedGroup) {
                try {
                    // Check for local draft first
                    const existingDraft = await offlineManager.getDraftSession(selectedGroup.id);
                    if (existingDraft && !sessionId) {
                        setDraftData(existingDraft.data);
                        setHasRecoverableDraft(true);
                    }

                    const groupMembers = await api.getMembersByGroup(selectedGroup.id);
                    const groupOpeningBalance = selectedGroup.openingBalance || 0;

                    // Initialize member transactions (one row per member)
                    const initialTransactions = groupMembers.map(member => ({
                        id: `temp-${member.id}`,
                        memberId: member.id,
                        memberName: member.name,
                        attended: true, // Default to present
                        // MOCK BF VALUES (Read-Only) - In future, fetch from api.getMemberBalances
                        ltl_bf: member.ltl_bf || 0,
                        stl_bf: member.stl_bf || 0,
                        savings_bf: member.savings_bf || 0,
                        savings_amount: 0,
                        welfare: 0,
                        stl_repayment: 0,
                        ltl_repayment: 0,
                        loan_interest: 0,
                        loan_principal: 0,
                        project: 0,
                        fines: 0,
                    }));

                    setMemberTransactions(initialTransactions);
                    setOpeningBalance(groupOpeningBalance);
                    setClosingBalance(groupOpeningBalance);

                    // Fetch Loan Dues Summary
                    try {
                        const duesSummary = await api.getLoansDueSummary(selectedGroup.id);
                        const duesMap = {};
                        duesSummary.forEach(d => {
                            duesMap[d.member_id] = {
                                principal: d.principal_due,
                                interest: d.interest_due
                            };
                        });
                        setMemberDues(duesMap);
                    } catch (dueDateErr) {
                        console.error("Error fetching dues:", dueDateErr);
                    }

                    // Fetch Partnership Exposure
                    const exposure = await api.getPartnershipExposure(selectedGroup.id);
                    setPartnershipExposure(exposure);
                } catch (error) {
                    console.error("Error fetching members/exposure:", error);
                    toast.error("Failed to load group data");
                }
            }
        };

        fetchMembers();

        // If session is already posted, fetch its transactions for receipting
        if (sessionId && sessionStatus === 'POSTED') {
            api.getSessionTransactions(sessionId).then(data => {
                setSessionTransactions(data || []);
            });
        }
    }, [selectedGroup, sessionId, sessionStatus]);

    // Calculate totals in real-time (SYSTEM-ONLY, prevents tampering)
    const systemTotals = useMemo(() => {
        return memberTransactions.reduce((totals, transaction) => {
            if (transaction.attended) totals.total_present += 1;
            totals.total_savings += parseFloat(transaction.savings_amount || 0);
            totals.total_stl += parseFloat(transaction.stl_repayment || 0) +
                parseFloat(transaction.loan_interest || 0);
            totals.total_ltl += parseFloat(transaction.ltl_repayment || 0);
            totals.total_welfare += parseFloat(transaction.welfare || 0);
            totals.total_fines += parseFloat(transaction.fines || 0);

            // Cash In only includes collections, NOT disbursements
            totals.total_cash_in += parseFloat(transaction.savings_amount || 0) +
                parseFloat(transaction.stl_repayment || 0) +
                parseFloat(transaction.ltl_repayment || 0) +
                parseFloat(transaction.loan_interest || 0) +
                parseFloat(transaction.welfare || 0) +
                parseFloat(transaction.project || 0) +
                parseFloat(transaction.fines || 0);
            return totals;
        }, {
            total_present: 0,
            total_savings: 0,
            total_stl: 0,
            total_ltl: 0,
            total_welfare: 0,
            total_fines: 0,
            total_cash_in: 0,
        });
    }, [memberTransactions]);

    // Real-time Table Balance (Liquid Cash in the room)
    const tableBalance = useMemo(() => {
        return openingBalance + systemTotals.total_cash_in - cashOut - ukomboziniRepayment;
    }, [openingBalance, systemTotals.total_cash_in, cashOut, ukomboziniRepayment]);

    // Auto-save logic (every 60 seconds if in draft)
    useEffect(() => {
        if (sessionStatus !== 'draft' || !selectedGroup || memberTransactions.length === 0) return;

        const timer = setInterval(() => {
            const dataToSave = {
                memberTransactions,
                openingBalance,
                cashOut,
                meetingType,
                meetingNotes,
                ukomboziniRepayment
            };
            offlineManager.saveDraftSession(selectedGroup.id, dataToSave);
            console.log("💾 Auto-saved meeting draft for", selectedGroup.name);
        }, 60000);

        return () => clearInterval(timer);
    }, [sessionStatus, selectedGroup, memberTransactions, openingBalance, cashOut, meetingType, meetingNotes, ukomboziniRepayment]);

    // Calculate closing balance (same as table balance)
    useEffect(() => {
        setClosingBalance(tableBalance);
    }, [tableBalance]);

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

        if (field === 'attended') {
            setMemberTransactions(prev => prev.map(t => {
                if (t.memberId === memberId) {
                    return { ...t, attended: value };
                }
                return t;
            }));
            return;
        }

        const numValue = parseFloat(value) || 0;
        if (numValue < 0) {
            toast.error('Negative values not allowed');
            return;
        }

        // If updating loan principal, validate vs available liquid cash
        if (field === 'loan_principal') {
            const member = memberTransactions.find(t => t.memberId === memberId);
            const oldLoanPrincipal = member?.loan_principal || 0;
            const diff = numValue - oldLoanPrincipal;

            // Available cash (BEFORE this specific change)
            const availableCash = tableBalance;

            if (diff > availableCash) {
                toast.error(`Insufficient Table Balance! Available: KES ${availableCash.toLocaleString()}`);
                return;
            }

            // Update cash out
            setCashOut(prev => prev + diff);
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

    // Print Receipt logic
    const handlePrintReceipt = (memberId) => {
        // Find transaction for this member in the session
        const memberTx = sessionTransactions.find(t => t.memberId === memberId);
        if (memberTx) {
            api.downloadReceiptPDF(memberTx.id);
        } else {
            toast.warn("No transaction record found for receipt.");
        }
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
        // It's okay if not all have transactions if they are absent, but warn if attended and 0
        const attendedWithNoTx = memberTransactions.filter(t => t.attended && calculateMemberTotal(t) === 0);
        if (attendedWithNoTx.length > 0) {
            warnings.push(`${attendedWithNoTx.length} present members have 0 transactions.`);
        }

        // Validate each transaction
        memberTransactions.forEach(t => {
            // Construct member object from transaction data (BF has the savings info needed for validation)
            const member = { totalContributions: t.savings_bf };
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
    const handleSaveDraft = async () => {
        if (!selectedGroup) return;

        const dataToSave = {
            memberTransactions,
            openingBalance,
            cashOut,
            meetingType,
            meetingNotes,
            ukomboziniRepayment
        };

        try {
            await offlineManager.saveDraftSession(selectedGroup.id, dataToSave);
            toast.success('Draft saved securely to local storage');
        } catch (err) {
            console.error("Draft save failed:", err);
            toast.error('Failed to save draft locally');
        }
    };

    const handleRecoverDraft = () => {
        if (draftData) {
            setMemberTransactions(draftData.memberTransactions);
            setOpeningBalance(draftData.openingBalance);
            setCashOut(draftData.cashOut);
            setMeetingType(draftData.meetingType);
            setMeetingNotes(draftData.meetingNotes);
            setUkomboziniRepayment(draftData.ukomboziniRepayment);
            setHasRecoverableDraft(false);
            setDraftData(null);
            toast.success('Meeting data recovered from local storage');
        }
    };

    const handleDiscardDraft = () => {
        if (selectedGroup) {
            offlineManager.clearDraftSession(selectedGroup.id);
            setHasRecoverableDraft(false);
            setDraftData(null);
            toast.info('Local draft discarded');
        }
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

        // If offline, queue for sync
        if (!navigator.onLine) {
            const offlinePayload = {
                type: 'post_meeting',
                meetingId: sessionId || `offline-${Date.now()}`,
                data: {
                    groupId: selectedGroup.id,
                    groupName: selectedGroup.name,
                    date: meetingDate,
                    officerId: user?.id,
                    totals: systemTotals,
                    transactions: memberTransactions,
                    balances,
                    ukomboziniRepayment,
                    meetingNotes,
                    meetingType
                }
            };

            offlineManager.saveOfflineTransaction(offlinePayload);
            setSessionStatus('POSTED'); // Optimistic update
            offlineManager.clearDraftSession(selectedGroup.id);
            return;
        }

        const success = closeSession(systemTotals, memberTransactions, balances);
        if (success) {
            offlineManager.clearDraftSession(selectedGroup.id);
        }
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

        const calculatedExpectedClosing = openingBalance + systemTotals.total_cash_in - cashOut - ukomboziniRepayment;
        const calculatedVariance = closingBalance - calculatedExpectedClosing;

        // Validate using cash report enforcement
        const reportData = {
            openingBalance,
            cashCollected: systemTotals.total_cash_in,
            cashIssued: cashOut,
            expectedClosing: calculatedExpectedClosing,
            actualClosing: closingBalance,
            variance: calculatedVariance,
            varianceExplanation: approvalReason,
            requireVarianceExplanation: closingBalance < 0,
        };

        const cashValidation = validateCashReport(reportData);
        if (!cashValidation.valid) {
            cashValidation.errors.forEach(error => toast.error(error));
            return;
        }

        const expectedClosing = openingBalance + systemTotals.total_cash_in - cashOut - ukomboziniRepayment;
        const currentVariance = closingBalance - expectedClosing;

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
            closingBalance,
            variance: currentVariance,
            meetingType,
            meetingNotes, // Add notes
            ukomboziniRepayment // Add Partnership Repayment
        };

        const success = postSession(sessionMetadata, memberTransactions);

        if (success) {
            setSessionStatus('POSTED');
            // Fetch the newly created transactions for receipting
            api.getSessionTransactions(sessionId).then(data => {
                setSessionTransactions(data || []);
            });
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
            closingBalance,
            ukomboziniRepayment
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
                            Smart Meeting Template
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Daily Meeting Report & Minutes</p>
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-1 relative z-20">
                        <SearchableGroupSelector
                            label="Select Group"
                            groups={groups}
                            selectedGroupId={selectedGroup?.id}
                            onSelect={(id) => {
                                const group = groups.find(g => g.id === id);
                                setSelectedGroup(group);
                            }}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                            Meeting Type
                        </label>
                        <select
                            value={meetingType}
                            onChange={(e) => setMeetingType(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none"
                        >
                            <option value="Regular">Regular Meeting</option>
                            <option value="AGM">Annual General Meeting (AGM)</option>
                            <option value="Special">Special / Emergency</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                            <FaCalendarAlt className="inline mr-1" /> Date
                        </label>
                        <input
                            type="date"
                            value={meetingDate}
                            onChange={(e) => setMeetingDate(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none bg-white"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                            Attendance
                        </label>
                        <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg font-bold text-blue-800 flex justify-between items-center">
                            <span>{systemTotals.total_present} / {memberTransactions.length} Present</span>
                            <FaUsers />
                        </div>
                    </div>
                </div>

                {/* Opening Balance Widget */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex justify-between items-center">
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-bold">Opening Balance</p>
                            <p className="text-xl font-bold text-gray-800">KES {openingBalance.toLocaleString()}</p>
                        </div>
                        <div className="h-10 w-1 bg-gray-300 rounded-full"></div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-bold">Total Disbursed</p>
                            <p className="text-xl font-bold text-red-600">KES {cashOut.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                {/* Action Buttons: Start or Timer */}
                {!activeSession && !sessionId ? (
                    <button
                        onClick={handleStartMeeting}
                        disabled={!selectedGroup}
                        className="mt-4 w-full bg-safaricom-green hover:bg-safaricom-dark text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
                    >
                        <FaCalculator /> Start Smart Session (2 Hours)
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

                        {/* Meeting Minutes Toggle */}
                        <div className="mt-3 pt-3 border-t border-gray-200">
                            <button
                                onClick={() => setShowNotes(!showNotes)}
                                className="flex items-center gap-2 text-sm font-bold text-safaricom-green hover:underline"
                            >
                                <FaPaperPlane /> {showNotes ? 'Hide Minutes' : 'Show Meeting Minutes / Notes'}
                            </button>
                            {showNotes && (
                                <div className="mt-2 animate-in fade-in slide-in-from-top-2">
                                    <textarea
                                        value={meetingNotes}
                                        onChange={(e) => setMeetingNotes(e.target.value)}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 outline-none"
                                        rows="4"
                                        placeholder="Enter meeting agenda, resolutions, and any special notes here..."
                                    />
                                </div>
                            )}
                        </div>
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
                    <div className="bg-safaricom-green/95 text-white p-5 sticky top-0 z-10 flex flex-col md:flex-row justify-between items-center gap-6 shadow-lg backdrop-blur-sm">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-3 rounded-2xl">
                                <FaUsers className="text-2xl" />
                            </div>
                            <div>
                                <h3 className="font-black text-xl tracking-tight">Member Transactions</h3>
                                <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">
                                    {memberSearchTerm ? `Filtering: "${memberSearchTerm}"` : "Real-time automated ledger updates"}
                                </p>
                            </div>
                        </div>
                        <div className="relative w-full md:w-80 group">
                            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 transition-transform group-focus-within:scale-110">
                                <FaSearch className="text-white/70 text-sm" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by member name or phone..."
                                value={memberSearchTerm}
                                onChange={(e) => setMemberSearchTerm(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-white/10 border-2 border-white/20 rounded-2xl text-sm font-bold text-white placeholder-white/50 focus:bg-white/20 focus:border-white/40 focus:outline-none transition-all shadow-inner"
                            />
                            {memberSearchTerm && (
                                <button
                                    onClick={() => setMemberSearchTerm('')}
                                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                                >
                                    <FaTimesCircle />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Scrollable Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b-2 border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase sticky left-0 bg-gray-50 z-10 border-r border-gray-200 w-12">
                                        <FaCheckCircle className="text-gray-400" title="Mark Present" />
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase sticky left-12 bg-gray-50 z-10 border-r border-gray-200">
                                        Member
                                    </th>
                                    {/* BF COLUMNS (READ-ONLY) */}
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase bg-gray-100 border-r border-gray-200">LTL BF</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase bg-gray-100 border-r border-gray-200">STL BF</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase bg-gray-100 border-r border-gray-200">Savings BF</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Savings</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Welfare</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">STL Repay</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">LTL Repay</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Interest</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Principal</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Project</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Fines</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase bg-green-50">Total Paid</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    const filtered = memberTransactions.filter(t => (t.memberName || '').toLowerCase().includes(memberSearchTerm.toLowerCase()));

                                    if (filtered.length === 0) {
                                        return (
                                            <tr>
                                                <td colSpan="13" className="px-6 py-12 text-center text-gray-400">
                                                    <div className="flex flex-col items-center justify-center">
                                                        <FaSearch className="text-3xl mb-3 opacity-20" />
                                                        <p className="font-bold text-sm uppercase tracking-widest">No members found matching "{memberSearchTerm}"</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }

                                    return filtered.map((transaction, index) => {
                                        const memberTotal = calculateMemberTotal(transaction);
                                        const cols = ['savings_amount', 'welfare', 'stl_repayment', 'ltl_repayment', 'loan_interest', 'loan_principal', 'project', 'fines'];
                                        const isPresent = transaction.attended;

                                        return (
                                            <tr
                                                key={transaction.id}
                                                className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${!isPresent ? 'bg-gray-100 opacity-60' : memberTotal > 0 ? 'bg-green-50/30' : ''
                                                    }`}
                                            >
                                                <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r border-gray-100 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isPresent}
                                                        onChange={(e) => updateMemberTransaction(transaction.memberId, 'attended', e.target.checked)}
                                                        disabled={sessionStatus !== 'draft'}
                                                        className="w-4 h-4 text-safaricom-green rounded border-gray-300 focus:ring-safaricom-green cursor-pointer"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 font-bold text-gray-800 sticky left-12 bg-white z-10 border-r border-gray-100">
                                                    {transaction.memberName}
                                                    {!isPresent && <span className="ml-2 text-xs text-red-500 font-normal uppercase">(Absent)</span>}
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

                                                {cols.map((col, colIndex) => {
                                                    const dueInfo = memberDues[transaction.memberId];
                                                    const hasDue = (col === 'loan_interest' && dueInfo?.interest > 0) ||
                                                        (col === 'stl_repayment' && dueInfo?.principal > 0);

                                                    // Real-time limit for disbursements
                                                    const maxAllowed = col === 'loan_principal'
                                                        ? (tableBalance + transaction.loan_principal)
                                                        : null;

                                                    return (
                                                        <td key={col} className="px-2 py-2 relative group">
                                                            <TransactionInput
                                                                value={transaction[col]}
                                                                onChange={(v) => updateMemberTransaction(transaction.memberId, col, v)}
                                                                disabled={sessionStatus !== 'draft'}
                                                                memberId={transaction.memberId}
                                                                field={col}
                                                                rowIndex={index}
                                                                colIndex={colIndex}
                                                                totalRows={filtered.length}
                                                                totalCols={cols.length}
                                                            />
                                                            {hasDue && (
                                                                <div
                                                                    className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full border border-white"
                                                                    title={`Expected: KES ${col === 'loan_interest' ? dueInfo.interest : dueInfo.principal}`}
                                                                ></div>
                                                            )}
                                                            {maxAllowed !== null && sessionStatus === 'draft' && (
                                                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                                                                    Max: KES {maxAllowed.toLocaleString()}
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                })}

                                                <td className="px-4 py-3 text-right font-bold text-green-700 bg-green-50">
                                                    KES {memberTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {sessionStatus === 'POSTED' && memberTotal > 0 ? (
                                                        <button
                                                            onClick={() => handlePrintReceipt(transaction.memberId)}
                                                            className="flex items-center gap-1 mx-auto px-2 py-1 bg-safaricom-green/10 text-safaricom-green rounded text-xs hover:bg-safaricom-green hover:text-white transition-all font-bold"
                                                            title="Print Digital Receipt"
                                                        >
                                                            <FaFileInvoice /> Receipt
                                                        </button>
                                                    ) : (
                                                        <span className="text-gray-300 text-xs">N/A</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    });
                                })()}
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
                            <div className="md:col-span-1 border-l border-white/20 pl-4">
                                <div className="text-xs font-black uppercase tracking-widest text-yellow-300">Liquid Table Cash</div>
                                <div className="font-black text-2xl">KES {tableBalance.toLocaleString()}</div>
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
                                {partnershipExposure?.portfolio?.totalTopUp > 0 && (
                                    <div className="mt-4 p-3 bg-white/10 rounded-lg border border-white/20">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold uppercase">UKOMBOZINI Repayment</span>
                                            <span className="text-xs bg-yellow-400 text-blue-900 px-2 py-0.5 rounded font-black">TOP-UP ACTIVE</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold">KES</span>
                                            <input
                                                type="number"
                                                value={ukomboziniRepayment || ''}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    setUkomboziniRepayment(val);
                                                }}
                                                className="bg-white/20 border border-white/30 rounded px-2 py-1 w-full text-xl font-bold outline-none focus:bg-white/30"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <p className="text-[10px] opacity-75 mt-1">Deducted from collections for Company Top-Up clearing.</p>
                                    </div>
                                )}
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
                    {/* Cash Verification (Required) */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="font-bold text-gray-800 flex items-center gap-2 text-lg">
                                <FaUserShield className="text-blue-600" /> Financial Proofing & Verification
                            </h4>
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-black uppercase tracking-widest">Step 2 of 2</span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Breakdown Column */}
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm py-2 border-b border-gray-50">
                                    <span className="text-gray-500 font-bold">Opening Balance</span>
                                    <span className="font-mono font-bold">KES {openingBalance.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm py-2 border-b border-gray-50">
                                    <span className="text-gray-500 font-bold text-safaricom-green">Total Collections (+)</span>
                                    <span className="font-mono font-bold text-safaricom-green">KES {systemTotals.total_cash_in.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm py-2 border-b border-gray-50">
                                    <span className="text-gray-500 font-bold text-red-600">Total Disbursements (-)</span>
                                    <span className="font-mono font-bold text-red-600">KES {cashOut.toLocaleString()}</span>
                                </div>
                                {ukomboziniRepayment > 0 && (
                                    <div className="flex justify-between text-sm py-2 border-b border-gray-50">
                                        <span className="text-gray-500 font-bold text-blue-600">UKOMBOZINI Topup Repay</span>
                                        <span className="font-mono font-bold text-blue-600">KES {ukomboziniRepayment.toLocaleString()}</span>
                                    </div>
                                )}
                            </div>

                            {/* Result Column */}
                            <div className="p-4 bg-gray-50 rounded-2xl flex flex-col justify-center items-center text-center border border-gray-100">
                                <label className="block text-xs font-black text-gray-400 uppercase mb-2 tracking-widest">Expected Cash Bag Weight</label>
                                <div className="text-3xl font-black text-gray-800 font-mono italic">
                                    KES {(openingBalance + systemTotals.total_cash_in - cashOut - ukomboziniRepayment).toLocaleString()}
                                </div>
                                <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">This amount must match the physical cash counted in the group's safe bag.</p>
                            </div>

                            {/* Input Column */}
                            <div className={`p-5 rounded-2xl border-2 transition-all ${actualCashEnd && (parseFloat(actualCashEnd) !== (openingBalance + systemTotals.total_cash_in - cashOut - ukomboziniRepayment))
                                ? 'border-red-500 bg-red-50/50'
                                : 'border-safaricom-green/30 bg-white'
                                }`}>
                                <label className="block text-xs font-black text-gray-600 uppercase mb-3 tracking-widest flex items-center gap-1">
                                    <FaCalculator className="text-[10px]" /> Physical Cash Counted *
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-gray-400">KES</span>
                                    <input
                                        type="number"
                                        value={actualCashEnd}
                                        onChange={(e) => setActualCashEnd(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 text-2xl font-black rounded-xl outline-none bg-transparent"
                                        placeholder="0.00"
                                    />
                                </div>

                                {actualCashEnd && (parseFloat(actualCashEnd) !== (openingBalance + systemTotals.total_cash_in - cashOut - ukomboziniRepayment)) && (
                                    <div className="mt-4 p-3 bg-red-600 rounded-lg text-white animate-pulse">
                                        <div className="flex items-center gap-2 mb-1">
                                            <FaExclamationTriangle className="text-sm" />
                                            <span className="font-black text-xs uppercase tracking-tighter">Variance Detected</span>
                                        </div>
                                        <p className="font-bold text-lg">KES {(parseFloat(actualCashEnd) - (openingBalance + systemTotals.total_cash_in - cashOut - ukomboziniRepayment)).toLocaleString()}</p>
                                    </div>
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
                                    (parseFloat(actualCashEnd) !== (openingBalance + systemTotals.total_cash_in - cashOut - ukomboziniRepayment) && !approvalReason) ||
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

            {/* Recover Draft Dialog */}
            {hasRecoverableDraft && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-6 mx-auto">
                            <FaCalculator className="text-amber-600 text-2xl" />
                        </div>
                        <h3 className="text-xl font-black text-center text-slate-900 mb-2">Recover Local Draft?</h3>
                        <p className="text-sm text-slate-500 text-center mb-8">
                            We found an unsaved meeting draft for <b>{selectedGroup?.name}</b> in your local vault. Would you like to restore it?
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={handleDiscardDraft}
                                className="py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors"
                            >
                                Discard
                            </button>
                            <button
                                onClick={handleRecoverDraft}
                                className="py-4 bg-safaricom-green text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-green-900/20 hover:scale-105 active:scale-95 transition-all"
                            >
                                Recover Data
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <OfflineIndicator />
        </div>
    );
};

export default DailyMeetingReport;

