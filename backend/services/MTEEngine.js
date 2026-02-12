const CashControlService = require('./CashControlService');
const { logAndSendSMS } = require('../utils/logger');
const { calculateNextMeeting, getSeasonalGreeting } = require('../utils/dates');

/**
 * UKOMBOZINI Member Transaction Engine (MTE) v2
 * Institutional-grade financial core.
 */

/**
 * TRF Calculation Rule:
 * 1% of amount, capped at KES 3,000 (for amounts > 300,000)
 */
function calculateTRF(amount) {
    const fee = amount * 0.01;
    return Math.min(fee, 3000);
}

const TRANSACTION_MAP = {
    'SAVINGS': {
        memberField: 'current_savings', memberDelta: 1, riskDelta: -1,
        hasTRF: true,
        entries: [
            { type: 'MEMBER', account: 'SAVINGS', direction: 'CREDIT', amountSource: 'NET' },
            { type: 'SYSTEM', account: 'REVENUE_TRF', direction: 'CREDIT', amountSource: 'TRF' },
            { type: 'GROUP', account: 'CASH', direction: 'DEBIT', amountSource: 'GROSS' }
        ]
    },
    'WELFARE': {
        memberField: 'welfare_balance', memberDelta: 1, riskDelta: 0,
        entries: [
            { type: 'MEMBER', account: 'WELFARE', direction: 'CREDIT' },
            { type: 'SYSTEM', account: 'WELFARE_FUND', direction: 'DEBIT' }
        ]
    },
    'PENALTY': {
        memberField: 'penalties', memberDelta: 1, riskDelta: 10,
        entries: [
            { type: 'MEMBER', account: 'PENALTY', direction: 'DEBIT' },
            { type: 'GROUP', account: 'REVENUE_PENALTY', direction: 'CREDIT' }
        ]
    },
    'WITHDRAWAL': {
        memberField: 'current_savings', memberDelta: -1, riskDelta: 2,
        entries: [
            { type: 'MEMBER', account: 'SAVINGS', direction: 'DEBIT' },
            { type: 'GROUP', account: 'CASH', direction: 'CREDIT' }
        ]
    },
    'LOAN_REPAYMENT': {
        memberField: 'active_loan_balance', memberDelta: -1, riskDelta: -10,
        entries: [
            { type: 'MEMBER', account: 'LOAN_PRINCIPAL', direction: 'CREDIT' },
            { type: 'GROUP', account: 'CASH', direction: 'DEBIT' }
        ]
    },
    'INTEREST_PAYMENT': {
        memberField: 'risk_score', memberDelta: 0, riskDelta: -2,
        entries: [
            { type: 'GROUP', account: 'REVENUE_INTEREST', direction: 'CREDIT' },
            { type: 'GROUP', account: 'CASH', direction: 'DEBIT' }
        ]
    },
    'PENALTY_PAYMENT': {
        memberField: 'penalties', memberDelta: -1, riskDelta: -5,
        entries: [
            { type: 'MEMBER', account: 'PENALTY', direction: 'CREDIT' },
            { type: 'GROUP', account: 'CASH', direction: 'DEBIT' }
        ]
    },
    'LOAN_ISSUANCE': {
        memberField: 'active_loan_balance', memberDelta: 1, riskDelta: 10,
        entries: [
            { type: 'MEMBER', account: 'LOAN_PRINCIPAL', direction: 'DEBIT' },
            { type: 'GROUP', account: 'CASH', direction: 'CREDIT' }
        ]
    },
    'EDUCATION': {
        memberField: 'education_savings', memberDelta: 1, riskDelta: 0,
        hasTRF: true,
        entries: [
            { type: 'MEMBER', account: 'EDUCATION_SAVINGS', direction: 'CREDIT', amountSource: 'NET' },
            { type: 'SYSTEM', account: 'REVENUE_TRF', direction: 'CREDIT', amountSource: 'TRF' },
            { type: 'GROUP', account: 'CASH', direction: 'DEBIT', amountSource: 'GROSS' }
        ]
    },
    'AGRICULTURE': {
        memberField: 'agriculture_savings', memberDelta: 1, riskDelta: 0,
        hasTRF: true,
        entries: [
            { type: 'MEMBER', account: 'AGRICULTURE_SAVINGS', direction: 'CREDIT', amountSource: 'NET' },
            { type: 'SYSTEM', account: 'REVENUE_TRF', direction: 'CREDIT', amountSource: 'TRF' },
            { type: 'GROUP', account: 'CASH', direction: 'DEBIT', amountSource: 'GROSS' }
        ]
    },
    'DIVIDEND': {
        memberField: 'current_savings', memberDelta: 1, riskDelta: -2,
        entries: [
            { type: 'MEMBER', account: 'SAVINGS', direction: 'CREDIT' },
            { type: 'GROUP', account: 'REVENUE_RETAINED', direction: 'DEBIT' }
        ]
    },
    'PARTNER_TOPUP': {
        memberField: 'risk_score', memberDelta: 0, riskDelta: -5, // Improving group risk
        entries: [
            { type: 'GROUP', account: 'CASH', direction: 'DEBIT' },
            { type: 'SYSTEM', account: 'PARTNER_INVESTMENT', direction: 'CREDIT' }
        ]
    },
    'COMMITMENT_DEPOSIT': {
        memberField: 'risk_score', memberDelta: 0, riskDelta: -2,
        entries: [
            { type: 'SYSTEM', account: 'ESCROW_COMMITMENT', direction: 'DEBIT' },
            { type: 'GROUP', account: 'CASH', direction: 'CREDIT' }
        ]
    },
    'PRODUCTFINANCING': {
        memberField: 'active_asset_balance', memberDelta: 1, riskDelta: 5,
        entries: [
            { type: 'MEMBER', account: 'ASSET_LOAN', direction: 'DEBIT' },
            { type: 'SYSTEM', account: 'INVENTORY', direction: 'CREDIT' }
        ]
    },
    'PARTNER_OFFSET': {
        memberField: 'active_loan_balance', memberDelta: -1, riskDelta: -5,
        entries: [
            { type: 'MEMBER', account: 'LOAN_PRINCIPAL', direction: 'CREDIT' },
            { type: 'SYSTEM', account: 'ESCROW_COMMITMENT', direction: 'DEBIT' }
        ]
    },
    'SAVINGS_REVERSAL': {
        memberField: 'current_savings', memberDelta: -1, riskDelta: 1,
        entries: [
            { type: 'MEMBER', account: 'SAVINGS', direction: 'DEBIT' },
            { type: 'GROUP', account: 'CASH', direction: 'CREDIT' }
        ]
    },
    'WITHDRAWAL_REVERSAL': {
        memberField: 'current_savings', memberDelta: 1, riskDelta: -2,
        entries: [
            { type: 'MEMBER', account: 'SAVINGS', direction: 'CREDIT' },
            { type: 'GROUP', account: 'CASH', direction: 'DEBIT' }
        ]
    },
    'LOAN_REPAYMENT_REVERSAL': {
        memberField: 'active_loan_balance', memberDelta: 1, riskDelta: 10,
        entries: [
            { type: 'MEMBER', account: 'LOAN_PRINCIPAL', direction: 'DEBIT' },
            { type: 'GROUP', account: 'CASH', direction: 'CREDIT' }
        ]
    },
    'GROUP_LOAN': {
        memberField: 'risk_score', memberDelta: 0, riskDelta: 5,
        entries: [
            { type: 'GROUP', account: 'CASH', direction: 'DEBIT' },
            { type: 'GROUP', account: 'LOAN_PAYABLE', direction: 'CREDIT' },
            { type: 'SYSTEM', account: 'LOAN_RECEIVABLE', direction: 'DEBIT' }
        ]
    },
    'GROUP_LOAN_REPAYMENT': {
        memberField: 'risk_score', memberDelta: 0, riskDelta: -5,
        entries: [
            { type: 'GROUP', account: 'CASH', direction: 'CREDIT' },
            { type: 'GROUP', account: 'LOAN_PAYABLE', direction: 'DEBIT' },
            { type: 'SYSTEM', account: 'LOAN_RECEIVABLE', direction: 'CREDIT' }
        ]
    },
    'GROUP_CAPITAL': {
        memberField: 'risk_score', memberDelta: 0, riskDelta: -5,
        entries: [
            { type: 'GROUP', account: 'CASH', direction: 'DEBIT' },
            { type: 'SYSTEM', account: 'CAPITAL_INVESTMENT', direction: 'CREDIT' }
        ]
    },
    'GROUP_PRODUCT_ALLOCATION': {
        memberField: 'risk_score', memberDelta: 0, riskDelta: 2,
        entries: [
            { type: 'GROUP', account: 'INVENTORY', direction: 'DEBIT' },
            { type: 'SYSTEM', account: 'INVENTORY_RELEASE', direction: 'CREDIT' }
        ]
    }
};

