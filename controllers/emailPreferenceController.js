const EmailPreference = require('../models/EmailPreference');
const Rsvp = require('../models/Rsvp');

exports.updatePreferences = async (req, res) => {
    try {
        const { code } = req.params;
        const { email } = req.query;
        const preferences = req.body;

        // Find the RSVP response
        const invitation = await Rsvp.findByInvitationCode(code);
        if (!invitation) {
            return res.status(404).json({ message: 'Invitation not found' });
        }

        const rsvpResponse = await Rsvp.getByGuestEmail(invitation.id, email);
        if (!rsvpResponse) {
            return res.status(404).json({ message: 'RSVP response not found' });
        }

        // Update preferences
        const updated = await EmailPreference.update(rsvpResponse.id, {
            reminderEnabled: preferences.reminderEnabled,
            oneMonthReminder: preferences.oneMonthReminder,
            oneWeekReminder: preferences.oneWeekReminder,
            oneDayReminder: preferences.oneDayReminder
        });

        if (updated) {
            res.json({ message: 'Email preferences updated successfully' });
        } else {
            res.status(400).json({ message: 'Error updating email preferences' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating email preferences' });
    }
};

exports.getPreferences = async (req, res) => {
    try {
        const { code } = req.params;
        const { email } = req.query;

        // Find the RSVP response
        const invitation = await Rsvp.findByInvitationCode(code);
        if (!invitation) {
            return res.status(404).json({ message: 'Invitation not found' });
        }

        const rsvpResponse = await Rsvp.getByGuestEmail(invitation.id, email);
        if (!rsvpResponse) {
            return res.status(404).json({ message: 'RSVP response not found' });
        }

        // Get preferences
        const preferences = await EmailPreference.getByRsvpResponseId(rsvpResponse.id);
        if (!preferences) {
            return res.status(404).json({ message: 'Email preferences not found' });
        }

        res.json(preferences);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving email preferences' });
    }
}; 