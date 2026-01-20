-- ============================================
-- UKOMBOZI TBMS - ROW LEVEL SECURITY POLICIES
-- ============================================
-- Purpose: Enforce access control for multi-officer system
-- Security Model: Field officers see only assigned groups
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE officer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reversals ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

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
-- PROFILES POLICIES
-- ============================================

-- Everyone can read their own profile
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (id = auth.uid());

-- Directors and admins can view all profiles
CREATE POLICY "Directors and admins can view all profiles"
    ON profiles FOR SELECT
    USING (is_director_or_admin());

-- Only admins can create profiles
CREATE POLICY "Admins can create profiles"
    ON profiles FOR INSERT
    WITH CHECK (is_director_or_admin());

-- Only admins can update profiles
CREATE POLICY "Admins can update profiles"
    ON profiles FOR UPDATE
    USING (is_director_or_admin());

-- ============================================
-- GROUPS POLICIES
-- ============================================

-- Directors and admins can see all groups
CREATE POLICY "Directors and admins can view all groups"
    ON groups FOR SELECT
    USING (is_director_or_admin());

-- Field officers can only see assigned groups
CREATE POLICY "Field officers can view assigned groups"
    ON groups FOR SELECT
    USING (id IN (SELECT get_officer_groups()));

-- Only admins can manage groups
CREATE POLICY "Admins can manage groups"
    ON groups FOR ALL
    USING (is_director_or_admin());

-- ============================================
-- OFFICER_GROUPS POLICIES
-- ============================================

-- Directors and admins can view all assignments
CREATE POLICY "Directors and admins can view all assignments"
    ON officer_groups FOR SELECT
    USING (is_director_or_admin());

-- Field officers can view their own assignments
CREATE POLICY "Officers can view own assignments"
    ON officer_groups FOR SELECT
    USING (officer_id = auth.uid());

-- Only admins can manage assignments
CREATE POLICY "Admins can manage assignments"
    ON officer_groups FOR ALL
    USING (is_director_or_admin());

-- ============================================
-- MEMBERS POLICIES
-- ============================================

-- Directors and admins can view all members
CREATE POLICY "Directors and admins can view all members"
    ON members FOR SELECT
    USING (is_director_or_admin());

-- Field officers can only view members in assigned groups
CREATE POLICY "Field officers can view members in assigned groups"
    ON members FOR SELECT
    USING (group_id IN (SELECT get_officer_groups()));

-- Field officers can create members in assigned groups
CREATE POLICY "Field officers can create members in assigned groups"
    ON members FOR INSERT
    WITH CHECK (group_id IN (SELECT get_officer_groups()));

-- Only directors and admins can update members
CREATE POLICY "Directors and admins can update members"
    ON members FOR UPDATE
    USING (is_director_or_admin());

-- ============================================
-- MEETINGS POLICIES
-- ============================================

-- Directors and admins can view all meetings
CREATE POLICY "Directors and admins can view all meetings"
    ON meetings FOR SELECT
    USING (is_director_or_admin());

-- Field officers can view meetings in assigned groups
CREATE POLICY "Field officers can view meetings in assigned groups"
    ON meetings FOR SELECT
    USING (group_id IN (SELECT get_officer_groups()));

-- Field officers can create meetings in assigned groups
CREATE POLICY "Field officers can create meetings in assigned groups"
    ON meetings FOR INSERT
    WITH CHECK (
        group_id IN (SELECT get_officer_groups()) 
        AND created_by = auth.uid()
    );

-- Field officers can update their own draft meetings
CREATE POLICY "Field officers can update own draft meetings"
    ON meetings FOR UPDATE
    USING (
        group_id IN (SELECT get_officer_groups())
        AND created_by = auth.uid()
        AND status = 'draft'
    );

-- ============================================
-- LOANS POLICIES
-- ============================================

-- Directors and admins can view all loans
CREATE POLICY "Directors and admins can view all loans"
    ON loans FOR SELECT
    USING (is_director_or_admin());

-- Field officers can view loans in assigned groups
CREATE POLICY "Field officers can view loans in assigned groups"
    ON loans FOR SELECT
    USING (group_id IN (SELECT get_officer_groups()));

-- Field officers can create loans in assigned groups
CREATE POLICY "Field officers can create loans in assigned groups"
    ON loans FOR INSERT
    WITH CHECK (
        group_id IN (SELECT get_officer_groups())
        AND issued_by = auth.uid()
    );

-- Only directors and admins can update loan status
CREATE POLICY "Directors and admins can update loans"
    ON loans FOR UPDATE
    USING (is_director_or_admin());

-- ============================================
-- TRANSACTIONS POLICIES (CRITICAL)
-- ============================================

-- Directors and admins can view all transactions
CREATE POLICY "Directors and admins can view all transactions"
    ON transactions FOR SELECT
    USING (is_director_or_admin());

-- Field officers can view transactions in assigned groups
CREATE POLICY "Field officers can view transactions in assigned groups"
    ON transactions FOR SELECT
    USING (group_id IN (SELECT get_officer_groups()));

-- Field officers can INSERT transactions in assigned groups
CREATE POLICY "Field officers can create transactions in assigned groups"
    ON transactions FOR INSERT
    WITH CHECK (
        group_id IN (SELECT get_officer_groups())
        AND posted_by = auth.uid()
        AND reversed = FALSE
    );

-- ❌ NO ONE can UPDATE transactions (immutable)
-- Only reversals allowed (handled separately)

-- ❌ NO ONE can DELETE transactions (audit protection)

-- ============================================
-- REVERSALS POLICIES
-- ============================================

-- Directors and admins can view all reversals
CREATE POLICY "Directors and admins can view all reversals"
    ON reversals FOR SELECT
    USING (is_director_or_admin());

-- Only directors can create reversals
CREATE POLICY "Directors can create reversals"
    ON reversals FOR INSERT
    WITH CHECK (
        get_user_role() = 'director'
        AND approved_by = auth.uid()
    );

-- ============================================
-- SYSTEM_SETTINGS POLICIES
-- ============================================

-- Everyone can read system settings
CREATE POLICY "Everyone can read system settings"
    ON system_settings FOR SELECT
    USING (TRUE);

-- Only admins can update system settings
CREATE POLICY "Admins can update system settings"
    ON system_settings FOR ALL
    USING (is_director_or_admin());

-- ============================================
-- AUDIT_LOG POLICIES
-- ============================================

-- Directors and admins can view all audit logs
CREATE POLICY "Directors and admins can view audit logs"
    ON audit_log FOR SELECT
    USING (is_director_or_admin());

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
    ON audit_log FOR INSERT
    WITH CHECK (TRUE);

-- ❌ NO ONE can update or delete audit logs

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '🔒 RLS Policies Applied Successfully';
    RAISE NOTICE '✅ Field officers: Can only access assigned groups';
    RAISE NOTICE '✅ Transactions: INSERT only (no UPDATE/DELETE)';
    RAISE NOTICE '✅ Reversals: Directors only';
    RAISE NOTICE '✅ Audit trail: Protected';
END $$;
