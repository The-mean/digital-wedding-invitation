const db = require('../config/database');
const crypto = require('crypto');

class Rsvp {
    // Add a constant for the default where clause to exclude soft-deleted records
    static get DEFAULT_WHERE() {
        return 'deleted_at IS NULL';
    }

    static async create(invitationId, rsvpData) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Check if wedding date has passed
            const [invitation] = await connection.execute(
                'SELECT wedding_date FROM invitations WHERE id = ?',
                [invitationId]
            );

            if (!invitation[0]) {
                throw new Error('Invitation not found');
            }

            if (new Date(invitation[0].wedding_date) < new Date()) {
                throw new Error('The wedding date has passed');
            }

            const {
                guestName,
                guestEmail,
                attending,
                numberOfGuests,
                dietaryRequirements,
                message
            } = rsvpData;

            // Generate confirmation token
            const confirmationToken = crypto.randomBytes(32).toString('hex');
            const tokenExpires = new Date();
            tokenExpires.setHours(tokenExpires.getHours() + 24); // Token expires in 24 hours

            // Create RSVP response
            const [result] = await connection.execute(
                `INSERT INTO rsvp_responses 
                (invitation_id, guest_name, guest_email, attending, number_of_guests, 
                dietary_requirements, message, confirmation_token, confirmation_token_expires) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [invitationId, guestName, guestEmail, attending, numberOfGuests,
                    dietaryRequirements, message, confirmationToken, tokenExpires]
            );

            // Log the creation in history
            await connection.execute(
                `INSERT INTO rsvp_history 
                (rsvp_id, guest_name, attending, number_of_guests, 
                dietary_requirements, message, change_type) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [result.insertId, guestName, attending, numberOfGuests,
                    dietaryRequirements, message, 'CREATE']
            );

