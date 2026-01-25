-- ============================================
-- FIX: Schema Patch & Profile Upsert
-- ============================================

DO $$
BEGIN
    -- 1. Ensure Columns Exist (Patching old schema)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'email'
    ) THEN
        ALTER TABLE profiles ADD COLUMN email TEXT;
        RAISE NOTICE '✅ Added missing column: email';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'phone'
    ) THEN
        ALTER TABLE profiles ADD COLUMN phone TEXT;
        RAISE NOTICE '✅ Added missing column: phone';
    END IF;

    -- 2. Upsert the Profile (Retry)
    INSERT INTO public.profiles (id, full_name, role, email, phone)
    SELECT 
        id, 
        'Andrew Sigei' as full_name, 
        'director' as role,
        email, 
        '0710310004' as phone -- Using provided phone number
    FROM auth.users 
    WHERE email = 'andrewsigei684@gmail.com'
    ON CONFLICT (id) DO UPDATE SET
        role = 'director',
        full_name = 'Andrew Sigei',
        email = EXCLUDED.email, -- Ensure email is synced
        phone = EXCLUDED.phone;

    RAISE NOTICE '✅ Profile successfully created/updated for Andrew Sigei';

END $$;
