const { body } = require('express-validator');
const { validate } = require('./validators');
const rateLimit = require('express-rate-limit');

// Rate limiting for RSVP submissions
const rsvpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 submissions per IP per hour
    message: 'Too many RSVP submissions from this IP, please try again later.'
});

const rsvpValidation = [
    body('guestName')
        .trim()
        .isLength({ min: 2, max: 255 })
        .withMessage('Guest name must be between 2 and 255 characters')
        .matches(/^[a-zA-Z\s-']+$/)
        .withMessage('Guest name can only contain letters, spaces, hyphens, and apostrophes'),

    body('guestEmail')
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Please enter a valid email address'),

    body('attending')
        .isBoolean()
        .withMessage('Attending status must be true or false'),

    body('numberOfGuests')
        .isInt({ min: 1, max: 10 })
        .withMessage('Number of guests must be between 1 and 10'),

    body('dietaryRequirements')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Dietary requirements cannot exceed 500 characters'),

    body('message')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Message cannot exceed 1000 characters'),

    validate
];

const updateRsvpValidation = [
    ...rsvpValidation
];

module.exports = {
    rsvpValidation,
    updateRsvpValidation,
    rsvpLimiter
}; 