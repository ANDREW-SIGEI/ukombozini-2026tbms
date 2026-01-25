-- ============================================
-- UKOMBOZI TBMS - NOTIFICATION SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT CHECK (type IN ('SMS', 'EMAIL')) NOT NULL,
    recipient TEXT NOT NULL,
    title TEXT, 
    body TEXT NOT NULL,
    status TEXT CHECK (status IN ('SENT', 'FAILED', 'QUEUED')) DEFAULT 'QUEUED',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view all notifications" ON notifications;
CREATE POLICY "Admins view all notifications" ON notifications FOR SELECT USING (is_director_or_admin());

DROP POLICY IF EXISTS "System insert notifications" ON notifications;
CREATE POLICY "System insert notifications" ON notifications FOR INSERT WITH CHECK (TRUE);

DO $$
BEGIN
    RAISE NOTICE '✅ Notifications Module Ready';
END $$;
