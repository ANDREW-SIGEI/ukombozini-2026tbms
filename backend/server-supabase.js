const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const supabase = require('./supabase');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// ==========================================
// GROUPS API
// ==========================================

// Get all groups
app.get('/api/groups', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('groups')
            .select('*')
            .order('name');

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new group
app.post('/api/groups', async (req, res) => {
    try {
        const { name, location, meetingDay } = req.body;

        const { data, error } = await supabase
            .from('groups')
            .insert([{
                name,
                location,
                meeting_day: meetingDay,
                status: 'active'
            }])
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// MEMBERS API (WITH OPENING BALANCE RULES)
// ==========================================

// Get members (optionally filter by groupId)
app.get('/api/members', async (req, res) => {
    try {
        const { groupId } = req.query;

        let query = supabase
            .from('members')
            .select('*')
            .order('name');

        if (groupId) {
            query = query.eq('group_id', groupId);
        }

        const { data, error } = await query;

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new member (WITH OPENING BALANCE RULES)
app.post('/api/members', async (req, res) => {
    try {
        const {
            name, phone, groupId,
            opening_balance_savings = 0,
            opening_balance_ltl = 0,
            opening_balance_stl = 0,
            opening_balance_reason,
            userId // Who is creating this member (for audit)
        } = req.body;

        // Validation: Opening balance reason required if any opening balance > 0
        const hasOpeningBalance = opening_balance_savings > 0 || opening_balance_ltl > 0 || opening_balance_stl > 0;
        if (hasOpeningBalance && !opening_balance_reason) {
            return res.status(400).json({
                error: 'Opening balance reason is required when setting opening balances'
            });
        }

        const { data, error } = await supabase
            .from('members')
            .insert([{
                name,
                phone,
                group_id: groupId,
                opening_balance_savings,
                opening_balance_ltl,
                opening_balance_stl,
                opening_balance_set_by: userId || 1,
                opening_balance_set_at: new Date().toISOString(),
                opening_balance_reason: opening_balance_reason || 'New member',
                opening_balance_locked: hasOpeningBalance,
                status: 'active'
            }])
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// SESSIONS API (MEETING MANAGEMENT)
// ==========================================

// Get all sessions
app.get('/api/sessions', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('meeting_sessions')
            .select('*')
            .order('date', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start Session (Create)
app.post('/api/sessions', async (req, res) => {
    try {
        const { groupId, officerId, date, startTime, endTime } = req.body;

        const { data, error } = await supabase
            .from('meeting_sessions')
            .insert([{
                group_id: groupId,
                officer_id: officerId,
                date,
                start_time: startTime,
                end_time: endTime,
                status: 'ACTIVE'
            }])
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Close Session (Update to PENDING_APPROVAL)
app.patch('/api/sessions/:id/close', async (req, res) => {
    try {
        const { id } = req.params;
        const { totals } = req.body;

        const { data, error } = await supabase
            .from('meeting_sessions')
            .update({
                status: 'PENDING_APPROVAL',
                totals
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, ...data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Post/Approve Session (Update to POSTED + Save Transactions)
app.post('/api/sessions/:id/post', async (req, res) => {
    try {
        const sessionId = req.params.id;
        const { transactions } = req.body;

        // 1. Update Session Status
        const { error: sessionError } = await supabase
            .from('meeting_sessions')
            .update({ status: 'POSTED' })
            .eq('id', sessionId);

        if (sessionError) throw sessionError;

        // 2. Insert Transactions
        if (transactions && transactions.length > 0) {
            const transactionsToInsert = transactions.map(t => ({
                session_id: sessionId,
                member_id: t.memberId,
                member_name: t.memberName,
                savings_amount: t.savings_amount || 0,
                stl_repayment: t.stl_repayment || 0,
                ltl_repayment: t.ltl_repayment || 0,
                loan_interest: t.loan_interest || 0,
                welfare: t.welfare || 0,
                fines: t.fines || 0,
                total_paid: t.total_paid || 0,
                attended: true
            }));

            const { error: txError } = await supabase
                .from('transactions')
                .insert(transactionsToInsert);

            if (txError) throw txError;
        }

        res.json({
            success: true,
            status: 'POSTED',
            transactionCount: transactions?.length || 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Transactions (for Reports)
app.get('/api/transactions', async (req, res) => {
    try {
        const { sessionId, groupId, month, year } = req.query;

        let query = supabase
            .from('transactions')
            .select(`
                *,
                meeting_sessions!inner(date, group_id)
            `);

        if (sessionId) {
            query = query.eq('session_id', sessionId);
        }

        if (groupId) {
            query = query.eq('meeting_sessions.group_id', groupId);
        }

        // Date filtering
        if (month && year) {
            const monthStr = String(parseInt(month) + 1).padStart(2, '0');
            const startDate = `${year}-${monthStr}-01`;
            const endDate = `${year}-${monthStr}-31`;
            query = query
                .gte('meeting_sessions.date', startDate)
                .lte('meeting_sessions.date', endDate);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Flatten the response (add sessionDate)
        const flatData = data.map(t => ({
            ...t,
            sessionDate: t.meeting_sessions?.date
        }));

        res.json(flatData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// HEALTH CHECK
// ==========================================

app.get('/api/health', async (req, res) => {
    try {
        // Test Supabase connection
        const { data, error } = await supabase
            .from('groups')
            .select('count')
            .limit(1);

        if (error) throw error;

        res.json({
            status: 'healthy',
            database: 'supabase',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`💾 Database: Supabase (PostgreSQL)`);
    console.log(`🔐 Environment: ${process.env.NODE_ENV || 'development'}`);
});
