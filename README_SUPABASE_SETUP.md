# Supabase Setup Instructions

## ⚠️ IMPORTANT: Your Supabase credentials are not configured!

The application currently uses placeholder values and cannot connect to a database.

### Quick Setup Steps:

1. **Create Supabase Account**
   - Go to [https://supabase.com](https://supabase.com)
   - Sign up for free account
   - Create a new project

2. **Get Your Credentials**
   - In your Supabase dashboard → Settings → API
   - Copy your **Project URL** (e.g., `https://abcdefg.supabase.co`)
   - Copy your **anon/public key**

3. **Configure Frontend**
   - Create a file: `frontend/.env`
   - Add these lines (replace with YOUR values):
   
   ```env
   REACT_APP_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

4. **Deploy Database Schema**
   - In Supabase Dashboard → SQL Editor
   - Run migrations in order: `001_core_schema.sql` through `013_seed_test_data.sql`
   - See `SUPABASE_DEPLOYMENT_GUIDE.md` for detailed instructions

5. **Restart Dev Server**
   ```bash
   cd frontend
   npm start
   ```

### Current Status:
- ❌ Supabase URL: `https://your-project.supabase.co` (placeholder)
- ❌ Anon Key: `your-anon-key` (placeholder)
- ✅ Code: Ready and waiting for database connection
- ✅ Migrations: Organized and ready (001-013)

### Need Help?
- See `SUPABASE_DEPLOYMENT_GUIDE.md` for full deployment instructions
- Migrations are in `supabase/migrations/` folder
