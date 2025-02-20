const Rsvp = require('../models/Rsvp');
const Invitation = require('../models/Invitation');
const EmailPreference = require('../models/EmailPreference');
const EmailReminder = require('../models/EmailReminder');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

exports.submitRsvp = async (req, res) => {
    try {
        const { code } = req.params;
        const invitation = await Invitation.findByCode(code);

        if (!invitation) {
            return res.status(404).json({ message: 'Invitation not found' });
        }

        const rsvpData = {
            guestName: req.body.guestName,
            guestEmail: req.body.guestEmail,
            attending: req.body.attending,
            numberOfGuests: req.body.numberOfGuests,
            dietaryRequirements: req.body.dietaryRequirements,
            message: req.body.message
        };

        try {
            // Create RSVP response with confirmation token
            const { id: rsvpId, confirmationToken } = await Rsvp.create(invitation.id, rsvpData);

            // Send confirmation email with verification link
            await sendConfirmationEmail(invitation, rsvpData, code, confirmationToken);

            res.status(201).json({
                message: 'RSVP submitted successfully. Please check your email to confirm your response.',
                rsvpId
            });
        } catch (error) {
            if (error.message === 'The wedding date has passed') {
                return res.status(400).json({
                    message: 'Cannot submit RSVP: The wedding date has passed',
                    weddingDate: invitation.wedding_date
                });
            }
            if (error.message === 'You have already responded to this invitation') {
                return res.status(400).json({
                    message: 'You have already responded to this invitation. Please use the update feature to modify your response.'
                });
            }
            throw error;
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error submitting RSVP' });
    }
};

exports.confirmRsvp = async (req, res) => {
    try {
        const { token } = req.params;

        const confirmationResult = await Rsvp.confirmRsvp(token);

        // Create email preferences if attending
        if (confirmationResult.attending) {
            await EmailPreference.create(confirmationResult.rsvpId);
            await EmailReminder.scheduleReminders(confirmationResult.invitation_id, confirmationResult.weddingDate);
        }

        // Send confirmation success email
        await sendConfirmationSuccessEmail(
            confirmationResult.guestName,
            confirmationResult.eventTitle,
            confirmationResult.weddingDate,
            confirmationResult.attending
        );

        res.json({
            message: 'RSVP confirmed successfully. Thank you for confirming your response!',
            details: {
                guestName: confirmationResult.guestName,
                eventTitle: confirmationResult.eventTitle,
                weddingDate: confirmationResult.weddingDate,
                attending: confirmationResult.attending
            }
        });
    } catch (error) {
        console.error(error);
        if (error.message === 'Invalid confirmation token') {
            return res.status(400).json({
                message: 'Invalid or expired confirmation link. Please request a new confirmation link.',
                code: 'INVALID_TOKEN'
            });
        }
        if (error.message === 'RSVP already confirmed') {
            return res.status(400).json({
                message: 'This RSVP has already been confirmed',
                code: 'ALREADY_CONFIRMED'
            });
        }
        if (error.message === 'The wedding date has passed') {
            return res.status(400).json({
                message: 'Cannot confirm RSVP: The wedding date has passed',
                code: 'EVENT_PASSED'
            });
        }
        res.status(500).json({ message: 'Error confirming RSVP' });
    }
};

exports.resendConfirmation = async (req, res) => {
    try {
        const { id } = req.params;
        const { email } = req.query;

        const rsvpResponse = await Rsvp.verifyGuestAccess(id, email);
        if (!rsvpResponse) {
            return res.status(404).json({ message: 'RSVP response not found or unauthorized' });
        }

        if (rsvpResponse.confirmed_at) {
            return res.status(400).json({
                message: 'This RSVP has already been confirmed',
                code: 'ALREADY_CONFIRMED'
            });
        }

        if (new Date(rsvpResponse.wedding_date) < new Date()) {
            return res.status(400).json({
                message: 'Cannot resend confirmation: The wedding date has passed',
                code: 'EVENT_PASSED'
            });
        }

        const invitation = await Invitation.findById(rsvpResponse.invitation_id);
        const { confirmationToken, tokenExpires } = await Rsvp.regenerateConfirmationToken(id);

        // Send new confirmation email
        await sendConfirmationEmail(
            invitation,
            {
                guestName: rsvpResponse.guest_name,
                guestEmail: rsvpResponse.guest_email,
                attending: rsvpResponse.attending,
                numberOfGuests: rsvpResponse.number_of_guests,
                dietaryRequirements: rsvpResponse.dietary_requirements,
                message: rsvpResponse.message
            },
            invitation.unique_code,
            confirmationToken
        );

        res.json({
            message: 'Confirmation email resent successfully',
            details: {
                tokenExpires: tokenExpires,
                emailSent: rsvpResponse.guest_email
            }
        });
    } catch (error) {
        console.error(error);
        if (error.message === 'RSVP not found or already confirmed') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error resending confirmation email' });
    }
};

exports.updateRsvpById = async (req, res) => {
    try {
        const { id } = req.params;
        const { guestEmail } = req.query;

        // Verify guest access
        const rsvpResponse = await Rsvp.verifyGuestAccess(id, guestEmail);
        if (!rsvpResponse) {
            return res.status(404).json({ message: 'RSVP response not found or unauthorized' });
        }

        // Check if wedding date has passed
        if (new Date(rsvpResponse.wedding_date) < new Date()) {
            return res.status(400).json({
                message: 'Cannot update RSVP: The wedding date has passed',
                weddingDate: rsvpResponse.wedding_date
            });
        }

        const rsvpData = {
            guestName: req.body.guestName,
            attending: req.body.attending,
            numberOfGuests: req.body.numberOfGuests,
            dietaryRequirements: req.body.dietaryRequirements,
            message: req.body.message
        };

        const updateResult = await Rsvp.update(id, rsvpData);

        if (!updateResult.success) {
            return res.status(400).json({ message: 'Error updating RSVP' });
        }

        // Handle email preferences if attendance status changed
        if (updateResult.attendingChanged) {
            if (rsvpData.attending) {
                await EmailPreference.create(id);
                await EmailReminder.scheduleReminders(rsvpResponse.invitation_id, rsvpResponse.wedding_date);
            } else {
                // Remove email preferences and reminders if not attending
                await EmailPreference.delete(id);
            }
        }

        // Send update confirmation email
        await sendUpdateConfirmationEmail(
            rsvpResponse.title,
            {
                ...rsvpData,
                guestEmail: rsvpResponse.guest_email
            },
            rsvpResponse.wedding_date
        );

        // Get updated history
        const history = await Rsvp.getResponseHistory(id);

        res.json({
            message: 'RSVP updated successfully',
            history,
            changes: {
                attendingChanged: updateResult.attendingChanged,
                previousStatus: updateResult.previousAttendingStatus,
                newStatus: rsvpData.attending
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating RSVP' });
    }
};

exports.getRsvpHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const { guestEmail } = req.query;

        const rsvpResponse = await Rsvp.verifyGuestAccess(id, guestEmail);
        if (!rsvpResponse) {
            return res.status(404).json({ message: 'RSVP response not found or unauthorized' });
        }

        const history = await Rsvp.getResponseHistory(id);
        res.json({
            currentResponse: {
                guestName: rsvpResponse.guest_name,
                attending: rsvpResponse.attending,
                numberOfGuests: rsvpResponse.number_of_guests,
                dietaryRequirements: rsvpResponse.dietary_requirements,
                message: rsvpResponse.message,
                lastUpdated: rsvpResponse.updated_at
            },
            history
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving RSVP history' });
    }
};

const sendConfirmationEmail = async (invitation, rsvpData, code, confirmationToken) => {
    const confirmationLink = `${process.env.BASE_URL}/api/rsvp/confirm/${confirmationToken}`;

    await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: rsvpData.guestEmail,
        subject: `Please Confirm Your RSVP - ${invitation.title}`,
        html: `
            <h2>Thank you for your RSVP response!</h2>
            <p>Please confirm your response for the following event:</p>
            <p><strong>${invitation.title}</strong></p>
            <p>Your response: ${rsvpData.attending ? 'Attending' : 'Not Attending'}</p>
            ${rsvpData.attending ? `
                <p>Number of guests: ${rsvpData.numberOfGuests}</p>
            ` : ''}
            <p>Date: ${new Date(invitation.wedding_date).toLocaleDateString()}</p>
            ${rsvpData.dietaryRequirements ? `<p>Dietary requirements: ${rsvpData.dietaryRequirements}</p>` : ''}
            
            <p><strong>Important:</strong> Please click the link below to confirm your RSVP:</p>
            <p><a href="${confirmationLink}">Confirm Your RSVP</a></p>
            <p>This confirmation link will expire in 24 hours.</p>
            
            <p>If you need to make changes after confirming, you can update your response at any time before the event.</p>
            
            ${rsvpData.attending ? `
                <p>After confirmation, you can manage your email preferences at:</p>
                <p><a href="${process.env.BASE_URL}/invitations/${code}/preferences?email=${rsvpData.guestEmail}">Manage Email Preferences</a></p>
            ` : ''}
        `
    });
};

const sendUpdateConfirmationEmail = async (title, rsvpData, weddingDate) => {
    await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: rsvpData.guestEmail,
        subject: `RSVP Update Confirmation - ${title}`,
        html: `
            <h2>Your RSVP has been updated!</h2>
            <p>We have received your updated response for:</p>
            <p><strong>${title}</strong></p>
            <p>Updated response: ${rsvpData.attending ? 'Attending' : 'Not Attending'}</p>
            ${rsvpData.attending ? `
                <p>Updated number of guests: ${rsvpData.numberOfGuests}</p>
            ` : ''}
            <p>Date: ${new Date(weddingDate).toLocaleDateString()}</p>
            ${rsvpData.dietaryRequirements ? `<p>Updated dietary requirements: ${rsvpData.dietaryRequirements}</p>` : ''}
        `
    });
};

