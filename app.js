const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const authController = require('./controllers/authController');
const invitationController = require('./controllers/invitationController');
const rsvpController = require('./controllers/rsvpController');
const auth = require('./middleware/auth');
const upload = require('./middleware/upload');
const { loginLimiter, registerLimiter } = require('./middleware/authLimiter');
const {
    registerValidation,
    loginValidation,
    resetPasswordValidation,
    newPasswordValidation,
    validate,
} = require('./middleware/validators');
const {
    createInvitationValidation,
    updateInvitationValidation,
} = require('./middleware/invitationValidators');
const {
    rsvpValidation,
    updateRsvpValidation,
    rsvpLimiter,
} = require('./middleware/rsvpValidators');
const emailPreferenceController = require('./controllers/emailPreferenceController');

const app = express();

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Auth Routes with rate limiting
app.post('/api/register',
    registerLimiter,
    registerValidation,
    validate,
    authController.register
);

app.post('/api/login',
    loginLimiter,
    loginValidation,
    validate,
    authController.login
);

app.post('/api/logout', authController.logout);
app.post('/api/refresh-token', authController.refreshToken);

app.post('/api/request-reset',
    passwordResetLimiter,
    resetPasswordValidation,
    validate,
    authController.requestPasswordReset
);

app.post('/api/reset-password',
    newPasswordValidation,
    validate,
    authController.resetPassword
);

// Protected Invitation Routes
app.post('/api/invitations',
    auth,
    upload.single('image'),
    createInvitationValidation,
    invitationController.createInvitation
);

app.put('/api/invitations/:id',
    auth,
    upload.single('image'),
    updateInvitationValidation,
    invitationController.updateInvitation
);

app.delete('/api/invitations/:id',
    auth,
    invitationController.deleteInvitation
);

app.get('/api/invitations',
    auth,
    invitationController.getUserInvitations
);

app.get('/api/invitations/:id',
    auth,
    invitationController.getInvitation
);

// Public Invitation Route
app.get('/invitations/:code',
    invitationController.getPublicInvitation
);

// RSVP Routes
app.post('/invitations/:code/rsvp',
    rsvpLimiter,
    rsvpValidation,
    rsvpController.submitRsvp
);

// RSVP Confirmation Routes
app.get('/api/rsvp/confirm/:token',
    rsvpController.confirmRsvp
);

app.post('/api/rsvp/:id/resend-confirmation',
    rsvpLimiter,
    rsvpController.resendConfirmation
);

app.put('/invitations/:code/rsvp',
    rsvpLimiter,
    updateRsvpValidation,
    rsvpController.updateRsvp
);

app.get('/invitations/:code/rsvp',
    rsvpController.getGuestResponse
);

// Protected RSVP Management Route
app.get('/api/invitations/:id/rsvp-responses',
    auth,
    rsvpController.getRsvpResponses
);

// Protected Profile Route
app.get('/api/profile', auth, (req, res) => {
    res.json({ message: 'Protected route accessed successfully', userId: req.user.userId });
});

// QR Code Regeneration Route
app.post('/api/invitations/:id/regenerate-qr',
    auth,
    invitationController.regenerateQRCode
);

// Email Preferences Routes
app.get('/invitations/:code/preferences',
    emailPreferenceController.getPreferences
);

app.put('/invitations/:code/preferences',
    emailPreferenceController.updatePreferences
);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File size too large. Maximum size is 5MB.' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ message: 'Unexpected field.' });
    }
    res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 