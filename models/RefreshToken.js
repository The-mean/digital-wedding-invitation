const db = require('../config/database');
const crypto = require('crypto');

class RefreshToken {
    static async generate(userId) {
        const token = crypto.randomBytes(40).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiration

        const [result] = await db.execute(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
            [userId, token, expiresAt]
        );

        return {
            token,
            expiresAt
        };
    }

    static async verify(token) {
        const [rows] = await db.execute(
            `SELECT rt.*, u.email 
            FROM refresh_tokens rt 
            JOIN users u ON rt.user_id = u.id 
            WHERE rt.token = ? AND rt.expires_at > NOW() 
            AND u.deleted_at IS NULL`,
            [token]
        );
        return rows[0];
    }

    static async deleteByToken(token) {
        const [result] = await db.execute(
            'DELETE FROM refresh_tokens WHERE token = ?',
            [token]
        );
        return result.affectedRows > 0;
    }

    static async deleteAllUserTokens(userId) {
        const [result] = await db.execute(
            'DELETE FROM refresh_tokens WHERE user_id = ?',
            [userId]
        );
        return result.affectedRows > 0;
    }

    static async deleteExpiredTokens() {
        const [result] = await db.execute(
            'DELETE FROM refresh_tokens WHERE expires_at <= NOW()'
        );
        return result.affectedRows;
    }

    static async rotateToken(oldToken, userId) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Verify old token is valid and belongs to user
            const [oldTokenRows] = await connection.execute(
                'SELECT id FROM refresh_tokens WHERE token = ? AND user_id = ? AND expires_at > NOW()',
                [oldToken, userId]
            );

            if (oldTokenRows.length === 0) {
                throw new Error('Invalid or expired refresh token');
            }

            // Delete the old token
            await connection.execute(
                'DELETE FROM refresh_tokens WHERE token = ?',
                [oldToken]
            );

            // Generate new token
            const token = crypto.randomBytes(40).toString('hex');
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);

            // Insert new token
            await connection.execute(
                'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
                [userId, token, expiresAt]
            );

            await connection.commit();
            return {
                token,
                expiresAt
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async getUserActiveTokens(userId) {
        const [rows] = await db.execute(
            'SELECT token, expires_at FROM refresh_tokens WHERE user_id = ? AND expires_at > NOW()',
            [userId]
        );
        return rows;
    }

    static async isTokenBlacklisted(token) {
        // In a real-world application, you might want to check against a blacklist
        // of revoked tokens stored in Redis or another fast storage
        return false;
    }

    static async cleanup() {
        // Delete expired tokens and perform any necessary cleanup
        const deletedCount = await this.deleteExpiredTokens();
        return deletedCount;
    }
}

module.exports = RefreshToken; 