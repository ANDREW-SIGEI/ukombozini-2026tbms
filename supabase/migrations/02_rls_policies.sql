-- ============================================
-- UKOMBOZI TBMS - ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE officer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE repayment_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE reversals ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if user is director or admin
CREATE OR REPLACE FUNCTION is_director_or_admin()
RETURNS BOOLEAN AS $$
    SELECT role IN ('director', 'admin') FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Get groups assigned to current field officer
CREATE OR REPLACE FUNCTION get_officer_groups()
RETURNS SETOF BIGINT AS $$
    SELECT group_id FROM officer_groups WHERE officer_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================
-- PROFILES
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Directors admins view all" ON profiles;
CREATE POLICY "Directors admins view all" ON profiles FOR SELECT USING (is_director_or_admin());

DROP POLICY IF EXISTS "Admins update profiles" ON profiles;
CREATE POLICY "Admins update profiles" ON profiles FOR UPDATE USING (is_director_or_admin());

-- ============================================
-- GROUPS
-- ============================================
DROP POLICY IF EXISTS "Universal read groups" ON groups;
CREATE POLICY "Universal read groups" ON groups FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admins manage groups" ON groups;
CREATE POLICY "Admins manage groups" ON groups FOR ALL USING (is_director_or_admin());

-- ============================================
-- OFFICER GROUPS
-- ============================================
DROP POLICY IF EXISTS "Admins manage assignments" ON officer_groups;
CREATE POLICY "Admins manage assignments" ON officer_groups FOR ALL USING (is_director_or_admin());

DROP POLICY IF EXISTS "Officers view own assignments" ON officer_groups;
CREATE POLICY "Officers view own assignments" ON officer_groups FOR SELECT USING (officer_id = auth.uid());

-- ============================================
-- MEMBERS
-- ============================================
DROP POLICY IF EXISTS "Admins view all members" ON members;
CREATE POLICY "Admins view all members" ON members FOR SELECT USING (is_director_or_admin());

DROP POLICY IF EXISTS "Officers view assigned members" ON members;
CREATE POLICY "Officers view assigned members" ON members FOR SELECT USING (group_id IN (SELECT get_officer_groups()));

DROP POLICY IF EXISTS "Officers create members" ON members;
CREATE POLICY "Officers create members" ON members FOR INSERT WITH CHECK (group_id IN (SELECT get_officer_groups()));

DROP POLICY IF EXISTS "Admins update members" ON members;
CREATE POLICY "Admins update members" ON members FOR UPDATE USING (is_director_or_admin());

-- ============================================
-- MEETINGS
-- ============================================
DROP POLICY IF EXISTS "Admins all meetings" ON meeting_sessions;
CREATE POLICY "Admins all meetings" ON meeting_sessions FOR ALL USING (is_director_or_admin());

DROP POLICY IF EXISTS "Officers assigned meetings" ON meeting_sessions;
CREATE POLICY "Officers assigned meetings" ON meeting_sessions FOR SELECT USING (group_id IN (SELECT get_officer_groups()));

DROP POLICY IF EXISTS "Officers create meetings" ON meeting_sessions;
CREATE POLICY "Officers create meetings" ON meeting_sessions FOR INSERT WITH CHECK (group_id IN (SELECT get_officer_groups()));

DROP POLICY IF EXISTS "Officers update active meetings" ON meeting_sessions;
CREATE POLICY "Officers update active meetings" ON meeting_sessions FOR UPDATE USING (group_id IN (SELECT get_officer_groups()) AND status = 'ACTIVE');

-- Attendance
DROP POLICY IF EXISTS "Admins all attendance" ON meeting_attendance;
CREATE POLICY "Admins all attendance" ON meeting_attendance FOR ALL USING (is_director_or_admin());

DROP POLICY IF EXISTS "Officers manage attendance" ON meeting_attendance;
CREATE POLICY "Officers manage attendance" ON meeting_attendance FOR ALL USING (session_id IN (SELECT id FROM meeting_sessions WHERE group_id IN (SELECT get_officer_groups())));

-- ============================================
-- LOANS
-- ============================================
DROP POLICY IF EXISTS "Admins all loans" ON loans;
CREATE POLICY "Admins all loans" ON loans FOR ALL USING (is_director_or_admin());

DROP POLICY IF EXISTS "Officers loans read" ON loans;
CREATE POLICY "Officers loans read" ON loans FOR SELECT USING (group_id IN (SELECT get_officer_groups()));

DROP POLICY IF EXISTS "Officers create loans" ON loans;
CREATE POLICY "Officers create loans" ON loans FOR INSERT WITH CHECK (group_id IN (SELECT get_officer_groups()));

-- ============================================
-- TRANSACTIONS
-- ============================================
DROP POLICY IF EXISTS "Admins all transactions" ON transactions;
CREATE POLICY "Admins all transactions" ON transactions FOR SELECT USING (is_director_or_admin());

DROP POLICY IF EXISTS "Officers view transactions" ON transactions;
CREATE POLICY "Officers view transactions" ON transactions FOR SELECT USING (group_id IN (SELECT get_officer_groups()));

DROP POLICY IF EXISTS "Officers create transactions" ON transactions;
CREATE POLICY "Officers create transactions" ON transactions FOR INSERT WITH CHECK (group_id IN (SELECT get_officer_groups()));

-- ============================================
-- SYSTEM SETTINGS
-- ============================================
DROP POLICY IF EXISTS "Everyone read settings" ON system_settings;
CREATE POLICY "Everyone read settings" ON system_settings FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admins update settings" ON system_settings;
CREATE POLICY "Admins update settings" ON system_settings FOR ALL USING (is_director_or_admin());

DO $$
BEGIN
    RAISE NOTICE '🔒 RLS Policies Applied Successfully';
END $$;
