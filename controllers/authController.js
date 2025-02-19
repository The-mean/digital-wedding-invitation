const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
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

const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '24h' });
};

exports.register = async (req, res) => {
    try {
        const { email, password, name } = req.body;

        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        const userId = await User.create({ email, password, name });
        const token = generateToken(userId);

        res.status(201).json({ token, userId });
    } catch (error) {
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

        const token = generateToken(user.id);
        res.json({ token, userId: user.id });
    } catch (error) {
        res.status(500).json({ message: 'Error during login' });
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