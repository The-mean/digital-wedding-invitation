const Rsvp = require('../models/Rsvp');
const Invitation = require('../models/Invitation');
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

        // Check if the wedding date has passed
        if (new Date(invitation.wedding_date) < new Date()) {
            return res.status(400).json({ message: 'The wedding date has passed' });
        }

        const rsvpData = {
            guestName: req.body.guestName,
            guestEmail: req.body.guestEmail,
            attending: req.body.attending,
            numberOfGuests: req.body.numberOfGuests,
            dietaryRequirements: req.body.dietaryRequirements,
            message: req.body.message
        };

        // Check for duplicate response
        const isDuplicate = await Rsvp.checkDuplicateResponse(invitation.id, rsvpData.guestEmail);
        if (isDuplicate) {
            return res.status(400).json({ message: 'You have already responded to this invitation' });
        }

        await Rsvp.create(invitation.id, rsvpData);

        // Send confirmation email
        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: rsvpData.guestEmail,
            subject: `RSVP Confirmation - ${invitation.title}`,
            html: `
                <h2>Thank you for your RSVP response!</h2>
                <p>We have received your response for the following event:</p>
                <p><strong>${invitation.title}</strong></p>
                <p>Your response: ${rsvpData.attending ? 'Attending' : 'Not Attending'}</p>
                ${rsvpData.attending ? `<p>Number of guests: ${rsvpData.numberOfGuests}</p>` : ''}
                <p>Date: ${new Date(invitation.wedding_date).toLocaleDateString()}</p>
                ${rsvpData.dietaryRequirements ? `<p>Dietary requirements: ${rsvpData.dietaryRequirements}</p>` : ''}
            `
        });

        res.status(201).json({ message: 'RSVP submitted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error submitting RSVP' });
    }
};

exports.updateRsvp = async (req, res) => {
    try {
        const { code } = req.params;
        const invitation = await Invitation.findByCode(code);

        if (!invitation) {
            return res.status(404).json({ message: 'Invitation not found' });
        }

        // Check if the wedding date has passed
        if (new Date(invitation.wedding_date) < new Date()) {
            return res.status(400).json({ message: 'The wedding date has passed' });
        }

        const rsvpData = {
            guestName: req.body.guestName,
            attending: req.body.attending,
            numberOfGuests: req.body.numberOfGuests,
            dietaryRequirements: req.body.dietaryRequirements,
            message: req.body.message
        };

        const updated = await Rsvp.update(invitation.id, req.body.guestEmail, rsvpData);

        if (!updated) {
            return res.status(404).json({ message: 'RSVP response not found' });
        }

        res.json({ message: 'RSVP updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating RSVP' });
    }
};

exports.getRsvpResponses = async (req, res) => {
    try {
        const invitation = await Invitation.findById(req.params.id);

        if (!invitation) {
            return res.status(404).json({ message: 'Invitation not found' });
        }

        if (invitation.user_id !== req.user.userId) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const responses = await Rsvp.getByInvitationId(invitation.id);
        const summary = await Rsvp.getResponseSummary(invitation.id);

        res.json({
            responses,
            summary
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