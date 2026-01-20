-- =====================================================
-- SMS NOTIFICATIONS & ALERTS SYSTEM
-- Automatic member transaction confirmations
-- "Every transaction confirmed instantly"
-- =====================================================

-- Drop tables if they exist
DROP TABLE IF EXISTS sms_retry_queue CASCADE;
DROP TABLE IF EXISTS sms_notifications CASCADE;
DROP TABLE IF EXISTS sms_templates CASCADE;

-- SMS Templates (Admin-controlled message templates)
CREATE TABLE IF NOT EXISTS sms_templates (
    id SERIAL PRIMARY KEY,
    template_code VARCHAR(50) UNIQUE NOT NULL,
    template_name VARCHAR(100) NOT NULL,
    message_template TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id),
    
    -- Constraints
    CONSTRAINT valid_template_code CHECK (template_code ~ '^[A-Z_]+$')
);

-- SMS Notifications Log (Immutable audit trail)
CREATE TABLE IF NOT EXISTS sms_notifications (
    id SERIAL PRIMARY KEY,
    
    -- Recipient
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    
    -- Message Details
    template_code VARCHAR(50) NOT NULL,
    message_type VARCHAR(50) NOT NULL CHECK (message_type IN (
        'CONTRIBUTION',
        'LOAN_REPAYMENT',
        'LOAN_DISBURSED',
        'LOAN_APPROVED',
        'LOAN_REJECTED',
        'ARREARS_ALERT',
        'STATEMENT',
        'MEETING_REMINDER',
        'DIVIDEND_POSTED'
    )),
    message_content TEXT NOT NULL,
    
    -- Transaction Reference
    reference_type VARCHAR(50),  -- 'CONTRIBUTION', 'LOAN', 'MEETING', etc.
    reference_id VARCHAR(100),   -- Transaction ID, Loan ID, Meeting Number
    meeting_id INTEGER REFERENCES meeting_sessions(id),
    
    -- Delivery Status
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING',
        'SENT',
        'DELIVERED',
        'FAILED',
        'CANCELLED'
    )),
    
    -- External SMS Gateway Response
    gateway_message_id VARCHAR(100),
    gateway_response JSONB,
    cost DECIMAL(10, 4),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    failed_at TIMESTAMP,
    
    -- Error Tracking
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- System Metadata
    triggered_by UUID REFERENCES profiles(id),
    source_system VARCHAR(50) DEFAULT 'TBMS_WEB',
    
    -- Member Preferences
    member_sms_enabled BOOLEAN DEFAULT TRUE
);

