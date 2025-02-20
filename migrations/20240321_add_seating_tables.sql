-- Masa tablosu
CREATE TABLE IF NOT EXISTS tables (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invitation_id INT NOT NULL,
    table_number VARCHAR(10) NOT NULL,
    name VARCHAR(255),
    capacity INT NOT NULL DEFAULT 8,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE,
    UNIQUE KEY unique_table_number (invitation_id, table_number)
);

-- Masa yerleşimi tablosu
CREATE TABLE IF NOT EXISTS table_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_id INT NOT NULL,
    rsvp_response_id INT NOT NULL,
    assigned_by INT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE,
    FOREIGN KEY (rsvp_response_id) REFERENCES rsvp_responses(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id),
    UNIQUE KEY unique_guest_assignment (rsvp_response_id)
);

-- Masa geçmişi tablosu
CREATE TABLE IF NOT EXISTS table_assignment_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_id INT NOT NULL,
    rsvp_response_id INT NOT NULL,
    assigned_by INT NOT NULL,
    action ENUM('ASSIGN', 'UNASSIGN', 'MOVE') NOT NULL,
    previous_table_id INT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE,
    FOREIGN KEY (rsvp_response_id) REFERENCES rsvp_responses(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id),
    FOREIGN KEY (previous_table_id) REFERENCES tables(id) ON DELETE SET NULL
);

-- İndeksler
CREATE INDEX idx_table_invitation ON tables(invitation_id);
CREATE INDEX idx_assignment_table ON table_assignments(table_id);
CREATE INDEX idx_assignment_rsvp ON table_assignments(rsvp_response_id);
CREATE INDEX idx_assignment_history_table ON table_assignment_history(table_id);
CREATE INDEX idx_assignment_history_rsvp ON table_assignment_history(rsvp_response_id); 