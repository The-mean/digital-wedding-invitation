const cron = require('node-cron');
const RefreshToken = require('../models/RefreshToken');

// Run every day at midnight
cron.schedule('0 0 * * *', async () => {
    console.log('Starting refresh token cleanup...');
    try {
        const deletedCount = await RefreshToken.cleanup();
        console.log(`Cleaned up ${deletedCount} expired refresh tokens`);
    } catch (error) {
        console.error('Error during refresh token cleanup:', error);
    }
}); 