-- SMS Retry Queue (For failed messages)
CREATE TABLE IF NOT EXISTS sms_retry_queue (
    id SERIAL PRIMARY KEY,
    sms_notification_id INTEGER NOT NULL REFERENCES sms_notifications(id) ON DELETE CASCADE,
    retry_attempt INTEGER NOT NULL,
    scheduled_retry_at TIMESTAMP NOT NULL,
    retry_status VARCHAR(20) DEFAULT 'SCHEDULED',
    retried_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sms_member ON sms_notifications(member_id);
CREATE INDEX idx_sms_status ON sms_notifications(status);
CREATE INDEX idx_sms_type ON sms_notifications(message_type);
CREATE INDEX idx_sms_created_at ON sms_notifications(created_at DESC);
CREATE INDEX idx_sms_reference ON sms_notifications(reference_type, reference_id);
CREATE INDEX idx_sms_meeting ON sms_notifications(meeting_id);
CREATE INDEX idx_sms_gateway_id ON sms_notifications(gateway_message_id);

-- Insert Default SMS Templates
INSERT INTO sms_templates (template_code, template_name, message_template, variables) VALUES
(
    'CONTRIBUTION_RECEIVED',
    'Savings Contribution Received',
    'UKOMBOZI: KES {amount} savings received on {date}. Balance: KES {new_balance}. Meeting #{meeting_number} - {group_name}.',
    '["amount", "date", "new_balance", "meeting_number", "group_name"]'::jsonb
),
(
    'LOAN_REPAYMENT',
    'Loan Repayment Received',
    'UKOMBOZI: KES {amount} loan repayment received. Loan Balance: KES {remaining_balance}. Meeting #{meeting_number}. Thank you.',
    '["amount", "remaining_balance", "meeting_number"]'::jsonb
),
(
    'LOAN_DISBURSED',
    'Loan Disbursement Notification',
    'UKOMBOZI: Loan of KES {amount} disbursed. Installment: KES {installment} for {months} months. Total repayable: KES {total_repayable}. Thank you.',
    '["amount", "installment", "months", "total_repayable"]'::jsonb
),
(
    'LOAN_APPROVED',
    'Loan Application Approved',
    'UKOMBOZI: Your loan application for KES {amount} has been APPROVED. Visit your group meeting for disbursement. App #{application_number}.',
    '["amount", "application_number"]'::jsonb
),
(
    'LOAN_REJECTED',
    'Loan Application Rejected',
    'UKOMBOZI: Your loan application #{application_number} for KES {amount} was not approved. Contact your group admin for details.',
    '["amount", "application_number"]'::jsonb
),
(
    'ARREARS_ALERT',
    'Arrears Payment Alert',
    'UKOMBOZI: You have arrears of KES {arrears_amount}. Please clear in next meeting to avoid penalties. Contact: {officer_phone}.',
    '["arrears_amount", "officer_phone"]'::jsonb
),
(
    'STATEMENT_GENERATED',
    'Member Statement',
    'UKOMBOZI: Your statement for {period} is ready. Savings: KES {savings}, Loans: KES {loans}, Net: KES {net_position}. Thank you.',
    '["period", "savings", "loans", "net_position"]'::jsonb
),
(
    'MEETING_REMINDER',
    'Meeting Reminder',
    'UKOMBOZI: {group_name} meeting on {meeting_date} at {time}. Venue: {venue}. Expected contribution: KES {amount}. See you there!',
    '["group_name", "meeting_date", "time", "venue", "amount"]'::jsonb
),
(
    'DIVIDEND_POSTED',
    'Dividend Payment',
    'UKOMBOZI: Annual dividend of KES {amount} posted to your account. New balance: KES {new_balance}. Thank you for your membership.',
    '["amount", "new_balance"]'::jsonb
);

-- Function to queue SMS notification
CREATE OR REPLACE FUNCTION queue_sms_notification(
    p_member_id BIGINT,
    p_template_code VARCHAR,
    p_message_type VARCHAR,
    p_variables JSONB,
    p_reference_type VARCHAR DEFAULT NULL,
    p_reference_id VARCHAR DEFAULT NULL,
    p_meeting_id INTEGER DEFAULT NULL,
    p_triggered_by UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_template TEXT;
    v_final_message TEXT;
    v_member_phone VARCHAR;
    v_sms_enabled BOOLEAN;
    v_notification_id INTEGER;
    v_key TEXT;
    v_value TEXT;
BEGIN
    -- Get member phone and SMS preference
    SELECT phone, COALESCE(sms_notifications_enabled, TRUE)
    INTO v_member_phone, v_sms_enabled
    FROM members
    WHERE id = p_member_id;
    
    IF v_member_phone IS NULL THEN
        RAISE EXCEPTION 'Member phone number not found';
    END IF;
    
    -- Get template
    SELECT message_template INTO v_template
    FROM sms_templates
    WHERE template_code = p_template_code AND is_active = TRUE;
    
    IF v_template IS NULL THEN
        RAISE EXCEPTION 'SMS template % not found or inactive', p_template_code;
    END IF;
    
    -- Replace variables in template
    v_final_message := v_template;
    FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_variables)
    LOOP
        v_final_message := REPLACE(v_final_message, '{' || v_key || '}', v_value);
    END LOOP;
    
    -- Insert SMS notification
    INSERT INTO sms_notifications (
        member_id,
        phone,
        template_code,
        message_type,
        message_content,
        reference_type,
        reference_id,
        meeting_id,
        triggered_by,
        member_sms_enabled,
        status
    ) VALUES (
        p_member_id,
        v_member_phone,
        p_template_code,
        p_message_type,
        v_final_message,
        p_reference_type,
        p_reference_id,
        p_meeting_id,
        p_triggered_by,
        v_sms_enabled,
        CASE WHEN v_sms_enabled THEN 'PENDING' ELSE 'CANCELLED' END
    )
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark SMS as sent (called by external SMS service)
CREATE OR REPLACE FUNCTION mark_sms_sent(
    p_notification_id INTEGER,
    p_gateway_message_id VARCHAR,
    p_gateway_response JSONB DEFAULT NULL,
    p_cost DECIMAL DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE sms_notifications
    SET 
        status = 'SENT',
        sent_at = NOW(),
        gateway_message_id = p_gateway_message_id,
        gateway_response = p_gateway_response,
        cost = p_cost
    WHERE id = p_notification_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to mark SMS as delivered
CREATE OR REPLACE FUNCTION mark_sms_delivered(
    p_gateway_message_id VARCHAR
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE sms_notifications
    SET 
        status = 'DELIVERED',
        delivered_at = NOW()
    WHERE gateway_message_id = p_gateway_message_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to mark SMS as failed and schedule retry
CREATE OR REPLACE FUNCTION mark_sms_failed(
    p_notification_id INTEGER,
    p_error_message TEXT,
    p_should_retry BOOLEAN DEFAULT TRUE
)
RETURNS BOOLEAN AS $$
DECLARE
    v_retry_count INTEGER;
    v_next_retry TIMESTAMP;
BEGIN
    -- Update notification
    UPDATE sms_notifications
    SET 
        status = 'FAILED',
        failed_at = NOW(),
        error_message = p_error_message,
        retry_count = retry_count + 1
    WHERE id = p_notification_id
    RETURNING retry_count INTO v_retry_count;
    
    -- Schedule retry if enabled and retry count < 3
    IF p_should_retry AND v_retry_count < 3 THEN
        -- Exponential backoff: 5 min, 30 min, 2 hours
        v_next_retry := NOW() + INTERVAL '1 minute' * POWER(6, v_retry_count);
        
        INSERT INTO sms_retry_queue (
            sms_notification_id,
            retry_attempt,
            scheduled_retry_at
        ) VALUES (
            p_notification_id,
            v_retry_count,
            v_next_retry
        );
    END IF;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- View for SMS delivery report
CREATE OR REPLACE VIEW sms_delivery_report AS
SELECT 
    s.id,
    s.created_at,
    m.full_name as member_name,
    m.phone,
    s.message_type,
    s.status,
    s.template_code,
    s.reference_type,
    s.reference_id,
    s.sent_at,
    s.delivered_at,
    s.failed_at,
    s.error_message,
    s.retry_count,
    s.cost,
    p.full_name as triggered_by_name
FROM sms_notifications s
JOIN members m ON s.member_id = m.id
LEFT JOIN profiles p ON s.triggered_by = p.id
ORDER BY s.created_at DESC;

-- View for SMS statistics
CREATE OR REPLACE VIEW sms_statistics AS
SELECT 
    DATE(created_at) as date,
    message_type,
    status,
    COUNT(*) as count,
    SUM(cost) as total_cost,
    AVG(EXTRACT(EPOCH FROM (sent_at - created_at))) as avg_send_time_seconds
FROM sms_notifications
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), message_type, status
ORDER BY date DESC, message_type;

-- View for pending retries
CREATE OR REPLACE VIEW sms_pending_retries AS
SELECT 
    r.id as retry_id,
    r.sms_notification_id,
    s.member_id,
    m.full_name as member_name,
    s.phone,
    s.message_content,
    r.retry_attempt,
    r.scheduled_retry_at,
    s.error_message
FROM sms_retry_queue r
JOIN sms_notifications s ON r.sms_notification_id = s.id
JOIN members m ON s.member_id = m.id
WHERE r.retry_status = 'SCHEDULED'
AND r.scheduled_retry_at <= NOW()
ORDER BY r.scheduled_retry_at ASC;

-- Trigger to update timestamp
CREATE OR REPLACE FUNCTION update_sms_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_sms_template_timestamp ON sms_templates;
CREATE TRIGGER trigger_update_sms_template_timestamp
BEFORE UPDATE ON sms_templates
FOR EACH ROW
EXECUTE FUNCTION update_sms_template_timestamp();

-- Grant permissions
GRANT SELECT, INSERT ON sms_notifications TO authenticated;
GRANT SELECT ON sms_templates TO authenticated;
GRANT SELECT ON sms_delivery_report TO authenticated;
GRANT SELECT ON sms_statistics TO authenticated;
GRANT UPDATE ON sms_templates TO authenticated; -- Only for admin role

-- Add SMS preference to members table (if not exists)
ALTER TABLE members ADD COLUMN IF NOT EXISTS sms_notifications_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS last_sms_sent_at TIMESTAMP;

-- Comments
COMMENT ON TABLE sms_notifications IS 'Immutable log of all SMS notifications sent to members';
COMMENT ON TABLE sms_templates IS 'System message templates (admin-controlled)';
COMMENT ON FUNCTION queue_sms_notification IS 'Queue an SMS notification with variable substitution';
COMMENT ON FUNCTION mark_sms_sent IS 'Mark SMS as sent by external gateway';
COMMENT ON FUNCTION mark_sms_delivered IS 'Mark SMS as delivered (callback from gateway)';

-- =====================================================
-- MIGRATION NOTES:
-- This creates a complete SMS notification system
-- - Template-based messaging
-- - Automatic retry on failure
-- - Complete audit trail
-- - Gateway integration ready
-- - Admin-controlled templates
-- =====================================================