            await connection.commit();
            return {
                id: result.insertId,
                confirmationToken
            };
        } catch (error) {
            await connection.rollback();
            if (error.code === 'ER_DUP_ENTRY') {
                throw new Error('You have already responded to this invitation');
            }
            throw error;
        } finally {
            connection.release();
        }
    }

    static async softDelete(id) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Soft delete the RSVP response
            const [result] = await connection.execute(
                'UPDATE rsvp_responses SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
                [id]
            );

            // Log the deletion in history
            if (result.affectedRows > 0) {
                const [rsvp] = await connection.execute(
                    'SELECT * FROM rsvp_responses WHERE id = ?',
                    [id]
                );

                await connection.execute(
                    `INSERT INTO rsvp_history 
                    (rsvp_id, guest_name, attending, number_of_guests, 
                    dietary_requirements, message, change_type) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [id, rsvp[0].guest_name, rsvp[0].attending, rsvp[0].number_of_guests,
                        rsvp[0].dietary_requirements, rsvp[0].message, 'DELETE']
                );
            }

            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async restore(id) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Restore the RSVP response
            const [result] = await connection.execute(
                'UPDATE rsvp_responses SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL',
                [id]
            );

            // Log the restoration in history
            if (result.affectedRows > 0) {
                const [rsvp] = await connection.execute(
                    'SELECT * FROM rsvp_responses WHERE id = ?',
                    [id]
                );

                await connection.execute(
                    `INSERT INTO rsvp_history 
                    (rsvp_id, guest_name, attending, number_of_guests, 
                    dietary_requirements, message, change_type) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [id, rsvp[0].guest_name, rsvp[0].attending, rsvp[0].number_of_guests,
                        rsvp[0].dietary_requirements, rsvp[0].message, 'RESTORE']
                );
            }

            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async confirmRsvp(token) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Find and validate token
            const [rows] = await connection.execute(
                `SELECT id, confirmed_at, confirmation_token_expires 
                FROM rsvp_responses 
                WHERE confirmation_token = ? AND ${this.DEFAULT_WHERE}`,
                [token]
            );

            if (rows.length === 0) {
                throw new Error('Invalid confirmation token');
            }

            const rsvp = rows[0];

            // Check if already confirmed
            if (rsvp.confirmed_at) {
                throw new Error('RSVP already confirmed');
            }

            // Check if token expired
            if (new Date(rsvp.confirmation_token_expires) < new Date()) {
                throw new Error('Confirmation token has expired');
            }

            // Confirm RSVP
            await connection.execute(
                `UPDATE rsvp_responses 
                SET confirmed_at = CURRENT_TIMESTAMP,
                confirmation_token = NULL,
                confirmation_token_expires = NULL 
                WHERE id = ? AND ${this.DEFAULT_WHERE}`,
                [rsvp.id]
            );

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async update(id, rsvpData) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Get current RSVP data for comparison
            const [currentRsvp] = await connection.execute(
                `SELECT attending, number_of_guests FROM rsvp_responses 
                WHERE id = ? AND ${this.DEFAULT_WHERE}`,
                [id]
            );

            if (!currentRsvp) {
                throw new Error('RSVP not found');
            }

            const {
                guestName,
                attending,
                numberOfGuests,
                dietaryRequirements,
                message
            } = rsvpData;

            // Update RSVP response
            const [result] = await connection.execute(
                `UPDATE rsvp_responses 
                SET guest_name = ?, 
                    attending = ?, 
                    number_of_guests = ?, 
                    dietary_requirements = ?, 
                    message = ?, 
                    response_date = CURRENT_TIMESTAMP 
                WHERE id = ? AND ${this.DEFAULT_WHERE}`,
                [guestName, attending, numberOfGuests, dietaryRequirements, message, id]
            );

            // Log the update in history
            await connection.execute(
                `INSERT INTO rsvp_history 
                (rsvp_id, guest_name, attending, number_of_guests, 
                dietary_requirements, message, change_type) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, guestName, attending, numberOfGuests,
                    dietaryRequirements, message, 'UPDATE']
            );

            await connection.commit();
            return {
                success: result.affectedRows > 0,
                attendingChanged: currentRsvp.attending !== attending,
                previousAttendingStatus: currentRsvp.attending
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async findById(id, includeSoftDeleted = false) {
        const whereClause = includeSoftDeleted ? '' : `AND ${this.DEFAULT_WHERE}`;
        const [rows] = await db.execute(
            `SELECT r.*, i.wedding_date, i.title 
            FROM rsvp_responses r 
            JOIN invitations i ON r.invitation_id = i.id 
            WHERE r.id = ? ${whereClause}`,
            [id]
        );
        return rows[0];
    }

    static async findByInvitationCode(code, includeSoftDeleted = false) {
        const whereClause = includeSoftDeleted ? '' : `AND ${this.DEFAULT_WHERE}`;
        const [rows] = await db.execute(
            `SELECT r.* 
            FROM rsvp_responses r 
            JOIN invitations i ON r.invitation_id = i.id 
            WHERE i.unique_code = ? ${whereClause}`,
            [code]
        );
        return rows;
    }

    static async findByGuestEmail(invitationId, guestEmail, includeSoftDeleted = false) {
        const whereClause = includeSoftDeleted ? '' : `AND ${this.DEFAULT_WHERE}`;
        const [rows] = await db.execute(
            `SELECT r.*, i.wedding_date, i.title 
            FROM rsvp_responses r 
            JOIN invitations i ON r.invitation_id = i.id 
            WHERE r.invitation_id = ? AND r.guest_email = ? ${whereClause}`,
            [invitationId, guestEmail]
        );
        return rows[0];
    }

    static async verifyGuestAccess(id, guestEmail) {
        const [rows] = await db.execute(
            `SELECT r.*, i.wedding_date, i.title 
            FROM rsvp_responses r 
            JOIN invitations i ON r.invitation_id = i.id 
            WHERE r.id = ? AND r.guest_email = ? AND ${this.DEFAULT_WHERE}`,
            [id, guestEmail]
        );
        return rows[0];
    }

    static async checkDuplicateResponse(invitationId, guestEmail) {
        const [rows] = await db.execute(
            `SELECT COUNT(*) as count 
            FROM rsvp_responses 
            WHERE invitation_id = ? AND guest_email = ? AND ${this.DEFAULT_WHERE}`,
            [invitationId, guestEmail]
        );
        return rows[0].count > 0;
    }

    static async getResponseHistory(id) {
        const [rows] = await db.execute(
            `SELECT 
                r.guest_name,
                r.attending,
                r.number_of_guests,
                r.dietary_requirements,
                r.message,
                r.response_date,
                r.updated_at,
                h.change_type,
                h.created_at as history_date
            FROM rsvp_responses r
            LEFT JOIN rsvp_history h ON r.id = h.rsvp_id
            WHERE r.id = ? AND ${this.DEFAULT_WHERE}
            ORDER BY COALESCE(h.created_at, r.created_at) DESC`,
            [id]
        );
        return rows;
    }

    static async getByInvitationId(invitationId, includeSoftDeleted = false) {
        const whereClause = includeSoftDeleted ? '' : `AND ${this.DEFAULT_WHERE}`;
        const [rows] = await db.execute(
            `SELECT * FROM rsvp_responses 
            WHERE invitation_id = ? ${whereClause}
            ORDER BY created_at DESC`,
            [invitationId]
        );
        return rows;
    }

    static async getResponseSummary(invitationId) {
        const [rows] = await db.execute(
            `SELECT 
                COUNT(*) as total_responses,
                SUM(CASE WHEN attending = 1 THEN 1 ELSE 0 END) as attending_count,
                SUM(CASE WHEN attending = 0 THEN 1 ELSE 0 END) as not_attending_count,
                SUM(CASE WHEN attending = 1 THEN number_of_guests ELSE 0 END) as total_guests,
                SUM(CASE WHEN confirmed_at IS NOT NULL THEN 1 ELSE 0 END) as confirmed_count
            FROM rsvp_responses 
            WHERE invitation_id = ? AND ${this.DEFAULT_WHERE}`,
            [invitationId]
        );
        return rows[0];
    }

    static async regenerateConfirmationToken(id) {
        const confirmationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpires = new Date();
        tokenExpires.setHours(tokenExpires.getHours() + 24);

        const [result] = await db.execute(
            `UPDATE rsvp_responses 
            SET confirmation_token = ?,
            confirmation_token_expires = ?,
            confirmed_at = NULL 
            WHERE id = ?`,
            [confirmationToken, tokenExpires, id]
        );

        if (result.affectedRows === 0) {
            throw new Error('RSVP response not found');
        }

        return {
            confirmationToken,
            tokenExpires
        };
    }

    static async isConfirmed(id) {
        const [rows] = await db.execute(
            'SELECT confirmed_at FROM rsvp_responses WHERE id = ?',
            [id]
        );
        return rows[0]?.confirmed_at != null;
    }

    static async getAllResponses(invitationId, includeSoftDeleted = false) {
        const whereClause = includeSoftDeleted ? '' : `AND ${this.DEFAULT_WHERE}`;
        const [rows] = await db.execute(
            `SELECT r.*, i.wedding_date, i.title 
            FROM rsvp_responses r 
            JOIN invitations i ON r.invitation_id = i.id 
            WHERE r.invitation_id = ? ${whereClause}
            ORDER BY r.created_at DESC`,
            [invitationId]
        );
        return rows;
    }

    static async getResponseStats(invitationId) {
        const [rows] = await db.execute(
            `SELECT 
                COUNT(*) as total_responses,
                SUM(CASE WHEN attending = 1 THEN 1 ELSE 0 END) as attending_count,
                SUM(CASE WHEN attending = 0 THEN 1 ELSE 0 END) as not_attending_count,
                SUM(CASE WHEN attending = 1 THEN number_of_guests ELSE 0 END) as total_guests,
                COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as deleted_count
            FROM rsvp_responses 
            WHERE invitation_id = ?`,
            [invitationId]
        );
        return rows[0];
    }
}

module.exports = Rsvp; 