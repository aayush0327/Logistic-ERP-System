-- Notification Service Database Schema
-- Database is already created by init script

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================
-- NOTIFICATIONS TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal',
    entity_type VARCHAR(50),
    entity_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    data JSONB,
    action_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- Create indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user ON notifications(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entity_type, entity_id);

-- Add comments
COMMENT ON TABLE notifications IS 'Stores all notifications for users';
COMMENT ON COLUMN notifications.type IS 'Notification type: order_event, trip_event, system, alert';
COMMENT ON COLUMN notifications.category IS 'Notification category: created, approved, rejected, assigned, etc.';
COMMENT ON COLUMN notifications.priority IS 'Priority level: low, normal, high, urgent';
COMMENT ON COLUMN notifications.status IS 'Delivery status: pending, sent, delivered, failed';

-- ============================================================================
-- USER NOTIFICATION PREFERENCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL UNIQUE,

    -- Email preferences
    email_enabled BOOLEAN DEFAULT true,
    email_order_events BOOLEAN DEFAULT true,
    email_trip_events BOOLEAN DEFAULT true,
    email_system_notifications BOOLEAN DEFAULT true,
    email_alerts BOOLEAN DEFAULT true,
    email_daily_summary BOOLEAN DEFAULT false,

    -- Push notifications (in-app)
    push_enabled BOOLEAN DEFAULT true,
    push_order_events BOOLEAN DEFAULT true,
    push_trip_events BOOLEAN DEFAULT true,
    push_system_notifications BOOLEAN DEFAULT true,
    push_alerts BOOLEAN DEFAULT true,

    -- Quiet hours (no notifications)
    quiet_hours_enabled BOOLEAN DEFAULT false,
    quiet_hours_start TIME DEFAULT '22:00',
    quiet_hours_end TIME DEFAULT '08:00',
    quiet_hours_timezone VARCHAR(50) DEFAULT 'UTC',

    -- Daily summary preferences
    daily_summary_enabled BOOLEAN DEFAULT false,
    daily_summary_time TIME DEFAULT '09:00',
    daily_summary_timezone VARCHAR(50) DEFAULT 'UTC',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for user notification preferences
CREATE INDEX IF NOT EXISTS idx_preferences_tenant_user ON user_notification_preferences(tenant_id, user_id);

-- Add comments
COMMENT ON TABLE user_notification_preferences IS 'Stores user notification preferences';
COMMENT ON COLUMN user_notification_preferences.quiet_hours_enabled IS 'Enable/disable quiet hours for notifications';

-- ============================================================================
-- SCHEDULED NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS scheduled_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    schedule_type VARCHAR(20) NOT NULL,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    title VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(20) DEFAULT 'pending',
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    entity_type VARCHAR(50),
    entity_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for scheduled notifications
CREATE INDEX IF NOT EXISTS idx_scheduled_tenant_user ON scheduled_notifications(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_status ON scheduled_notifications(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_for ON scheduled_notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_type ON scheduled_notifications(notification_type);

-- Add comments
COMMENT ON TABLE scheduled_notifications IS 'Stores scheduled notifications for delivery reminders and daily summaries';
COMMENT ON COLUMN scheduled_notifications.schedule_type IS 'Schedule type: once, daily, weekly';

-- ============================================================================
-- NOTIFICATION DELIVERY LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_delivery_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    delivery_method VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    response_code INTEGER,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for delivery log
CREATE INDEX IF NOT EXISTS idx_delivery_log_notification ON notification_delivery_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_delivery_log_user ON notification_delivery_log(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_log_status ON notification_delivery_log(status);
CREATE INDEX IF NOT EXISTS idx_delivery_log_created ON notification_delivery_log(created_at DESC);

-- Add comments
COMMENT ON TABLE notification_delivery_log IS 'Logs notification delivery attempts for debugging and analytics';
COMMENT ON COLUMN notification_delivery_log.delivery_method IS 'Delivery method: sse, email, sms, push';

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_delivery_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notifications
CREATE POLICY notifications_tenant_policy
    ON notifications
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::VARCHAR(255))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::VARCHAR(255));

-- Create RLS policies for user notification preferences
CREATE POLICY preferences_tenant_policy
    ON user_notification_preferences
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::VARCHAR(255))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::VARCHAR(255));

-- Create RLS policies for scheduled notifications
CREATE POLICY scheduled_tenant_policy
    ON scheduled_notifications
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::VARCHAR(255))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::VARCHAR(255));

-- Create RLS policies for delivery log
CREATE POLICY delivery_log_tenant_policy
    ON notification_delivery_log
    FOR ALL
    USING (notification_id IN (
        SELECT id FROM notifications WHERE tenant_id = current_setting('app.current_tenant_id')::VARCHAR(255)
    ));

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create updated_at trigger for notifications
DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Create updated_at trigger for user_notification_preferences
DROP TRIGGER IF EXISTS update_preferences_updated_at ON user_notification_preferences;
CREATE TRIGGER update_preferences_updated_at
    BEFORE UPDATE ON user_notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Create updated_at trigger for scheduled_notifications
DROP TRIGGER IF EXISTS update_scheduled_updated_at ON scheduled_notifications;
CREATE TRIGGER update_scheduled_updated_at
    BEFORE UPDATE ON scheduled_notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

COMMIT;
