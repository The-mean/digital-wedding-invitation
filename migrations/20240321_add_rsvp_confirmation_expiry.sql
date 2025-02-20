-- Add confirmation expiration timestamp
ALTER TABLE rsvp_responses
ADD COLUMN confirmation_expires_at DATETIME NOT NULL AFTER confirmation_token,
ADD INDEX idx_confirmation_expiry (confirmation_token, confirmation_expires_at, confirmed_at);

-- Update existing records to set expiration to 24 hours from creation
UPDATE rsvp_responses 
SET confirmation_expires_at = DATE_ADD(created_at, INTERVAL 24 HOUR)
WHERE confirmation_token IS NOT NULL AND confirmation_expires_at IS NULL; 