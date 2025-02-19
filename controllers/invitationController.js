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
            invitation: {
                ...result,
                qrCodeFullUrl: `${process.env.BASE_URL}${result.qrCodeUrl}`
            }
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
            res.json({
                message: 'Invitation updated successfully',
                shareableLink: `${process.env.BASE_URL}/wedding/${existingInvitation.unique_code}`
            });
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

        res.json({
            ...invitation,
            shareableLink: `${process.env.BASE_URL}/wedding/${invitation.unique_code}`,
            qrCodeFullUrl: `${process.env.BASE_URL}${invitation.qr_code_url}`
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving invitation' });
    }
};

exports.getUserInvitations = async (req, res) => {
    try {
        const invitations = await Invitation.findByUserId(req.user.userId);
        const invitationsWithFullUrls = invitations.map(invitation => ({
            ...invitation,
            qrCodeFullUrl: `${process.env.BASE_URL}${invitation.qr_code_url}`
        }));
        res.json(invitationsWithFullUrls);
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

        // Don't expose sensitive information in public view
        const {
            user_id,
            created_at,
            updated_at,
            ...publicInvitation
        } = invitation;

        res.json({
            ...publicInvitation,
            qrCodeFullUrl: `${process.env.BASE_URL}${invitation.qr_code_url}`
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving invitation' });
    }
};

exports.regenerateQRCode = async (req, res) => {
    try {
        const invitationId = req.params.id;
        const result = await Invitation.regenerateQRCode(invitationId, req.user.userId);

        res.json({
            message: 'QR code regenerated successfully',
            qrCodeFullUrl: `${process.env.BASE_URL}${result.qrCodeUrl}`,
            shareableLink: result.shareableLink
        });
    } catch (error) {
        console.error(error);
        if (error.message === 'Invitation not found or unauthorized') {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error regenerating QR code' });
    }
}; 