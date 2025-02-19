const { body, param } = require('express-validator');
const { validate } = require('./validators');

const createInvitationValidation = [
    body('title')
        .trim()
        .isLength({ min: 3, max: 255 })
        .withMessage('Title must be between 3 and 255 characters'),
    body('message')
        .trim()
        .isLength({ min: 10 })
        .withMessage('Message must be at least 10 characters long'),
    body('weddingDate')
        .isISO8601()
        .withMessage('Invalid wedding date format')
        .custom((value) => {
            const date = new Date(value);
            if (date < new Date()) {
                throw new Error('Wedding date cannot be in the past');
            }
            return true;
        }),
    body('rsvpLink')
        .optional()
        .isURL()
        .withMessage('Invalid RSVP link format'),
    validate
];

const updateInvitationValidation = [
    param('id')
        .isInt()
        .withMessage('Invalid invitation ID'),
    ...createInvitationValidation
];

module.exports = {
    createInvitationValidation,
    updateInvitationValidation
}; 