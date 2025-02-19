const Invitation = require('../models/Invitation');
const fs = require('fs').promises;
const path = require('path');

exports.createInvitation = async (req, res) => {
    try {
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

        const invitationData = {
            title: req.body.title,
            message: req.body.message,
            imageUrl,
            weddingDate: new Date(req.body.weddingDate),
            rsvpLink: req.body.rsvpLink
        };

        const result = await Invitation.create(req.user.userId, invitationData);
        res.status(201).json({
            message: 'Invitation created successfully',
            invitation: result
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating invitation' });
    }
};

exports.updateInvitation = async (req, res) => {
    try {
        const invitationId = req.params.id;
        const existingInvitation = await Invitation.findById(invitationId);

        if (!existingInvitation) {
            return res.status(404).json({ message: 'Invitation not found' });
        }

        if (existingInvitation.user_id !== req.user.userId) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        let imageUrl = existingInvitation.image_url;
        if (req.file) {
            // Delete old image if exists
            if (existingInvitation.image_url) {
                const oldImagePath = path.join('public', existingInvitation.image_url);
                await fs.unlink(oldImagePath).catch(err => console.error('Error deleting old image:', err));
            }
            imageUrl = `/uploads/${req.file.filename}`;
        }

        const invitationData = {
            title: req.body.title,
            message: req.body.message,
            imageUrl,
            weddingDate: new Date(req.body.weddingDate),
            rsvpLink: req.body.rsvpLink
        };

        const updated = await Invitation.update(invitationId, req.user.userId, invitationData);

        if (updated) {
            res.json({ message: 'Invitation updated successfully' });
        } else {
            res.status(400).json({ message: 'Error updating invitation' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating invitation' });
    }
};

exports.deleteInvitation = async (req, res) => {
    try {
        const invitationId = req.params.id;
        const invitation = await Invitation.findById(invitationId);

        if (!invitation) {
            return res.status(404).json({ message: 'Invitation not found' });
        }

        if (invitation.user_id !== req.user.userId) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Delete associated files
        if (invitation.image_url) {
            const imagePath = path.join('public', invitation.image_url);
            await fs.unlink(imagePath).catch(err => console.error('Error deleting image:', err));
        }

        if (invitation.qr_code_url) {
            const qrCodePath = path.join('public', invitation.qr_code_url);
            await fs.unlink(qrCodePath).catch(err => console.error('Error deleting QR code:', err));
        }

        const deleted = await Invitation.delete(invitationId, req.user.userId);

        if (deleted) {
            res.json({ message: 'Invitation deleted successfully' });
        } else {
            res.status(400).json({ message: 'Error deleting invitation' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting invitation' });
    }
};

exports.getInvitation = async (req, res) => {
    try {
        const invitation = await Invitation.findById(req.params.id);

        if (!invitation) {
            return res.status(404).json({ message: 'Invitation not found' });
        }

        if (invitation.user_id !== req.user.userId) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        res.json(invitation);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving invitation' });
    }
};

exports.getUserInvitations = async (req, res) => {
    try {
        const invitations = await Invitation.findByUserId(req.user.userId);
        res.json(invitations);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving invitations' });
    }
};

exports.getPublicInvitation = async (req, res) => {
    try {
        const invitation = await Invitation.findByCode(req.params.code);

        if (!invitation) {
            return res.status(404).json({ message: 'Invitation not found' });
        }

        res.json(invitation);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving invitation' });
    }
}; 