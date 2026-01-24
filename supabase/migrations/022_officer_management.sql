-- ============================================
-- UKOMBOZI TBMS - OFFICER MANAGEMENT (Supabase)
-- ============================================

-- Ensure profiles table has the right structure
-- This extends the existing profiles if already created
ALTER TABLE IF EXISTS profiles 
ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- Metadata for profiles
COMMENT ON COLUMN profiles.email IS 'Officer official email for authentication and messaging';
COMMENT ON COLUMN profiles.status IS 'Active: access granted | Inactive: immediate system lockout';

-- Trigger to handle email sync from auth.users (if not already handled)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email, role)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'phone', 
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'field_officer')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Policy: Admins can update any profile (status toggle)
-- Policy: Users can view their own profile

-- Success Message
DO $$
BEGIN
    RAISE NOTICE '🏢 Officer Management Schema Updated';
    RAISE NOTICE '✅ Profiles table extended for production usage';
END $$;
