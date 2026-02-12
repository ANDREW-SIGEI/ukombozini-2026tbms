/**
 * UKOMBOZINI Repayment Schedule Generator
 * Calculates monthly installments based on standardized loan product terms.
 */
export const generateRepaymentSchedule = (amount, duration, monthlyInstallment, startDate = new Date()) => {
    const schedule = [];
    let remainingBalance = amount;

    // We use the matrix-driven terms
    const principalPerMonth = amount / duration;
    // Note: Interest in UKOMBOZINI matrix is usually flat or pre-calculated
    // For the schedule, we'll use the matrix values provided

    for (let i = 1; i <= duration; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i);

        remainingBalance -= principalPerMonth;

        schedule.push({
            installmentNumber: i,
            dueDate: dueDate.toISOString().split('T')[0],
            amount: monthlyInstallment,
            principal: principalPerMonth,
            interest: monthlyInstallment - principalPerMonth, // Derived from matrix
            remainingBalance: Math.max(0, remainingBalance)
        });
    }

    return schedule;
};

export default generateRepaymentSchedule;
