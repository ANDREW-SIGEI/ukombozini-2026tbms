/**
 * Loan Rules Automation
 * Phase 4: Loan Rules Automation Logic
 * 
 * Makes loans math-based, not emotional - removes human bias
 */

/**
 * Calculate maximum loan amount based on member's total contributions
 * @param {number} totalContributions - Member's total contributions
 * @param {number} multiplier - Loan multiplier (e.g., 3 for 3x)
 * @param {number} guaranteedAmount - Amount member has guaranteed for others
 * @returns {number}
 */
export const calculateMaxLoan = (totalContributions, multiplier, guaranteedAmount = 0) => {
    return (totalContributions * multiplier) - guaranteedAmount;
};

/**
 * Calculate loan interest amount
 * @param {number} principal - Loan principal amount
 * @param {number} interestRate - Interest rate percentage
 * @param {string} method - 'simple' or 'compound'
 * @param {number} periodMonths - Loan period in months (optional, for compound)
 * @returns {number}
 */
export const calculateInterest = (principal, interestRate, method = 'simple', periodMonths = 1) => {
    if (method === 'compound') {
        // Compound interest: A = P(1 + r/n)^(nt)
        // Simplified for monthly compounding
        const rate = interestRate / 100;
        const amount = principal * Math.pow(1 + rate / 12, periodMonths);
        return amount - principal;
    } else {
        // Simple interest: I = P × r × t
        return principal * (interestRate / 100);
    }
};

/**
 * Calculate total loan amount (principal + interest)
 * @param {number} principal - Loan principal
 * @param {number} interestRate - Interest rate percentage
 * @param {string} method - Interest calculation method
 * @param {number} periodMonths - Loan period in months
 * @returns {number}
 */
export const calculateTotalLoanAmount = (principal, interestRate, method = 'simple', periodMonths = 1) => {
    const interest = calculateInterest(principal, interestRate, method, periodMonths);
    return principal + interest;
};

/**
 * Calculate penalty for late payment
 * @param {number} daysLate - Number of days late
 * @param {number} gracePeriodDays - Grace period in days
 * @param {number} penaltyPerDay - Penalty amount per day
 * @returns {number}
 */
export const calculatePenalty = (daysLate, gracePeriodDays, penaltyPerDay) => {
    if (daysLate <= gracePeriodDays) {
        return 0;
    }
    const penaltyDays = daysLate - gracePeriodDays;
    return penaltyDays * penaltyPerDay;
};

/**
 * Check loan eligibility based on member's contributions and system rules
 * @param {Object} member - Member object with totalContributions
 * @param {Object} systemRules - System rules object
 * @param {number} requestedAmount - Requested loan amount
 * @param {Array} activeLoans - Array of member's active loans
 * @returns {Object} { eligible: boolean, maxLoan: number, reason: string|null }
 */
export const checkLoanEligibility = (member, systemRules, requestedAmount, activeLoans = []) => {
    const {
        loan_max_multiplier = 3,
        loan_min_amount = 1000,
        loan_max_amount = 500000,
    } = systemRules;

    // Check minimum loan amount
    if (requestedAmount < loan_min_amount) {
        return {
            eligible: false,
            maxLoan: 0,
            reason: `Minimum loan amount is KES ${loan_min_amount.toLocaleString()}`,
        };
    }

    // Check maximum loan amount
    if (requestedAmount > loan_max_amount) {
        return {
            eligible: false,
            maxLoan: loan_max_amount,
            reason: `Maximum loan amount is KES ${loan_max_amount.toLocaleString()}`,
        };
    }

    // Calculate max loan based on contributions
    const totalContributions = member.totalContributions || 0;
    const guaranteedAmount = member.guaranteedAmount || 0;
    const rawMaxLoan = totalContributions * loan_max_multiplier;
    const maxLoan = rawMaxLoan - guaranteedAmount;

    if (maxLoan < loan_min_amount) {
        let reason = `Insufficient contributions. Member needs at least KES ${Math.ceil(loan_min_amount / loan_max_multiplier).toLocaleString()} in contributions to qualify for a loan.`;
        if (guaranteedAmount > 0) {
            reason = `Insufficient available capacity. Member has raw limit of KES ${rawMaxLoan.toLocaleString()} but has KES ${guaranteedAmount.toLocaleString()} in liens (guarantees for others).`;
        }
        return {
            eligible: false,
            maxLoan: 0,
            reason,
        };
    }

    // Check if requested amount exceeds max
    if (requestedAmount > maxLoan) {
        return {
            eligible: false,
            maxLoan,
            reason: `Requested amount exceeds maximum allowed. Based on contributions of KES ${totalContributions.toLocaleString()} and guarantees of KES ${guaranteedAmount.toLocaleString()}, maximum loan is KES ${maxLoan.toLocaleString()}.`,
        };
    }

    // Check if member has overdue loans
    const overdueLoans = activeLoans.filter(loan => loan.status === 'overdue' || loan.status === 'defaulted');
    if (overdueLoans.length > 0) {
        return {
            eligible: false,
            maxLoan,
            reason: `Member has ${overdueLoans.length} overdue loan(s). All loans must be current before applying for a new loan.`,
        };
    }

    // Check total outstanding loans
    const totalOutstanding = activeLoans
        .filter(loan => ['active', 'overdue'].includes(loan.status))
        .reduce((sum, loan) => sum + (loan.remainingAmount || loan.totalAmount), 0);

    const availableLoan = maxLoan - totalOutstanding;
    if (requestedAmount > availableLoan) {
        return {
            eligible: false,
            maxLoan: availableLoan,
            reason: `Insufficient available loan limit. Member has KES ${totalOutstanding.toLocaleString()} in outstanding loans and KES ${guaranteedAmount.toLocaleString()} in liens. Available limit: KES ${availableLoan.toLocaleString()}.`,
        };
    }

    return {
        eligible: true,
        maxLoan,
        reason: null,
    };
};

