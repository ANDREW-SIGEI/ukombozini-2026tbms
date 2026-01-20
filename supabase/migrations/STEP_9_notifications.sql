-- ============================================
-- STEP 9: NOTIFICATIONS & SMS LOGS
-- ============================================

-- Create SMS Logs table
CREATE TABLE IF NOT EXISTS sms_logs (
    id BIGSERIAL PRIMARY KEY,
    recipient_phone TEXT NOT NULL,
    recipient_name TEXT,
    message TEXT NOT NULL,
    type TEXT CHECK (type IN ('REGISTRATION', 'MEETING', 'LOAN', 'OTHER')),
    status TEXT DEFAULT 'SENT', -- In real app: 'QUEUED', 'SENT', 'FAILED'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- Allow everyone to view logs (for transparency/demo)
CREATE POLICY "Everyone can view sms logs" ON sms_logs FOR SELECT USING (true);
CREATE POLICY "Server can insert sms logs" ON sms_logs FOR INSERT WITH CHECK (true);

-- Success Message
DO $$
BEGIN
    RAISE NOTICE '✅ SMS Logs table created successfully';
END $$;