const sendConfirmationSuccessEmail = async (guestName, eventTitle, weddingDate, attending) => {
    const formattedDate = new Date(weddingDate).toLocaleDateString('tr-TR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: rsvpData.guestEmail,
        subject: `RSVP Confirmation Success - ${eventTitle}`,
        html: `
            <h2>Dear ${guestName},</h2>
            <p>Your RSVP response has been successfully confirmed for:</p>
            <p><strong>${eventTitle}</strong></p>
            <p>Event Date: ${formattedDate}</p>
            <p>Your Response: ${attending ? 'Attending' : 'Not Attending'}</p>
            ${attending ? `
                <p>We look forward to celebrating with you!</p>
                <p>You will receive reminder emails as the event approaches.</p>
            ` : `
                <p>We're sorry you won't be able to join us, but thank you for letting us know.</p>
            `}
            <p>If you need to make any changes to your response, you can do so until the event date.</p>
        `
    });
};

exports.getRsvpResponses = async (req, res) => {
    try {
        const invitation = await Invitation.findById(req.params.id);
        const includeSoftDeleted = req.query.includeSoftDeleted === 'true';

        if (!invitation) {
            return res.status(404).json({ message: 'Invitation not found' });
        }

        if (invitation.user_id !== req.user.userId) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const responses = await Rsvp.getAllResponses(invitation.id, includeSoftDeleted);
        const stats = await Rsvp.getResponseStats(invitation.id);

        res.json({
            responses,
            stats,
            includesSoftDeleted: includeSoftDeleted
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving RSVP responses' });
    }
};

exports.getGuestResponse = async (req, res) => {
    try {
        const { code } = req.params;
        const { email } = req.query;

        const invitation = await Invitation.findByCode(code);
        if (!invitation) {
            return res.status(404).json({ message: 'Invitation not found' });
        }

        const response = await Rsvp.getByGuestEmail(invitation.id, email);
        if (!response) {
            return res.status(404).json({ message: 'No RSVP response found for this email' });
        }

        res.json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving RSVP response' });
    }
};

exports.deleteRsvp = async (req, res) => {
    try {
        const { id } = req.params;
        const { guestEmail } = req.query;

        const rsvpResponse = await Rsvp.verifyGuestAccess(id, guestEmail);
        if (!rsvpResponse) {
            return res.status(404).json({ message: 'RSVP response not found or unauthorized' });
        }

        // Check if wedding date has passed
        if (new Date(rsvpResponse.wedding_date) < new Date()) {
            return res.status(400).json({ message: 'The wedding date has passed' });
        }

        const deleted = await Rsvp.softDelete(id);
        if (!deleted) {
            return res.status(400).json({ message: 'Error deleting RSVP' });
        }

        // Remove email preferences and reminders
        if (rsvpResponse.attending) {
            await EmailPreference.delete(id);
        }

        res.json({ message: 'RSVP deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting RSVP' });
    }
};

exports.softDeleteRsvp = async (req, res) => {
    try {
        const { id } = req.params;
        const { guestEmail } = req.query;

        const rsvpResponse = await Rsvp.verifyGuestAccess(id, guestEmail);
        if (!rsvpResponse) {
            return res.status(404).json({ message: 'RSVP response not found or unauthorized' });
        }

        if (new Date(rsvpResponse.wedding_date) < new Date()) {
            return res.status(400).json({
                message: 'Cannot delete RSVP: The wedding date has passed',
                weddingDate: rsvpResponse.wedding_date
            });
        }

        const deleted = await Rsvp.softDelete(id);
        if (!deleted) {
            return res.status(400).json({ message: 'Error deleting RSVP response' });
        }

        res.json({
            message: 'RSVP response deleted successfully',
            canBeRestored: true,
            restoreWindow: '30 days'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting RSVP response' });
    }
};

exports.restoreRsvp = async (req, res) => {
    try {
        const { id } = req.params;
        const { guestEmail } = req.query;

        // First check if the RSVP exists and is soft-deleted
        const rsvpResponse = await Rsvp.findById(id, true);
        if (!rsvpResponse || !rsvpResponse.deleted_at) {
            return res.status(404).json({ message: 'Deleted RSVP response not found' });
        }

        // Verify guest access
        if (rsvpResponse.guest_email !== guestEmail) {
            return res.status(403).json({ message: 'Not authorized to restore this RSVP' });
        }

        // Check if wedding date has passed
        if (new Date(rsvpResponse.wedding_date) < new Date()) {
            return res.status(400).json({
                message: 'Cannot restore RSVP: The wedding date has passed',
                weddingDate: rsvpResponse.wedding_date
            });
        }

        const restored = await Rsvp.restore(id);
        if (!restored) {
            return res.status(400).json({ message: 'Error restoring RSVP response' });
        }

        // Get updated RSVP data
        const updatedRsvp = await Rsvp.findById(id);

        res.json({
            message: 'RSVP response restored successfully',
            rsvp: updatedRsvp
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error restoring RSVP response' });
    }
}; 