/**
 * Calculate loan due date based on grace period
 * @param {Date} issueDate - Loan issue date
 * @param {number} gracePeriodDays - Grace period in days
 * @returns {Date}
 */
export const calculateDueDate = (issueDate, gracePeriodDays) => {
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + gracePeriodDays);
    return dueDate;
};

/**
 * Check if loan is overdue
 * @param {Date} dueDate - Loan due date
 * @param {Date} currentDate - Current date (default: today)
 * @returns {boolean}
 */
export const isLoanOverdue = (dueDate, currentDate = new Date()) => {
    return new Date(dueDate) < currentDate;
};

/**
 * Calculate days overdue
 * @param {Date} dueDate - Loan due date
 * @param {Date} currentDate - Current date (default: today)
 * @returns {number}
 */
export const calculateDaysOverdue = (dueDate, currentDate = new Date()) => {
    const diffTime = currentDate - new Date(dueDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
};

/**
 * Auto-update loan status based on due date
 * @param {Object} loan - Loan object
 * @param {Date} currentDate - Current date
 * @returns {string} New status
 */
export const autoUpdateLoanStatus = (loan, currentDate = new Date()) => {
    if (loan.status === 'paid' || loan.status === 'defaulted') {
        return loan.status; // Don't change final states
    }

    if (isLoanOverdue(loan.dueDate, currentDate)) {
        const daysOverdue = calculateDaysOverdue(loan.dueDate, currentDate);

        // Consider defaulted after 90 days overdue
        if (daysOverdue > 90) {
            return 'defaulted';
        }

        return 'overdue';
    }

    return loan.status === 'approved' ? 'active' : loan.status;
};

/**
 * Calculate loan repayment breakdown
 * @param {number} paymentAmount - Payment amount
 * @param {number} principalRemaining - Remaining principal
 * @param {number} interestRemaining - Remaining interest
 * @param {number} penaltyAmount - Penalty amount
 * @returns {Object} { principal: number, interest: number, penalty: number, excess: number }
 */
export const calculateRepaymentBreakdown = (
    paymentAmount,
    principalRemaining,
    interestRemaining,
    penaltyAmount = 0
) => {
    let remaining = paymentAmount;
    const breakdown = {
        principal: 0,
        interest: 0,
        penalty: 0,
        excess: 0,
    };

    // Pay penalty first
    if (penaltyAmount > 0 && remaining > 0) {
        breakdown.penalty = Math.min(remaining, penaltyAmount);
        remaining -= breakdown.penalty;
    }

    // Pay interest second
    if (interestRemaining > 0 && remaining > 0) {
        breakdown.interest = Math.min(remaining, interestRemaining);
        remaining -= breakdown.interest;
    }

    // Pay principal last
    if (principalRemaining > 0 && remaining > 0) {
        breakdown.principal = Math.min(remaining, principalRemaining);
        remaining -= breakdown.principal;
    }

    // Any excess goes to principal
    if (remaining > 0) {
        breakdown.excess = remaining;
        breakdown.principal += remaining;
    }

    return breakdown;
};

/**
 * Get loan lifecycle statuses
 * @returns {Array} Array of status strings in order
 */
export const getLoanLifecycle = () => {
    return ['pending', 'approved', 'active', 'overdue', 'defaulted', 'paid'];
};

/**
 * Check if loan can transition to new status
 * @param {string} currentStatus - Current loan status
 * @param {string} newStatus - Desired new status
 * @returns {boolean}
 */
export const canTransitionLoanStatus = (currentStatus, newStatus) => {
    const lifecycle = getLoanLifecycle();
    const currentIndex = lifecycle.indexOf(currentStatus);
    const newIndex = lifecycle.indexOf(newStatus);

    if (currentIndex === -1 || newIndex === -1) {
        return false;
    }

    // Can move forward in lifecycle or to paid from any active state
    if (newStatus === 'paid') {
        return ['approved', 'active', 'overdue'].includes(currentStatus);
    }

    // Can only move forward or to adjacent states
    return newIndex >= currentIndex || Math.abs(newIndex - currentIndex) === 1;
};

