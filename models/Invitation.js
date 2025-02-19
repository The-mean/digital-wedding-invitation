const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs').promises;

class Invitation {
    static async generateQRCode(uniqueCode, publicLink) {
        try {
            // Ensure the qrcodes directory exists
            const qrCodeDir = path.join('public', 'qrcodes');
            await fs.mkdir(qrCodeDir, { recursive: true });

            const qrCodePath = path.join(qrCodeDir, `${uniqueCode}.png`);
            const qrCodeOptions = {
                errorCorrectionLevel: 'H',
                type: 'png',
                quality: 0.92,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            };

            await QRCode.toFile(qrCodePath, publicLink, qrCodeOptions);
            return `/qrcodes/${uniqueCode}.png`;
        } catch (error) {
            console.error('Error generating QR code:', error);
            throw error;
        }
    }

    static async create(userId, invitationData) {
        const uniqueCode = uuidv4();
        const { title, message, imageUrl, weddingDate, rsvpLink } = invitationData;

        // Generate QR code with full public link
        const publicLink = `${process.env.BASE_URL}/wedding/${uniqueCode}`;
        const qrCodeUrl = await this.generateQRCode(uniqueCode, publicLink);

        const [result] = await db.execute(
            `INSERT INTO invitations 
            (user_id, unique_code, title, message, image_url, wedding_date, rsvp_link, qr_code_url) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, uniqueCode, title, message, imageUrl, weddingDate, rsvpLink, qrCodeUrl]
        );

        return {
            id: result.insertId,
            uniqueCode,
            qrCodeUrl,
            shareableLink: publicLink
        };
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
        // Get invitation details before deletion
        const invitation = await this.findById(id);
        if (invitation && invitation.qr_code_url) {
            // Delete QR code file
            const qrCodePath = path.join('public', invitation.qr_code_url);
            await fs.unlink(qrCodePath).catch(err => console.error('Error deleting QR code:', err));
        }

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

        // Add shareable links to each invitation
        return rows.map(row => ({
            ...row,
            shareableLink: `${process.env.BASE_URL}/wedding/${row.unique_code}`
        }));
    }

    static async regenerateQRCode(id, userId) {
        const invitation = await this.findById(id);

        if (!invitation || invitation.user_id !== userId) {
            throw new Error('Invitation not found or unauthorized');
        }

        const publicLink = `${process.env.BASE_URL}/wedding/${invitation.unique_code}`;
        const newQrCodeUrl = await this.generateQRCode(invitation.unique_code, publicLink);

        await db.execute(
            'UPDATE invitations SET qr_code_url = ? WHERE id = ?',
            [newQrCodeUrl, id]
        );

        return {
            qrCodeUrl: newQrCodeUrl,
            shareableLink: publicLink
        };
    }
}

module.exports = Invitation; 