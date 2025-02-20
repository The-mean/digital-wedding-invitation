-- Add composite indexes for frequently queried combinations
ALTER TABLE rsvp_responses
ADD INDEX idx_invitation_confirmed (invitation_id, confirmed_at, deleted_at),
ADD INDEX idx_response_date (response_date, deleted_at),
ADD INDEX idx_wedding_date_attending (invitation_id, attending, deleted_at),
ADD INDEX idx_confirmation_token_expires (confirmation_token_expires, deleted_at);

-- Add indexes for sorting and filtering
ALTER TABLE rsvp_responses
ADD INDEX idx_created_updated (created_at, updated_at, deleted_at);

-- Add indexes for the users table
ALTER TABLE users
ADD INDEX idx_created_updated_users (created_at, updated_at, deleted_at);

-- Add indexes for invitations table
ALTER TABLE invitations
ADD INDEX idx_wedding_date (wedding_date),
ADD INDEX idx_user_wedding_date (user_id, wedding_date);

-- Add indexes for email_preferences table
ALTER TABLE email_preferences
ADD INDEX idx_reminder_status (reminder_enabled, last_reminder_sent),
ADD INDEX idx_reminder_types (one_month_reminder, one_week_reminder, one_day_reminder); 