/**
 * Daily Cash Report Enforcement
 * Phase 3: Daily Cash Report Enforcement Logic
 * 
 * This is the MOST IMPORTANT module - prevents money loss
 */

import { checkPermission } from './permissions';
import { PERMISSIONS } from './permissions';

/**
 * Calculate expected closing balance
 * @param {number} openingBalance - Opening balance
 * @param {number} cashCollected - Total cash collected
 * @param {number} cashIssued - Total cash issued
 * @returns {number}
 */
export const calculateExpectedClosing = (openingBalance, cashCollected, cashIssued) => {
    return openingBalance + cashCollected - cashIssued;
};

/**
 * Calculate variance
 * @param {number} expectedClosing - Expected closing balance
 * @param {number} actualClosing - Actual closing balance
 * @returns {number}
 */
export const calculateVariance = (expectedClosing, actualClosing) => {
    return actualClosing - expectedClosing;
};

/**
 * Check if report is balanced
 * @param {number} variance - Variance amount
 * @param {number} tolerance - Tolerance threshold (default: 0)
 * @returns {boolean}
 */
export const isReportBalanced = (variance, tolerance = 0) => {
    return Math.abs(variance) <= tolerance;
};

/**
 * Validate cash report before submission
 * @param {Object} reportData - Report data object
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
export const validateCashReport = (reportData) => {
    const errors = [];
    const {
        openingBalance,
        cashCollected,
        cashIssued,
        expectedClosing,
        actualClosing,
        variance,
        varianceExplanation,
        requireVarianceExplanation = true,
    } = reportData;

    // Check if report has any transactions
    if (cashCollected === 0 && cashIssued === 0) {
        errors.push('Cannot submit empty report. No transactions entered.');
    }

    // Check if cash out exceeds available balance
    const calculatedExpected = calculateExpectedClosing(openingBalance, cashCollected, cashIssued);
    if (calculatedExpected < 0) {
        errors.push('Cash Out exceeds available balance! Please check your entries.');
    }

    // Check variance
    const calculatedVariance = calculateVariance(expectedClosing, actualClosing);
    if (!isReportBalanced(calculatedVariance) && requireVarianceExplanation) {
        if (!varianceExplanation || varianceExplanation.trim() === '') {
            errors.push('Variance explanation is required when closing balance does not match expected balance.');
        }
    }

    // Validate expected closing matches calculation
    if (Math.abs(calculatedExpected - expectedClosing) > 0.01) {
        errors.push('Expected closing balance does not match calculation. Please recalculate.');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
};

/**
 * Check if previous day's report exists and is locked
 * @param {string} date - Date to check (YYYY-MM-DD)
 * @param {Array} reports - Array of report objects
 * @returns {Object} { exists: boolean, isLocked: boolean, report: Object|null }
 */
export const checkPreviousDayReport = (date, reports) => {
    const reportDate = new Date(date);
    reportDate.setDate(reportDate.getDate() - 1);
    const previousDate = reportDate.toISOString().split('T')[0];

    const previousReport = reports.find(r => r.date === previousDate);

    if (!previousReport) {
        return {
            exists: false,
            isLocked: false,
            report: null,
        };
    }

    return {
        exists: true,
        isLocked: previousReport.status === 'locked' || previousReport.status === 'approved',
        report: previousReport,
    };
};

/**
 * Check if system access should be blocked due to missing report
 * @param {Object} settings - System settings object
 * @param {Array} reports - Array of report objects
 * @param {string} currentDate - Current date (YYYY-MM-DD)
 * @returns {Object} { blocked: boolean, reason: string|null }
 */
export const checkSystemAccessBlock = (settings, reports, currentDate) => {
    const blockNextDayAccess = settings?.report_block_next_day_access ?? true;

    if (!blockNextDayAccess) {
        return { blocked: false, reason: null };
    }

    const previousDayCheck = checkPreviousDayReport(currentDate, reports);

    if (!previousDayCheck.exists) {
        return {
            blocked: true,
            reason: `Previous day's cash report is missing. System access is blocked until report is submitted.`,
        };
    }

    if (!previousDayCheck.isLocked) {
        return {
            blocked: true,
            reason: `Previous day's cash report is not locked. Please ensure report is submitted and approved.`,
        };
    }

    return { blocked: false, reason: null };
};

/**
 * Check if loan approval should be blocked due to unbalanced report
 * @param {Object} settings - System settings object
 * @param {Object} currentReport - Current day's cash report
 * @returns {Object} { blocked: boolean, reason: string|null }
 */
export const checkLoanApprovalBlock = (settings, currentReport) => {
    const blockLoanIfUnbalanced = settings?.report_block_loan_if_unbalanced ?? true;

    if (!blockLoanIfUnbalanced) {
        return { blocked: false, reason: null };
    }

    if (!currentReport) {
        return {
            blocked: true,
            reason: 'Daily cash report must be submitted and balanced before approving loans.',
        };
    }

    if (currentReport.status === 'draft' || currentReport.status === 'submitted') {
        return {
            blocked: true,
            reason: 'Daily cash report must be approved and balanced before approving loans.',
        };
    }

    if (!isReportBalanced(currentReport.variance)) {
        return {
            blocked: true,
            reason: `Cannot approve loans when cash report has variance (KES ${Math.abs(currentReport.variance).toLocaleString()}). Report must be balanced first.`,
        };
    }

    return { blocked: false, reason: null };
};

/**
 * Auto-lock report after submission
 * @param {Object} settings - System settings object
 * @param {string} currentStatus - Current report status
 * @returns {boolean}
 */
export const shouldAutoLock = (settings, currentStatus) => {
    const autoLock = settings?.report_auto_lock_after_submission ?? true;
    return autoLock && currentStatus === 'submitted';
};

/**
 * Check if user can unlock report
 * @param {Object} user - User object
 * @param {Object} settings - System settings object
 * @param {Object} report - Report object
 * @returns {Object} { allowed: boolean, reason: string|null }
 */
export const canUnlockReport = (user, settings, report) => {
    const adminOnlyUnlock = settings?.report_admin_only_unlock ?? true;

    if (!adminOnlyUnlock) {
        return { allowed: true, reason: null };
    }

    const permissionCheck = checkPermission(user, PERMISSIONS.UNLOCK_CASH_REPORT, 'unlock cash report');

    if (!permissionCheck.allowed) {
        return {
            allowed: false,
            reason: permissionCheck.reason || 'Only Directors and Admins can unlock reports.',
        };
    }

    return { allowed: true, reason: null };
};

/**
 * Get report status workflow
 * @returns {Object} Status workflow definition
 */
export const getReportStatusWorkflow = () => {
    return {
        draft: {
            canSubmit: true,
            canEdit: true,
            canApprove: false,
            canLock: false,
            canUnlock: false,
        },
        submitted: {
            canSubmit: false,
            canEdit: false,
            canApprove: true,
            canLock: true, // Auto-lock if enabled
            canUnlock: false,
        },
        approved: {
            canSubmit: false,
            canEdit: false,
            canApprove: false,
            canLock: true,
            canUnlock: true, // Admin/Director only
        },
        locked: {
            canSubmit: false,
            canEdit: false,
            canApprove: false,
            canLock: false,
            canUnlock: true, // Admin/Director only
        },
    };
};

