const db = require('../config/database');

class Rsvp {
    static async create(invitationId, rsvpData) {
        const {
            guestName,
            guestEmail,
            attending,
            numberOfGuests,
            dietaryRequirements,
            message
        } = rsvpData;

        try {
            const [result] = await db.execute(
                `INSERT INTO rsvp_responses 
                (invitation_id, guest_name, guest_email, attending, number_of_guests, dietary_requirements, message) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [invitationId, guestName, guestEmail, attending, numberOfGuests, dietaryRequirements, message]
            );
            return result.insertId;
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                throw new Error('You have already responded to this invitation');
            }
            throw error;
        }
    }

    static async update(invitationId, guestEmail, rsvpData) {
        const {
            guestName,
            attending,
            numberOfGuests,
            dietaryRequirements,
            message
        } = rsvpData;

        const [result] = await db.execute(
            `UPDATE rsvp_responses 
            SET guest_name = ?, attending = ?, number_of_guests = ?, 
                dietary_requirements = ?, message = ?, response_date = CURRENT_TIMESTAMP 
            WHERE invitation_id = ? AND guest_email = ?`,
            [guestName, attending, numberOfGuests, dietaryRequirements, message, invitationId, guestEmail]
        );

        return result.affectedRows > 0;
    }

    static async getByInvitationId(invitationId) {
        const [rows] = await db.execute(
            `SELECT * FROM rsvp_responses 
            WHERE invitation_id = ? 
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
                SUM(CASE WHEN attending = 1 THEN number_of_guests ELSE 0 END) as total_guests
            FROM rsvp_responses 
            WHERE invitation_id = ?`,
            [invitationId]
        );
        return rows[0];
    }

    static async getByGuestEmail(invitationId, guestEmail) {
        const [rows] = await db.execute(
            `SELECT * FROM rsvp_responses 
            WHERE invitation_id = ? AND guest_email = ?`,
            [invitationId, guestEmail]
        );
        return rows[0];
    }

    static async checkDuplicateResponse(invitationId, guestEmail) {
        const [rows] = await db.execute(
            `SELECT COUNT(*) as count 
            FROM rsvp_responses 
            WHERE invitation_id = ? AND guest_email = ?`,
            [invitationId, guestEmail]
        );
        return rows[0].count > 0;
    }
}

module.exports = Rsvp; 