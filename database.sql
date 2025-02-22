CREATE DATABASE IF NOT EXISTS auth_db;
USE auth_db;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    reset_token VARCHAR(255),
    reset_token_expires DATETIME,
    deleted_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_reset_token (reset_token),
    INDEX idx_deleted_at (deleted_at),
    INDEX idx_email_deleted (email, deleted_at)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token),
    INDEX idx_user_token (user_id, token)
);

CREATE TABLE IF NOT EXISTS invitations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    unique_code VARCHAR(36) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    image_url VARCHAR(255),
    wedding_date DATETIME NOT NULL,
    rsvp_link VARCHAR(255),
    qr_code_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_unique_code (unique_code)
);

CREATE TABLE IF NOT EXISTS rsvp_responses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invitation_id INT NOT NULL,
    guest_name VARCHAR(255) NOT NULL,
    guest_email VARCHAR(255) NOT NULL,
    attending BOOLEAN NOT NULL,
    number_of_guests INT NOT NULL DEFAULT 1,
    dietary_requirements TEXT,
    message TEXT,
    confirmation_token VARCHAR(255),
    confirmation_token_expires DATETIME,
    confirmed_at DATETIME,
    deleted_at DATETIME DEFAULT NULL,
    response_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE,
    INDEX idx_invitation_id (invitation_id),
    INDEX idx_guest_email (guest_email),
    INDEX idx_confirmation_token (confirmation_token),
    INDEX idx_deleted_at (deleted_at),
    INDEX idx_invitation_deleted (invitation_id, deleted_at),
    INDEX idx_guest_email_deleted (guest_email, deleted_at),
    INDEX idx_attending_deleted (attending, deleted_at),
    INDEX idx_confirmed_deleted (confirmed_at, deleted_at),
    UNIQUE KEY unique_guest_invitation (guest_email, invitation_id, deleted_at)
);

CREATE TABLE IF NOT EXISTS email_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rsvp_response_id INT NOT NULL,
    reminder_enabled BOOLEAN DEFAULT TRUE,
    one_month_reminder BOOLEAN DEFAULT TRUE,
    one_week_reminder BOOLEAN DEFAULT TRUE,
    one_day_reminder BOOLEAN DEFAULT TRUE,
    last_reminder_sent DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (rsvp_response_id) REFERENCES rsvp_responses(id) ON DELETE CASCADE,
    INDEX idx_rsvp_response (rsvp_response_id)
);

CREATE TABLE IF NOT EXISTS email_reminders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invitation_id INT NOT NULL,
    reminder_type ENUM('one_month', 'one_week', 'one_day') NOT NULL,
    scheduled_date DATETIME NOT NULL,
    sent_date DATETIME,
    status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE,
    INDEX idx_invitation_status (invitation_id, status),
    INDEX idx_scheduled_date (scheduled_date)
);

CREATE TABLE IF NOT EXISTS rsvp_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rsvp_id INT NOT NULL,
    guest_name VARCHAR(255) NOT NULL,
    attending BOOLEAN NOT NULL,
    number_of_guests INT NOT NULL DEFAULT 1,
    dietary_requirements TEXT,
    message TEXT,
    change_type ENUM('CREATE', 'UPDATE', 'DELETE') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rsvp_id) REFERENCES rsvp_responses(id) ON DELETE CASCADE,
    INDEX idx_rsvp_id (rsvp_id),
    INDEX idx_created_at (created_at)
); 