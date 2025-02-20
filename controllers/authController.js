const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const generateAccessToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
};

const setRefreshTokenCookie = (res, token) => {
    res.cookie('refreshToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: '/api/refresh-token' // Restrict cookie to refresh token endpoint
    });
};

exports.register = async (req, res) => {
    try {
        const { email, password, name } = req.body;

        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        const userId = await User.create({ email, password, name });
        const accessToken = generateAccessToken(userId);
        const refreshToken = await RefreshToken.generate(userId);

        // Set refresh token in httpOnly cookie
        setRefreshTokenCookie(res, refreshToken.token);

        res.status(201).json({
            accessToken,
            user: { id: userId, email, name }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating user' });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Invalidate all existing refresh tokens for this user
        await RefreshToken.deleteAllUserTokens(user.id);

        // Generate new tokens
        const accessToken = generateAccessToken(user.id);
        const refreshToken = await RefreshToken.generate(user.id);

        // Set refresh token in httpOnly cookie
        setRefreshTokenCookie(res, refreshToken.token);

        res.json({
            accessToken,
            user: { id: user.id, email: user.email, name: user.name }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error during login' });
    }
};

exports.refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.cookies;

        if (!refreshToken) {
            return res.status(401).json({ message: 'Refresh token required' });
        }

        const tokenData = await RefreshToken.verify(refreshToken);
        if (!tokenData) {
            // Clear the invalid refresh token cookie
            res.clearCookie('refreshToken', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                path: '/api/refresh-token'
            });
            return res.status(401).json({ message: 'Invalid refresh token' });
        }

        // Generate new tokens
        const accessToken = generateAccessToken(tokenData.user_id);
        const newRefreshToken = await RefreshToken.rotateToken(refreshToken, tokenData.user_id);

        // Set new refresh token in cookie
        setRefreshTokenCookie(res, newRefreshToken.token);

        res.json({ accessToken });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error refreshing token' });
    }
};

exports.logout = async (req, res) => {
    try {
        const { refreshToken } = req.cookies;

        if (refreshToken) {
            // Invalidate the refresh token in the database
            await RefreshToken.deleteByToken(refreshToken);
        }

        // Clear the refresh token cookie
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/api/refresh-token'
        });

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error during logout' });
    }
};

exports.requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findByEmail(email);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiryDate = new Date(Date.now() + 3600000); // 1 hour from now

        await User.storeResetToken(user.id, resetToken, expiryDate);

        const resetLink = `http://your-frontend-url/reset-password?token=${resetToken}`;

        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: email,
            subject: 'Password Reset Request',
            html: `
        <p>You requested a password reset.</p>
        <p>Click this <a href="${resetLink}">link</a> to reset your password.</p>
        <p>This link will expire in 1 hour.</p>
      `,
        });

        res.json({ message: 'Password reset email sent' });
    } catch (error) {
        res.status(500).json({ message: 'Error requesting password reset' });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;

        const user = await User.findByResetToken(token);
        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset token' });
        }

        await User.updatePassword(user.id, password);
        await User.storeResetToken(user.id, null, null); // Clear the reset token

        res.json({ message: 'Password successfully reset' });
    } catch (error) {
        res.status(500).json({ message: 'Error resetting password' });
    }
}; 