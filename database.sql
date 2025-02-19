CREATE DATABASE IF NOT EXISTS auth_db;
USE auth_db;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    reset_token VARCHAR(255),
    reset_token_expires DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_reset_token (reset_token)
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
    response_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE,
    INDEX idx_invitation_id (invitation_id),
    INDEX idx_guest_email (guest_email),
    UNIQUE KEY unique_guest_invitation (guest_email, invitation_id)
); 