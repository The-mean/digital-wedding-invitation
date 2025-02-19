const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const path = require('path');

class Invitation {
    static async create(userId, invitationData) {
        const uniqueCode = uuidv4();
        const { title, message, imageUrl, weddingDate, rsvpLink } = invitationData;

        // Generate QR code
        const publicLink = `${process.env.BASE_URL}/invitations/${uniqueCode}`;
        const qrCodePath = path.join('public', 'qrcodes', `${uniqueCode}.png`);
        await QRCode.toFile(qrCodePath, publicLink);
        const qrCodeUrl = `/qrcodes/${uniqueCode}.png`;

        const [result] = await db.execute(
            `INSERT INTO invitations 
            (user_id, unique_code, title, message, image_url, wedding_date, rsvp_link, qr_code_url) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, uniqueCode, title, message, imageUrl, weddingDate, rsvpLink, qrCodeUrl]
        );

        return { id: result.insertId, uniqueCode, qrCodeUrl };
    }

    static async update(id, userId, invitationData) {
        const { title, message, imageUrl, weddingDate, rsvpLink } = invitationData;

        const [result] = await db.execute(
            `UPDATE invitations 
            SET title = ?, message = ?, image_url = ?, wedding_date = ?, rsvp_link = ? 
            WHERE id = ? AND user_id = ?`,
            [title, message, imageUrl, weddingDate, rsvpLink, id, userId]
        );

        return result.affectedRows > 0;
    }

    static async delete(id, userId) {
        const [result] = await db.execute(
            'DELETE FROM invitations WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        return result.affectedRows > 0;
    }

    static async findById(id) {
        const [rows] = await db.execute(
            'SELECT * FROM invitations WHERE id = ?',
            [id]
        );
        return rows[0];
    }

    static async findByCode(uniqueCode) {
        const [rows] = await db.execute(
            'SELECT * FROM invitations WHERE unique_code = ?',
            [uniqueCode]
        );
        return rows[0];
    }

    static async findByUserId(userId) {
        const [rows] = await db.execute(
            'SELECT * FROM invitations WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        return rows;
    }
}

module.exports = Invitation; 