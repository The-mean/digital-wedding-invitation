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
            'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW()',
            [token]
        );
        return rows[0];
    }

    static async deleteByToken(token) {
        await db.execute(
            'DELETE FROM refresh_tokens WHERE token = ?',
            [token]
        );
    }

    static async deleteAllUserTokens(userId) {
        await db.execute(
            'DELETE FROM refresh_tokens WHERE user_id = ?',
            [userId]
        );
    }

    static async deleteExpiredTokens() {
        await db.execute(
            'DELETE FROM refresh_tokens WHERE expires_at <= NOW()'
        );
    }

    static async rotateToken(oldToken, userId) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Delete the old token
            await connection.execute(
                'DELETE FROM refresh_tokens WHERE token = ?',
                [oldToken]
            );

            // Generate new token
            const token = crypto.randomBytes(40).toString('hex');
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);

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
}

module.exports = RefreshToken; 