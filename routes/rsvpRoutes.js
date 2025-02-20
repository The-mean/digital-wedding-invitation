const express = require('express');
const router = express.Router();
const rsvpController = require('../controllers/rsvpController');
const { validateRsvp } = require('../middleware/validators');
const { requireAuth } = require('../middleware/auth');

// Public routes
router.post('/create/:invitationId', validateRsvp, rsvpController.createRsvp);
router.get('/confirm/:token', rsvpController.confirmRsvp);

// Protected routes (require authentication)
router.use(requireAuth);
router.post('/:id/regenerate-confirmation', rsvpController.regenerateConfirmationLink);
router.put('/:id/restore', rsvpController.restoreRsvp);
router.delete('/:id', rsvpController.deleteRsvp);

module.exports = router; 