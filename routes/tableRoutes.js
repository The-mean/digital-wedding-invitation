const express = require('express');
const router = express.Router();
const tableController = require('../controllers/tableController');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validators');
const { body, param } = require('express-validator');

// Validasyon kuralları
const tableValidation = [
    body('tableNumber')
        .trim()
        .notEmpty()
        .withMessage('Table number is required')
        .matches(/^[A-Za-z0-9-]+$/)
        .withMessage('Table number can only contain letters, numbers and hyphens'),
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Table name is required')
        .isLength({ max: 255 })
        .withMessage('Table name cannot exceed 255 characters'),
    body('capacity')
        .isInt({ min: 1, max: 20 })
        .withMessage('Capacity must be between 1 and 20'),
    body('notes')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Notes cannot exceed 1000 characters')
];

// Tüm route'lar kimlik doğrulama gerektirir
router.use(requireAuth);

// Masa yönetimi route'ları
router.post('/invitations/:invitationId/tables',
    param('invitationId').isInt().withMessage('Invalid invitation ID'),
    tableValidation,
    validate,
    tableController.createTable
);

router.put('/tables/:id',
    param('id').isInt().withMessage('Invalid table ID'),
    tableValidation,
    validate,
    tableController.updateTable
);

router.delete('/tables/:id',
    param('id').isInt().withMessage('Invalid table ID'),
    validate,
    tableController.deleteTable
);

// Masa atama route'ları
router.post('/tables/:tableId/assign/:rsvpResponseId',
    param('tableId').isInt().withMessage('Invalid table ID'),
    param('rsvpResponseId').isInt().withMessage('Invalid RSVP response ID'),
    body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
    validate,
    tableController.assignGuest
);

router.delete('/tables/unassign/:rsvpResponseId',
    param('rsvpResponseId').isInt().withMessage('Invalid RSVP response ID'),
    body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
    validate,
    tableController.unassignGuest
);

// Masa bilgisi route'ları
router.get('/invitations/:invitationId/tables',
    param('invitationId').isInt().withMessage('Invalid invitation ID'),
    validate,
    tableController.getTablesByInvitation
);

router.get('/tables/:id/assignments',
    param('id').isInt().withMessage('Invalid table ID'),
    validate,
    tableController.getTableAssignments
);

router.get('/tables/:id/history',
    param('id').isInt().withMessage('Invalid table ID'),
    validate,
    tableController.getAssignmentHistory
);

router.get('/rsvp/:rsvpResponseId/assignment',
    param('rsvpResponseId').isInt().withMessage('Invalid RSVP response ID'),
    validate,
    tableController.getGuestAssignment
);

module.exports = router; 