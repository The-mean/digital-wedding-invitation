const nodemailer = require('nodemailer');
const EmailReminder = require('../models/EmailReminder');
const EmailPreference = require('../models/EmailPreference');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

class EmailService {
    static async sendReminderEmail(reminder) {
        const {
            title,
            wedding_date,
            guest_name,
            guest_email,
            reminder_type
        } = reminder;

        const weddingDate = new Date(wedding_date);
        const formattedDate = weddingDate.toLocaleDateString('tr-TR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        let subject, timeframe;
        switch (reminder_type) {
            case 'one_month':
                timeframe = 'bir ay';
                break;
            case 'one_week':
                timeframe = 'bir hafta';
                break;
            case 'one_day':
                timeframe = 'bir gün';
                break;
        }

        subject = `Düğün Hatırlatması - ${title}`;

        const html = `
            <h2>Sevgili ${guest_name},</h2>
            <p>Size katılacağınızı bildirdiğiniz düğün için bir hatırlatma göndermek istedik.</p>
            <p><strong>${title}</strong> düğününe ${timeframe} kaldı!</p>
            <p><strong>Düğün Tarihi:</strong> ${formattedDate}</p>
            <p>Katılımınız için teşekkür ederiz.</p>
            <p>Görüşmek üzere!</p>
        `;

        try {
            await transporter.sendMail({
                from: process.env.SMTP_USER,
                to: guest_email,
                subject,
                html
            });

            await EmailReminder.markAsSent(reminder.id);
            await EmailPreference.updateLastReminderSent(reminder.rsvp_response_id);
        } catch (error) {
            console.error('Error sending reminder email:', error);
            await EmailReminder.markAsFailed(reminder.id);
            throw error;
        }
    }

    static async processReminders() {
        try {
            const pendingReminders = await EmailReminder.getPendingReminders();

            for (const reminder of pendingReminders) {
                if (reminder.reminder_type_enabled) {
                    await this.sendReminderEmail(reminder);
                }
            }
        } catch (error) {
            console.error('Error processing reminders:', error);
            throw error;
        }
    }
}

module.exports = EmailService; 