/**
 * Core MTE Engine Logic
 * @param {Object} client - PostgreSQL client (within transaction)
 * @param {Object} params - { memberId, sessionId, transaction_type, amount, description, txRef, groupId }
 * @param {Number} officerId - The officer performing the action
 */
async function runMTELogic(client, params, officerId) {
    const { memberId, sessionId, transaction_type, amount, description, txRef } = params;
    let { groupId } = params;
    const grossVal = parseFloat(amount);
    const convertSql = (s) => { let c = 0; return s.replace(/\?/g, () => `$${++c}`); };

    // 1. LOGIC ROUTING
    const txKey = transaction_type.toUpperCase().replace(/\s/g, '_');
    const txConfig = TRANSACTION_MAP[txKey];
    if (!txConfig) throw new Error(`Unsupported transaction type: ${transaction_type}`);

    // 2. TRF Calculation
    const trfVal = txConfig.hasTRF ? calculateTRF(grossVal) : 0;
    const netVal = grossVal - trfVal;

    // 2. Get Context
    if (memberId !== 0) {
        const memberRes = await client.query(convertSql(`SELECT group_id FROM members WHERE id = ?`), [memberId]);
        if (memberRes.rows.length === 0) throw new Error('Member not found');
        if (!groupId) groupId = memberRes.rows[0].group_id;
    } else {
        // Systemic transaction - groupId should be provided or default to 0
        if (!groupId) groupId = 0;
    }

    // 2.5 Institutional Liquidity Guard
    if (groupId > 0 && ['WITHDRAWAL', 'LOAN_ISSUANCE', 'GROUP_LOAN'].includes(txKey)) {
        // Use CashControlService to validate that the physical cash bag has enough
        await CashControlService.validateLiquidity(groupId, grossVal);
    }

    // 3. Update Member Balance & Risk (SKIP for Systemic)
    const memberAmount = txConfig.hasTRF ? netVal : grossVal;

    if (memberId !== 0) {
        const mUpdates = [`${txConfig.memberField} = COALESCE(${txConfig.memberField}, 0) + ?`];
        const mParams = [memberAmount * txConfig.memberDelta];

        if (txConfig.riskDelta !== 0) {
            mUpdates.push(`
            risk_score = CASE 
                WHEN (COALESCE(risk_score, 50) + ?) > 100 THEN 100 
                WHEN (COALESCE(risk_score, 50) + ?) < 0 THEN 0 
                ELSE (COALESCE(risk_score, 50) + ?) 
            END
        `);
            mParams.push(txConfig.riskDelta);
            mParams.push(txConfig.riskDelta);
            mParams.push(txConfig.riskDelta);
        }
        mParams.push(memberId);
        await client.query(convertSql(`UPDATE members SET ${mUpdates.join(', ')} WHERE id = ?`), mParams);
    }

    // 4. TRIPLE-ENTRY LEDGER POSTING
    for (const entry of txConfig.entries) {
        let entityId = null;
        let accountFullName = entry.account;

        // Determine value based on amountSource
        let entryVal = grossVal;
        if (entry.amountSource === 'NET') entryVal = netVal;
        else if (entry.amountSource === 'TRF') entryVal = trfVal;

        if (entry.type === 'MEMBER') {
            entityId = memberId;
            accountFullName = `MEMBER_${memberId}_${entry.account}`;
        } else if (entry.type === 'GROUP') {
            entityId = groupId;
            accountFullName = `GROUP_${groupId}_${entry.account}`;
        } else if (entry.type === 'SYSTEM') {
            entityId = 0; // System level
            accountFullName = `SYSTEM_${entry.account}`;
        }

        // Write Ledger Entry
        await client.query(convertSql(`
            INSERT INTO ledger_entries (
                tx_ref, account_name, entity_type, entity_id, direction, amount, session_id, officer_id, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `), [txRef, accountFullName, entry.type, entityId, entry.direction, entryVal, sessionId || null, officerId, description || '']);

        // Update Institutional Balance
        if (entry.type !== 'MEMBER') {
            const balanceDelta = entry.direction === 'DEBIT' ? entryVal : -entryVal;
            await client.query(convertSql(`
                INSERT INTO account_balances (account_name, account_category, balance)
                VALUES (?, ?, ?)
                ON CONFLICT (account_name) DO UPDATE SET balance = account_balances.balance + ?, last_updated = CURRENT_TIMESTAMP
            `), [accountFullName, entry.type, balanceDelta, balanceDelta]);

            // [PHASE 18] AUTO-LOG TO CASH CONTROL (Reconciliation)
            // If the account is Group Cash, we mirror it to the reconciliation ledger
            if (entry.type === 'GROUP' && entry.account === 'CASH') {
                try {
                    // Resolve the cash_session_id from the meeting session
                    const cashSession = await client.query(convertSql(`
                        SELECT id FROM cash_sessions WHERE meeting_id = ? OR (group_id = ? AND status = 'OPEN') LIMIT 1
                    `), [sessionId, groupId]);

                    if (cashSession.rows.length > 0) {
                        const csid = cashSession.rows[0].id;
                        await CashControlService.logRecord({
                            sessionId: csid,
                            source: txKey,
                            referenceId: txRef,
                            amount: entryVal,
                            direction: entry.direction === 'DEBIT' ? 'IN' : 'OUT',
                            createdBy: officerId
                        });
                    }
                } catch (ccErr) {
                    console.error("Auto-Log Reconciliation Error:", ccErr.message);
                }
            }
        }
    }

    // 5. LEGACY TRANSACTIONS TABLE LOG (for UI compatibility)
    const legacyMap = {
        'SAVINGS': 'deposits',
        'WITHDRAWAL': 'withdrawals',
        'LOAN_REPAYMENT': 'stl_repayment',
        'PENALTY': 'fines',
        'EDUCATION': 'deposits',
        'AGRICULTURE': 'deposits',
        'DIVIDEND': 'deposits',
        'LOAN_ISSUANCE': 'loans_issued',
        'GROUP_LOAN': 'loans_issued',
        'GROUP_CAPITAL': 'deposits',
        'GROUP_PRODUCT_ALLOCATION': 'loans_issued',
        'GROUP_LOAN_REPAYMENT': 'stl_repayment'
    };
    const legacyField = legacyMap[txKey] || 'deposits';

    // Set 'type' alias for reports
    let typeAlias = txKey;
    if (['LOAN_REPAYMENT', 'INTEREST_PAYMENT', 'PENALTY_PAYMENT'].includes(txKey)) {
        typeAlias = 'REPAYMENT';
    }

    await client.query(convertSql(`
        INSERT INTO transactions (
            memberId, member_id, sessionId, group_id, transaction_type, type, 
            amount, loan_id, ${legacyField}, description, status, uploaded
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', 1)
    `), [
        memberId, memberId, sessionId || null, groupId, txKey, typeAlias,
        memberAmount, params.loanId || null, memberAmount, description || ''
    ]);

    // 6. Automated Repayment Schedule Updates
    if (['LOAN_REPAYMENT', 'INTEREST_PAYMENT'].includes(txKey)) {
        // Logic: Find the oldest pending installment for this member/loan and update it
        // If loanId is not provided, find the active loan for the member
        let targetLoanId = params.loanId;
        if (!targetLoanId && memberId !== 0) {
            const loanRes = await client.query(convertSql(`SELECT id FROM loans WHERE member_id = ? AND status IN ('active', 'DISBURSED') LIMIT 1`), [memberId]);
            if (loanRes.rows.length > 0) targetLoanId = loanRes.rows[0].id;
        }

        if (targetLoanId) {
            const updateField = txKey === 'LOAN_REPAYMENT' ? 'actual_principal_paid' : 'actual_interest_paid';
            // Find oldest pending installment
            const scheduleRes = await client.query(convertSql(`
                SELECT id FROM repayment_schedule 
                WHERE loan_id = ? AND status = 'pending' 
                ORDER BY installment_number ASC LIMIT 1
            `), [targetLoanId]);

            if (scheduleRes.rows.length > 0) {
                const scheduleId = scheduleRes.rows[0].id;
                // Update amount and check if fully paid
                await client.query(convertSql(`
                    UPDATE repayment_schedule 
                    SET paid_amount = paid_amount + ?,
                        status = CASE 
                            WHEN (paid_amount + ?) >= expected_installment THEN 'paid' 
                            ELSE 'pending' 
                        END,
                        payment_date = CURRENT_TIMESTAMP
                    WHERE id = ?
                `), [grossVal, grossVal, scheduleId]);
            }
        }
    }

    // 7. Automated SMS Receipting
    if (memberId !== 0 && ['SAVINGS', 'LOAN_REPAYMENT', 'INTEREST_PAYMENT', 'PENALTY_PAYMENT', 'EDUCATION', 'AGRICULTURE', 'WITHDRAWAL', 'LOAN_ISSUANCE'].includes(txKey)) {
        try {
            // Re-fetch member and group details for the receipt (current balance, next meeting, etc.)
            const memberInfo = await client.query(convertSql(`
                SELECT m.name, m.current_savings, m.education_savings, m.agriculture_savings, 
                       m.active_loan_balance, m.penalties, g.meetingDay 
                FROM members m
                JOIN groups g ON m.group_id = g.id
                WHERE m.id = ?
            `), [memberId]);

            if (memberInfo.rows.length > 0) {
                const member = memberInfo.rows[0];
                let receiptMsg = "";
                const amountStr = Math.abs(grossVal).toLocaleString();
                const nextMeeting = calculateNextMeeting(member.meetingDay);

                // Financial Matrix Construction
                const matrix = `MATRIX: Sav: ${member.current_savings.toLocaleString()} | Edu: ${member.education_savings.toLocaleString()} | Agri: ${member.agriculture_savings.toLocaleString()} | Loan: ${member.active_loan_balance.toLocaleString()}. Next: ${nextMeeting}`;

                switch (txKey) {
                    case 'SAVINGS':
                        receiptMsg = `UKOMBOZINI: Received KES ${amountStr} for SAVINGS. ${matrix}. Ref: ${txRef}`;
                        break;
                    case 'LOAN_REPAYMENT':
                    case 'INTEREST_PAYMENT':
                        receiptMsg = `UKOMBOZINI: Received KES ${amountStr} for LOAN. ${matrix}. Ref: ${txRef}`;
                        break;
                    case 'WITHDRAWAL':
                        receiptMsg = `UKOMBOZINI: ${amountStr} withdrawn. ${matrix}. Ref: ${txRef}`;
                        break;
                    case 'LOAN_ISSUANCE':
                        receiptMsg = `UKOMBOZINI: Loan of ${amountStr} issued. ${matrix}. Ref: ${txRef}`;
                        break;
                    default:
                        receiptMsg = `UKOMBOZINI: Confirmed! KES ${amountStr} for ${transaction_type}. ${matrix}. Ref: ${txRef}`;
                }

                if (receiptMsg) {
                    receiptMsg += getSeasonalGreeting();
                    logAndSendSMS(memberId, receiptMsg, 'RECEIPT', txRef, 'members');
                }
            }
        } catch (smsErr) {
            console.error("MTE SMS Receipt Error:", smsErr.message);
        }
    }
}

module.exports = {
    TRANSACTION_MAP,
    runMTELogic
};
