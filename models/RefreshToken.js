const db = require('../config/database');
const crypto = require('crypto');
const TokenBlacklist = require('./TokenBlacklist');

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
        // First check if token is blacklisted
        const isBlacklisted = await TokenBlacklist.isBlacklisted(token);
        if (isBlacklisted) {
            return null;
        }

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

    static async invalidateToken(token, userId) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Get token expiration date
            const [tokenData] = await connection.execute(
                'SELECT expires_at FROM refresh_tokens WHERE token = ? AND user_id = ?',
                [token, userId]
            );

            if (tokenData.length > 0) {
                // Add token to blacklist
                await connection.execute(
                    'INSERT INTO token_blacklist (token, user_id, expires_at) VALUES (?, ?, ?)',
                    [token, userId, tokenData[0].expires_at]
                );

                // Delete the token from refresh_tokens
                await connection.execute(
                    'DELETE FROM refresh_tokens WHERE token = ?',
                    [token]
                );
            }

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async deleteByToken(token) {
        const [result] = await db.execute(
            'DELETE FROM refresh_tokens WHERE token = ?',
            [token]
        );
        return result.affectedRows > 0;
    }

    static async deleteAllUserTokens(userId) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Get all active tokens for the user
            const [tokens] = await connection.execute(
                'SELECT token, expires_at FROM refresh_tokens WHERE user_id = ?',
                [userId]
            );

            // Add all tokens to blacklist
            for (const token of tokens) {
                await connection.execute(
                    'INSERT INTO token_blacklist (token, user_id, expires_at) VALUES (?, ?, ?)',
                    [token.token, userId, token.expires_at]
                );
            }

            // Delete all tokens
            const [result] = await connection.execute(
                'DELETE FROM refresh_tokens WHERE user_id = ?',
                [userId]
            );

            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
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
                'SELECT id, expires_at FROM refresh_tokens WHERE token = ? AND user_id = ? AND expires_at > NOW()',
                [oldToken, userId]
            );

            if (oldTokenRows.length === 0) {
                throw new Error('Invalid or expired refresh token');
            }

            // Check if token is blacklisted
            const isBlacklisted = await TokenBlacklist.isBlacklisted(oldToken);
            if (isBlacklisted) {
                throw new Error('Token has been invalidated');
            }

            // Add old token to blacklist
            await connection.execute(
                'INSERT INTO token_blacklist (token, user_id, expires_at) VALUES (?, ?, ?)',
                [oldToken, userId, oldTokenRows[0].expires_at]
            );

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
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Delete expired tokens from refresh_tokens
            const deletedTokens = await this.deleteExpiredTokens();

            // Clean up expired tokens from blacklist
            const deletedBlacklistedTokens = await TokenBlacklist.removeExpiredTokens();

            await connection.commit();
            return {
                deletedTokens,
                deletedBlacklistedTokens
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