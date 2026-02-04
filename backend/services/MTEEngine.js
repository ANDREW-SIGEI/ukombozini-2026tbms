/**
 * UKOMBOZI Member Transaction Engine (MTE) v2
 * Institutional-grade financial core.
 */

const TRANSACTION_MAP = {
    'SAVINGS': {
        memberField: 'current_savings', memberDelta: 1, riskDelta: -1,
        entries: [
            { type: 'MEMBER', account: 'SAVINGS', direction: 'CREDIT' },
            { type: 'GROUP', account: 'CASH', direction: 'DEBIT' }
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
        entries: [
            { type: 'MEMBER', account: 'EDUCATION_SAVINGS', direction: 'CREDIT' },
            { type: 'GROUP', account: 'CASH', direction: 'DEBIT' }
        ]
    },
    'AGRICULTURE': {
        memberField: 'agriculture_savings', memberDelta: 1, riskDelta: 0,
        entries: [
            { type: 'MEMBER', account: 'AGRICULTURE_SAVINGS', direction: 'CREDIT' },
            { type: 'GROUP', account: 'CASH', direction: 'DEBIT' }
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
    }
};

/**
 * Core MTE Engine Logic
 * @param {Object} client - PostgreSQL client (within transaction)
 * @param {Object} params - { memberId, sessionId, transaction_type, amount, description, txRef }
 * @param {Number} officerId - The officer performing the action
 */
async function runMTELogic(client, params, officerId) {
    const { memberId, sessionId, transaction_type, amount, description, txRef } = params;
    const val = parseFloat(amount);
    const convertSql = (s) => { let c = 0; return s.replace(/\?/g, () => `$${++c}`); };

    // 1. LOGIC ROUTING
    const txKey = transaction_type.toUpperCase().replace(/\s/g, '_');
    const txConfig = TRANSACTION_MAP[txKey];
    if (!txConfig) throw new Error(`Unsupported transaction type: ${transaction_type}`);

    // 2. Get Context
    const memberRes = await client.query(convertSql(`SELECT group_id FROM members WHERE id = ?`), [memberId]);
    if (memberRes.rows.length === 0) throw new Error('Member not found');
    const groupId = memberRes.rows[0].group_id;

    // 3. Update Member Balance & Risk
    const mUpdates = [`${txConfig.memberField} = COALESCE(${txConfig.memberField}, 0) + ?`];
    const mParams = [val * txConfig.memberDelta];
    if (txConfig.riskDelta !== 0) {
        // 🛡️ CROSS-DB COMPATIBLE CLAMPING (0-100)
        // Replaces LEAST(100, GREATEST(0, ...)) with CASE WHEN for SQLite/Postgres compatibility
        mUpdates.push(`
            risk_score = CASE 
                WHEN (COALESCE(risk_score, 50) + ?) > 100 THEN 100 
                WHEN (COALESCE(risk_score, 50) + ?) < 0 THEN 0 
                ELSE (COALESCE(risk_score, 50) + ?) 
            END
        `);
        // We push the parameter 3 times because standard SQL '?' parameters cannot be reused by name/index easily here
        mParams.push(txConfig.riskDelta);
        mParams.push(txConfig.riskDelta);
        mParams.push(txConfig.riskDelta);
    }
    mParams.push(memberId);
    await client.query(convertSql(`UPDATE members SET ${mUpdates.join(', ')} WHERE id = ?`), mParams);

    // 4. TRIPLE-ENTRY LEDGER POSTING
    for (const entry of txConfig.entries) {
        let entityId = null;
        let accountFullName = entry.account;

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
        `), [txRef, accountFullName, entry.type, entityId, entry.direction, val, sessionId || null, officerId, description || '']);

        // Update Institutional Balance
        if (entry.type !== 'MEMBER') {
            const balanceDelta = entry.direction === 'DEBIT' ? val : -val;
            await client.query(convertSql(`
                INSERT INTO account_balances (account_name, account_category, balance)
                VALUES (?, ?, ?)
                ON CONFLICT (account_name) DO UPDATE SET balance = account_balances.balance + ?, last_updated = CURRENT_TIMESTAMP
            `), [accountFullName, entry.type, balanceDelta, balanceDelta]);
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
        'DIVIDEND': 'deposits'
    };
    const legacyField = legacyMap[txKey] || 'deposits';
    await client.query(convertSql(`
        INSERT INTO transactions (memberId, sessionId, transaction_type, ${legacyField}, description, status, uploaded)
        VALUES (?, ?, ?, ?, ?, 'COMPLETED', 1)
    `), [memberId, sessionId || null, txKey, val, description || '']);
}

module.exports = {
    TRANSACTION_MAP,
    runMTELogic
};
