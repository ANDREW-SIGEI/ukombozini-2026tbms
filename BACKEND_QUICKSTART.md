# 🚀 UKOMBOZI Backend Integration - Quick Start Guide

## ⚡ GET STARTED IN 5 MINUTES

This guide will help you connect your UK OMBOZI system to Supabase database.

---

## 📋 PREREQUISITES

✅ Active Supabase account ([Sign up free](https://supabase.com))  
✅ Node.js installed  
✅ UKOMBOZI frontend running  

---

## 🎯 STEP-BY-STEP SETUP

### **STEP 1: Get Supabase Credentials** (2 minutes)

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click your project (or create a new one)
3. Go to **Settings** (leftside bar) → **API**
4. Copy these two values:
   - **Project URL** (looks like: `https://abcdefgh.supabase.co`)
   - **Project API keys** → **anon public** (starts with `eyJ...`)

![Supabase API Settings](https://your-screenshot-url-here)

---

### **STEP 2: Configure Environment** (1 minute)

1. Navigate to frontend folder:
   ```bash
   cd c:\Users\HILDA SIGEI\OneDrive\Desktop\ukombozini-2026tbms\frontend
   ```

2. Copy the environment template:
   ```bash
   copy .env.example .env
   ```

3. Open `.env` file in notepad:
   ```bash
   notepad .env
   ```

4. Replace the placeholder values with YOUR credentials:
   ```env
   REACT_APP_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=eyJhbGci...YOUR-ACTUAL-KEY
   ```

5. Save and close

---

### **STEP 3: Set Up Database** (2 minutes)

#### **Option A: Use Existing Tables** (If you already ran migrations)
Skip to Step 4

#### **Option B: Create Tables** (If fresh database)

1. In Supabase dashboard, go to **SQL Editor**
2. Run this to check if tables exist:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```

3. If no tables exist, run your SQL migrations:
   - Go to `supabase/migrations/` folder
   - Copy SQL files to Supabase SQL Editor
   - Run them in order (001 to 024)

**Required Tables (Institutional Standard):**
- ✅ `groups` (with Chairperson, Secretary, Treasurer)
- ✅ `members` (with materialize balances)
- ✅ `profiles` (Officer management)
- ✅ `transactions` (Audit source of truth)
- ✅ `loans` (STL & LTL tracking)
- ✅ `meeting_sessions` (Temporal locking)
- ✅ `daily_cash_reports`

---

### **STEP 4: Restart Development Server** (30 seconds)

1. Stop the current server (Ctrl+C in terminal)
2. Start it again:
   ```bash
   npm start
   ```

3. Wait for "Compiled successfully!" message

---

### **STEP 5: Test the Integration** (1 minute)

1. Open browser: `http://localhost:3000`
2. Go to **Members** page
3. The list should now load from Supabase (instead of mock data)

**If you see members:**  
✅ **SUCCESS!** You're now connected to Supabase!

**If you see errors:**  
See troubleshooting section below

---

## 🧪 VERIFY EVERYTHING WORKS

### **Test 1: View Members**
- Go to Members page
- Should load members from Supabase
- If empty, that's OK (no data yet)

### **Test 2: Post a Contribution**
1. Click 💰 icon on any member
2. Fill in contribution details
3. Confirm and post
4. Check Supabase → **Transactions** table
5. Should see new row!

### **Test 3: Issue a Loan**
1. Click 🏦 icon on any member
2. Fill in loan details
3. Confirm and issue
4. Check Supabase → **Loans** table
5. Should see new row!

---

## 🐛 TROUBLESHOOTING

### **Problem: "Missing Supabase credentials"**
**Cause:** `.env` file not found or empty  
**Fix:**
1. Make sure `.env` file exists in `frontend/` folder
2. Check it has the two variables set
3. Restart server

---

### **Problem: "Table does not exist"**
**Cause:** Database tables not created  
**Fix:**
1. Run SQL migrations in Supabase
2. Verify tables exist using SQL Editor:
   ```sql
   SELECT * FROM members LIMIT 1;
   ```

---

### **Problem: "Invalid API key"**
**Cause:** Wrong anon key copied  
**Fix:**
1. Go back to Supabase → Settings → API
2. Copy the **anon public** key (NOT the service_role key)
3. Update `.env` file
4. Restart server

---

### **Problem: Still showing mock data**
**Cause:** Server not restarted after `.env` change  
**Fix:**
1. Stop server (Ctrl+C)
2. Start again (`npm start`)
3. Clear browser cache (Ctrl+Shift+R)

---

## 📊 VERIFY IN SUPABASE DASHBOARD

After posting transactions, check if data appears in Supabase:

1. Go to Supabase dashboard
2. Click **Table Editor** (leftside)
3. Select table (e.g., `transactions`)
4. Should see your posted data!

![Supabase Table Editor](https://your-screenshot-url-here)

---

## 🎉 YOU'RE DONE!

Your UKOMBOZI system is now:
- ✅ Connected to Supabase database
- ✅ Storing real data with Institutional Integrity
- ✅ Automated Balance Synchronous Triggers active
- ✅ Digital Signature on Reports enabled
- ✅ Ready for production use

---

## 🔐 ADVANCED SETUP: Officer Authentication

The system is now elite-grade and requires Supabase Auth for Officers:

1.  **Go to Supabase Dashboard** → **Authentication** → **Users**.
2.  **Add User:** Enter the Officer's email and a temporary password (the one generated in the Admin Panel).
3.  **Link Profile:** 
    *   Once the user is created, copy their **User ID (UUID)**.
    *   Go to **Table Editor** → **profiles**.
    *   Insert a new row with that UUID, their name, and a role (`field_officer`, `admin`, or `director`).

---

## 📄 DOCUMENT INTEGRITY: Digital Signatures

All PDF reports generated by the system now include a **Digital Signature** footer:
- **What it is:** A unique 16-character transactional hash + high-resolution timestamp.
- **Verification:** Any attempt to manually edit the PDF will invalidate the hash, ensuring non-repudiation for member statements and group reports.

---

## 🔄 NEXT: Populate Sample Data (Optional)

Want to start with sample data?

Run this in Supabase SQL Editor:

```sql
-- Create a test group
INSERT INTO groups (group_name, location, status)
VALUES ('Ukombozi Group A', 'Nairobi Central', 'ACTIVE');

-- Create test members
INSERT INTO members (full_name, group_id, phone, status)
VALUES 
    ('Hilda Sigei', 1, '+254712345678', 'active'),
    ('John Doe', 1, '+254723456789', 'active'),
    ('Jane Smith', 1, '+254734567890', 'active');

-- Create a test meeting
-- Note: Replace UUID below with your actual Profile ID from Supabase
INSERT INTO meetings (group_id, meeting_date, status, created_by)
VALUES (1, CURRENT_DATE, 'draft', 'YOUR_OWN_UUID');
```

Refresh your app → You'll see the sample data!

---

## 📞 NEED HELP?

**Common Issues:**
1. **.env file not working** → Make sure it's named exactly `.env` (not `.env.txt`)
2. **CORS errors** → Supabase allows all origins by default, check your project URL
3. **Permission denied** → Check if tables have RLS policies blocking access

**Still stuck?**
- Review `BACKEND_INTEGRATION_COMPLETE.md` for detailed docs
- Check console for error messages
- Verify Supabase project status

---

## ✅ COMPLETION CHECKLIST

- [ ] Supabase account created
- [ ] Project URL copied
- [ ] Anon key copied
- [ ] `.env` file created
- [ ] Credentials added to `.env`
- [ ] Server restarted
- [ ] Members page loads
- [ ] Test contribution posted
- [ ] Test loan issued
- [ ] Data appears in Supabase

**All checked?** 🎉 **You're ready for production!**

---

**Quick Start Guide Version:** 1.0  
**Last Updated:** 20 January 2026  
**For:** UKOMBOZI Table Banking System  
**Support:** See full documentation in `BACKEND_INTEGRATION_COMPLETE.md`
