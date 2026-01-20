/**
 * Smart Validation Module
 * Business Rules Engine for TBMS
 * Prevents errors and fraud
 */

export const VALIDATION_RULES = {
    maxLoanToSavingsRatio: 3, // Max loan = 3x total savings
    minOpeningBalance: 5000, // Minimum cash to start meeting
    maxCashHandling: 100000, // Require supervisor for >100K
    lowBalanceThreshold: 0.2, // Alert if balance < 20% of opening
    criticalBalanceThreshold: 0, // Critical if balance < 0
};

/**
 * Validate transaction against business rules
 * @param {Object} transaction - Transaction object
 * @param {Object} member - Member object
 * @param {Object} session - Session object
 * @returns {Object} { valid: boolean, errors: Array<string>, warnings: Array<string> }
 */
export const validateTransaction = (transaction, member, session) => {
    const errors = [];
    const warnings = [];

    // Rule 1: No negative balances (CRITICAL)
    if (session.closingBalance < 0) {
        errors.push({
            type: 'NEGATIVE_BALANCE',
            message: `Negative closing balance detected: KES ${Math.abs(session.closingBalance).toLocaleString()}. Requires supervisor approval.`,
            severity: 'critical',
        });
    }

    // Rule 2: Loan cannot exceed 3x savings
    if (transaction.type === 'loan_issue' || transaction.loan_principal > 0) {
        const maxAllowed = (member.totalContributions || 0) * VALIDATION_RULES.maxLoanToSavingsRatio;
        if (transaction.loan_principal > maxAllowed) {
            errors.push({
                type: 'LOAN_EXCEEDS_LIMIT',
                message: `Loan exceeds maximum allowed (${VALIDATION_RULES.maxLoanToSavingsRatio}x savings). Max: KES ${maxAllowed.toLocaleString()}`,
                severity: 'error',
            });
        }
    }

    // Rule 3: Large cash handling requires supervisor
    const totalAmount = transaction.savings_amount + transaction.stl_repayment + 
                       transaction.ltl_repayment + transaction.loan_principal + 
                       transaction.welfare + transaction.project + transaction.fines;
    
    if (totalAmount > VALIDATION_RULES.maxCashHandling) {
        warnings.push({
            type: 'LARGE_TRANSACTION',
            message: `Transaction amount (KES ${totalAmount.toLocaleString()}) exceeds ${VALIDATION_RULES.maxCashHandling.toLocaleString()}. Supervisor approval recommended.`,
            severity: 'warning',
        });
    }

    // Rule 4: Low balance warning
    if (session.closingBalance > 0 && session.closingBalance < (session.openingBalance * VALIDATION_RULES.lowBalanceThreshold)) {
        warnings.push({
            type: 'LOW_BALANCE',
            message: `Balance is below 20% of opening balance. Current: KES ${session.closingBalance.toLocaleString()}`,
            severity: 'warning',
        });
    }

    // Rule 5: Negative values not allowed
    if (transaction.savings_amount < 0 || transaction.stl_repayment < 0 || 
        transaction.ltl_repayment < 0 || transaction.loan_interest < 0 || 
        transaction.loan_principal < 0 || transaction.welfare < 0 || 
        transaction.project < 0 || transaction.fines < 0) {
        errors.push({
            type: 'NEGATIVE_VALUE',
            message: 'Negative values are not allowed in any field',
            severity: 'error',
        });
    }

    // Rule 6: Disbursement cannot exceed available cash
    const cashOut = transaction.loan_principal || 0;
    const availableCash = session.openingBalance + session.cashIn;
    if (cashOut > availableCash) {
        errors.push({
            type: 'EXCEEDS_AVAILABLE',
            message: `Disbursement (KES ${cashOut.toLocaleString()}) exceeds available cash (KES ${availableCash.toLocaleString()})`,
            severity: 'critical',
        });
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
};

/**
 * Check if supervisor approval is required
 * @param {Object} session - Session object
 * @param {Array} errors - Validation errors
 * @returns {boolean}
 */
export const requiresSupervisorApproval = (session, errors) => {
    // Negative balance always requires approval
    if (session.closingBalance < 0) {
        return true;
    }

    // Critical errors require approval
    const hasCriticalError = errors.some(e => e.severity === 'critical');
    if (hasCriticalError) {
        return true;
    }

    // Large transactions require approval
    const totalCashHandled = session.cashIn + Math.abs(session.cashOut || 0);
    if (totalCashHandled > VALIDATION_RULES.maxCashHandling) {
        return true;
    }

    return false;
};

/**
 * Get balance alert level
 * @param {number} closingBalance - Closing balance
 * @param {number} openingBalance - Opening balance
 * @returns {Object} { level: string, color: string, message: string }
 */
export const getBalanceAlert = (closingBalance, openingBalance) => {
    if (closingBalance < 0) {
        return {
            level: 'critical',
            color: 'red',
            bgColor: 'bg-red-50',
            borderColor: 'border-red-500',
            textColor: 'text-red-800',
            icon: '⚠️',
            message: `CRITICAL: Negative closing balance (KES ${Math.abs(closingBalance).toLocaleString()}). Requires immediate supervisor approval.`,
        };
    }

    if (closingBalance < (openingBalance * VALIDATION_RULES.lowBalanceThreshold)) {
        return {
            level: 'warning',
            color: 'yellow',
            bgColor: 'bg-yellow-50',
            borderColor: 'border-yellow-500',
            textColor: 'text-yellow-800',
            icon: '⚠️',
            message: `Warning: Balance is below 20% of opening balance. Current: KES ${closingBalance.toLocaleString()}`,
        };
    }

    return {
        level: 'healthy',
        color: 'green',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-500',
        textColor: 'text-green-800',
        icon: '✅',
        message: `Healthy balance: KES ${closingBalance.toLocaleString()}`,
    };
};

/**
 * Validate disbursement amount
 * @param {number} requestedAmount - Amount to disburse
 * @param {number} availableCash - Available cash
 * @returns {Object} { allowed: boolean, reason: string|null }
 */
export const validateDisbursement = (requestedAmount, availableCash) => {
    if (requestedAmount < 0) {
        return {
            allowed: false,
            reason: 'Disbursement amount cannot be negative',
        };
    }

    if (requestedAmount > availableCash) {
        return {
            allowed: false,
            reason: `Disbursement (KES ${requestedAmount.toLocaleString()}) exceeds available cash (KES ${availableCash.toLocaleString()})`,
        };
    }

    return {
        allowed: true,
        reason: null,
    };
};

