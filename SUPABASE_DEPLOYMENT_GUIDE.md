# 🚀 Supabase Migration Deployment Guide

## Overview
This guide will help you deploy the **13 organized migrations** to your Supabase database. These migrations contain all the schema, security policies, calculations, and features for the Ukombozi Table Banking System.

---

## ✅ Pre-Deployment Checklist

- [ ] Supabase project created
- [ ] Project URL and API keys noted
- [ ] Database is empty or ready for a fresh reset
- [ ] You have admin access to Supabase Dashboard

---

## 📋 Migration Order (001-013)

Execute these files **in exact order**:

1. **001_core_schema.sql** - Core tables (Members, Groups, Transactions, Loans)
2. **002_rls_policies.sql** - Row Level Security policies
3. **003_calculation_views.sql** - Financial calculations and views
4. **004_dividend_engine.sql** - Dividend report generation logic
5. **005_loan_workflow.sql** - Loan applications and guarantors
6. **006_dividend_posting.sql** - Dividend posting and ledger
7. **007_loan_product_matrix.sql** - Loan products (STL, LTL, Emergency)
8. **008_meeting_sessions.sql** - Meeting management and attendance
9. **009_daily_reconciliation.sql** - Daily cash reconciliation
10. **010_sms_notifications.sql** - SMS templates and queues
11. **011_seed_opening_balances.sql** - Opening balance logic
12. **012_loan_reducing_balance_algo.sql** - Interest calculation algorithms
13. **013_seed_test_data.sql** - (OPTIONAL) Demo groups and members

---

## 🛠️ Deployment Methods

### **Method 1: Supabase Dashboard (Recommended for First-Time)**

1. **Open Supabase Dashboard**
   - Go to [https://app.supabase.com](https://app.supabase.com)
   - Select your project

2. **Navigate to SQL Editor**
   - Click **"SQL Editor"** in the left sidebar
   - Click **"New Query"**

3. **Execute Migrations One by One**
   ```bash
   # For each migration file (001 to 013):
   # 1. Open the file in your code editor
   # 2. Copy ALL the contents
   # 3. Paste into Supabase SQL Editor
   # 4. Click "RUN" (or press Ctrl+Enter)
   # 5. Wait for success message
   # 6. Proceed to next file
   ```

4. **Verify Each Step**
   - After running each migration, check for errors in the output panel
   - If errors occur, **STOP** and fix before proceeding
   - Common issues:
     - Missing dependencies (wrong order)
     - Syntax errors (check PostgreSQL version compatibility)
     - Duplicate objects (already exists - safe to ignore if re-running)

---

### **Method 2: Supabase CLI (For Advanced Users)**

If you have the Supabase CLI installed:

```bash
# 1. Login to Supabase
supabase login

# 2. Link your project
supabase link --project-ref YOUR_PROJECT_REF

# 3. Reset database (CAUTION: DELETES ALL DATA)
supabase db reset

# 4. Migrations will auto-run in order from supabase/migrations/
```

**Note**: The CLI automatically executes migrations in alphabetical order (001, 002, 003...).

---

### **Method 3: Batch Script (All at Once)**

Create a PowerShell script to concatenate and run all migrations:

```powershell
# concat_migrations.ps1
$outputFile = "supabase/all_migrations.sql"
$migrations = Get-ChildItem "supabase/migrations/*.sql" | Sort-Object Name

# Clear output file
if (Test-Path $outputFile) { Remove-Item $outputFile }

# Concatenate all migrations
foreach ($file in $migrations) {
    Add-Content $outputFile "-- ============================================"
    Add-Content $outputFile "-- FILE: $($file.Name)"
    Add-Content $outputFile "-- ============================================"
    Get-Content $file.FullName | Add-Content $outputFile
    Add-Content $outputFile "`n`n"
}

Write-Host "✅ All migrations combined into: $outputFile"
Write-Host "📋 Copy the contents and paste into Supabase SQL Editor"
```

Run:
```bash
.\concat_migrations.ps1
```

Then copy `supabase/all_migrations.sql` content to Supabase SQL Editor and run once.

---

## 🔍 Post-Deployment Verification

After running all migrations, verify the setup:

### 1. **Check Tables**
Run this query in SQL Editor:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

**Expected Tables** (at minimum):
- `groups`
- `members`
- `transactions`
- `loans`
- `loan_applications`
- `loan_guarantors`
- `loan_products`
- `dividend_runs`
- `dividend_payouts`
- `meeting_sessions`
- `daily_cash_reconciliation`
- `sms_notifications`
- `sms_templates`

### 2. **Check Views**
```sql
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public';
```

**Expected Views**:
- `member_net_position_view`
- `member_savings_view`
- `member_loan_balance_view`

### 3. **Check Functions (RPCs)**
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_type = 'FUNCTION';
```

**Expected Functions**:
- `generate_dividend_report`
- `post_dividend_run`
- `calculate_loan_eligibility`
- `generate_stl_reducing_balance_schedule`

### 4. **Test RLS Policies**
```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';
```

Should show policies for `members`, `groups`, `transactions`, etc.

---

## 🚨 Troubleshooting

### Error: "relation already exists"
- **Cause**: Table or view already created
- **Fix**: This is usually safe if re-running. If intentional fresh start, use:
  ```sql
  DROP SCHEMA public CASCADE;
  CREATE SCHEMA public;
  ```
  Then re-run all migrations.

### Error: "function does not exist"
- **Cause**: Migration order wrong
- **Fix**: Ensure you ran migrations in exact order (001→013)

### Error: "permission denied"
- **Cause**: RLS enabled but no policies
- **Fix**: Ensure `002_rls_policies.sql` ran successfully

### Error: "syntax error"
- **Cause**: PostgreSQL version mismatch or copy-paste issue
- **Fix**: 
  - Ensure Supabase is using PostgreSQL 14+
  - Re-copy the file content carefully
  - Check for hidden characters

---

## 🎯 Next Steps After Deployment

1. **Update Environment Variables**
   ```env
   # frontend/.env
   REACT_APP_SUPABASE_URL=https://your-project.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=your-anon-key
   ```

2. **Test API Connections**
   - Open frontend app
   - Try logging in
   - Check if data loads

3. **Seed Initial Data** (Optional)
   - If you skipped `013_seed_test_data.sql`, create your first group and members manually via UI

4. **Enable Realtime** (Optional)
   - In Supabase Dashboard → Database → Replication
   - Enable realtime for tables like `transactions`, `members`

---

## 📞 Support

If you encounter issues:
1. Check the SQL output panel for exact error messages
2. Verify you're running migrations in order
3. Ensure your Supabase project is on a compatible PostgreSQL version (14+)

---

**Status**: ✅ Ready for Deployment  
**Last Updated**: 2026-01-20  
**Migration Count**: 13 files
