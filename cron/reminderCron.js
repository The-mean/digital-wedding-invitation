const cron = require('node-cron');
const EmailService = require('../services/emailService');

// Run every hour
cron.schedule('0 * * * *', async () => {
    console.log('Processing email reminders...');
    try {
        await EmailService.processReminders();
        console.log('Email reminders processed successfully');
    } catch (error) {
        console.error('Error processing email reminders:', error);
    }
}); 