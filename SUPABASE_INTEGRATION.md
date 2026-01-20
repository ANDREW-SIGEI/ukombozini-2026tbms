# 🚀 SUPABASE INTEGRATION GUIDE

## 📋 STEP-BY-STEP SETUP

### STEP 1: Create Supabase Project

1. Go to https://supabase.com
2. Sign up / Login
3. Click "New Project"
4. Fill in:
   - **Name**: ukombozi-tbms
   - **Database Password**: [Create a strong password - SAVE IT!]
   - **Region**: Choose closest to Kenya (e.g., Singapore or Frankfurt)
5. Click "Create new project"
6. ⏳ Wait 2-3 minutes for setup

### STEP 2: Get Your Credentials

Once project is ready:

1. Go to **Project Settings** (gear icon) → **API**
2. Copy these values:

```
Project URL:     https://[your-project-ref].supabase.co
anon/public key: eyJhbGc... [long token]
service_role key: eyJhbGc... [long token] 
```

⚠️ **NEVER commit service_role key to git!**

---

## 🗄️ STEP 3: Create Database Schema

1. In Supabase Dashboard, go to **SQL Editor**
2. Click "New Query"
3. Paste the SQL below:

### Groups Table
```sql
-- 1. GROUPS TABLE
CREATE TABLE groups (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    meeting_day TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read groups (for now - refine later)
CREATE POLICY "Groups are viewable by everyone" ON groups
    FOR SELECT USING (true);

-- Policy: Only authenticated users can insert
CREATE POLICY "Authenticated users can create groups" ON groups
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

### Members Table (WITH OPENING BALANCE RULES)
```sql
-- 2. MEMBERS TABLE
CREATE TABLE members (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    group_id BIGINT NOT NULL REFERENCES groups(id),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    
    -- Registration Date (CRITICAL for BF logic)
    registration_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Opening Balances (Set ONCE at registration)
    opening_balance_savings NUMERIC(15, 2) DEFAULT 0,
    opening_balance_ltl NUMERIC(15, 2) DEFAULT 0,
    opening_balance_stl NUMERIC(15, 2) DEFAULT 0,
    
    -- Audit Trail for Opening Balances
    opening_balance_set_by BIGINT,
    opening_balance_set_at TIMESTAMP WITH TIME ZONE,
    opening_balance_reason TEXT,
    opening_balance_locked BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Members are viewable by everyone" ON members
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create members" ON members
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

### Meeting Sessions Table
```sql
-- 3. MEETING SESSIONS
CREATE TABLE meeting_sessions (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES groups(id),
    officer_id BIGINT,
    date DATE NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ACTIVE', 'PENDING_APPROVAL', 'POSTED', 'REVERSED')),
    reversal_metadata JSONB,
    totals JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE meeting_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sessions are viewable by everyone" ON meeting_sessions
    FOR SELECT USING (true);
```

### Transactions Table
```sql
-- 4. TRANSACTIONS
CREATE TABLE transactions (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
    member_id BIGINT NOT NULL REFERENCES members(id),
    member_name TEXT,
    
    -- Transaction Fields
    attended BOOLEAN DEFAULT TRUE,
    savings_amount NUMERIC(15, 2) DEFAULT 0,
    stl_repayment NUMERIC(15, 2) DEFAULT 0,
    ltl_repayment NUMERIC(15, 2) DEFAULT 0,
    loan_interest NUMERIC(15, 2) DEFAULT 0,
    welfare NUMERIC(15, 2) DEFAULT 0,
    fines NUMERIC(15, 2) DEFAULT 0,
    total_paid NUMERIC(15, 2) DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Transactions are viewable by everyone" ON transactions
    FOR SELECT USING (true);
```

### Seed Data
```sql
-- SEED DATA
INSERT INTO groups (name, location, meeting_day) VALUES
    ('Victory Women Group', 'Kibera Zone A', 'Monday'),
    ('Ukombozi Group A', 'Mathare North', 'Tuesday'),
    ('Ukombozi Group B', 'Kawangware', 'Wednesday');

-- Get group IDs for members
-- Replace the group IDs below with actual IDs from your groups table
INSERT INTO members (
    name, phone, group_id,
    opening_balance_savings, opening_balance_ltl, opening_balance_stl,
    opening_balance_set_by, opening_balance_set_at, opening_balance_reason, opening_balance_locked
) VALUES
    ('Alice Wanjiku', '0712345678', 1, 15000, 10000, 2000, 1, NOW(), 'Initial registration', TRUE),
    ('Beatrice Atieno', '0723456789', 1, 25000, 5000, 0, 1, NOW(), 'Initial registration', TRUE),
    ('Catherine Njemeri', '0734567890', 1, 8000, 20000, 5000, 1, NOW(), 'Initial registration', TRUE),
    ('David Kamau', '0745678901', 2, 0, 0, 0, 1, NOW(), 'New member - zero opening balance', TRUE);
```

4. Click **RUN** to execute the SQL
5. ✅ Tables created!

---

## 📦 STEP 4: Install Supabase Client

```bash
cd backend
npm install @supabase/supabase-js dotenv
```

---

## 🔐 STEP 5: Create Environment File

Create `backend/.env`:

```env
# Supabase Configuration
SUPABASE_URL=https://[your-project-ref].supabase.co
SUPABASE_ANON_KEY=eyJhbGc...your-anon-key
SUPABASE_SERVICE_KEY=eyJhbGc...your-service-role-key

# Server
PORT=5000
NODE_ENV=development
```

⚠️ Add to `backend/.gitignore`:
```
.env
.env.local
.env.production
```

---

## 📝 STEP 6: Update Backend Code

I'll create the updated files for you in the next step.

---

## ✅ BENEFITS OF SUPABASE

| Feature | SQLite | Supabase |
|---------|--------|----------|
| **Database** | Local file | PostgreSQL (cloud) |
| **Scalability** | Single user | Unlimited users |
| **Authentication** | Manual | Built-in JWT |
| **Real-time** | No | Yes (WebSocket) |
| **Backups** | Manual | Automatic |
| **Security** | File-based | Row-Level Security |
| **Cost** | Free | Free tier (500MB) |

---

## 🎯 NEXT STEPS

1. ✅ Create Supabase project
2. ✅ Run SQL to create tables
3. ✅ Install dependencies
4. ✅ Create .env file
5. ⏳ Update backend code (next)
6. ⏳ Test connection
7. ⏳ Update frontend to use Supabase auth

---

**Ready to proceed?** Let me know when you've:
1. Created your Supabase project
2. Copied your credentials
3. Run the SQL schema

Then I'll update the backend code! 🚀
