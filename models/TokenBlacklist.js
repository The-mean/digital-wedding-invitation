const db = require('../config/database');

class TokenBlacklist {
    static async addToBlacklist(token, userId, expiresAt) {
        const [result] = await db.execute(
            'INSERT INTO token_blacklist (token, user_id, expires_at) VALUES (?, ?, ?)',
            [token, userId, expiresAt]
        );
        return result.insertId;
    }

    static async isBlacklisted(token) {
        const [rows] = await db.execute(
            'SELECT * FROM token_blacklist WHERE token = ? AND expires_at > NOW()',
            [token]
        );
        return rows.length > 0;
    }

    static async removeExpiredTokens() {
        const [result] = await db.execute(
            'DELETE FROM token_blacklist WHERE expires_at <= NOW()'
        );
        return result.affectedRows;
    }

    static async getUserBlacklistedTokens(userId) {
        const [rows] = await db.execute(
            'SELECT token, expires_at FROM token_blacklist WHERE user_id = ? AND expires_at > NOW()',
            [userId]
        );
        return rows;
    }
} 