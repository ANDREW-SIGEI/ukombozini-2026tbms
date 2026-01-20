# 🚨 CRITICAL: Database Schema Mismatch Detected

## Problem:
Your database has an old schema where `groups.id` is `UUID`, but the new migrations expect it to be `BIGINT`.

## Solution: Complete Database Reset

### Step 1: Run the Reset Script
In **Supabase SQL Editor**, run this **FIRST**:

```sql
-- Copy from: supabase/migrations/000_reset_database.sql
-- This will drop EVERYTHING and give you a clean slate
```

### Step 2: Run Migrations in Order (001-013)
After the reset, run these in **exact order**:

1. ✅ `001_core_schema.sql` - Core tables (groups.id will be BIGINT)
2. ✅ `002_rls_policies.sql` - Security (functions will match schema)
3. ✅ `003_calculation_views.sql`
4. ✅ `004_dividend_engine.sql`
5. ✅ `005_loan_workflow.sql`
6. ✅ `006_dividend_posting.sql`
7. ✅ `007_loan_product_matrix.sql`
8. ✅ `008_meeting_sessions.sql`
9. ✅ `009_daily_reconciliation.sql`
10. ✅ `010_sms_notifications.sql`
11. ✅ `011_seed_opening_balances.sql`
12. ✅ `012_loan_reducing_balance_algo.sql`
13. ⚠️ `013_seed_test_data.sql` (OPTIONAL - test data)

### Step 3: Configure Frontend
Create `frontend/.env`:
```env
REACT_APP_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
REACT_APP_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
```

### Step 4: Restart Dev Server
```bash
cd frontend
npm start
```

### Step 5: Test Group Registration
Should work perfectly! ✅

---

## Why This Happened:
- Old schema had `UUID` for group IDs
- New schema uses `BIGINT` (auto-incrementing)
- Migrations assume fresh database with correct types
- Running `IF NOT EXISTS` kept old schema structure

## The Fix:
Complete reset ensures **100% schema alignment** between migrations and database.

---

## Alternative (If You Have Data to Save):
If you have important data in the database:
1. Export your data first (Supabase Dashboard → Table Editor → Export)
2. Run reset script
3. Run migrations 001-013
4. Manually re-import data

But since you're just setting up, **fresh reset is fastest**! 🚀
