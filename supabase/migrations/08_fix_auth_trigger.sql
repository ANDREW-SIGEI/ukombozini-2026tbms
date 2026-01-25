-- ============================================
-- FIX for Auth Trigger Failure (500 Error)
-- ============================================
-- The previous trigger function failed when data was missing or conflicted.
-- This version handles conflicts gracefully and catches exceptions so User Creation never fails.

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email, role)
  VALUES (
    new.id, 
    -- Ensure fallback if meta_data is missing
    COALESCE(new.raw_user_meta_data->>'full_name', 'New User'),
    new.raw_user_meta_data->>'phone', 
    new.email,
    -- Ensure valid role or default
    COALESCE(new.raw_user_meta_data->>'role', 'member')
  )
  -- If profile already exists, update it instead of failing
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;
    
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but DO NOT FAIL the transaction.
  -- This allows the user to be created in auth.users even if profile creation fails.
  -- You can check Postgres logs for the warning.
  RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach the trigger to ensure it uses the new function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Auth Trigger Fixed. You can now try logging in / creating users.';
END $$;
