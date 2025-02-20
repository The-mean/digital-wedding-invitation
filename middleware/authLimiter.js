const rateLimit = require('express-rate-limit');

// Store failed attempts in memory
const failedLoginAttempts = new Map();

// Helper function to calculate remaining time in minutes
const getMinutesUntilReset = (resetTime) => {
    const now = Date.now();
    return Math.ceil((resetTime - now) / 1000 / 60);
};

// Rate limiter for login attempts
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: (req, res) => {
        const timeUntilReset = getMinutesUntilReset(res.getHeaders()['x-ratelimit-reset'] * 1000);
        return {
            status: 429,
            message: 'Too many login attempts. Please try again later.',
            details: {
                remainingTime: `${timeUntilReset} minutes`,
                nextValidAttempt: new Date(Date.now() + (timeUntilReset * 60 * 1000)).toISOString(),
                maxAttempts: 5,
                windowSize: '15 minutes'
            }
        };
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skipSuccessfulRequests: true, // Don't count successful logins against the limit
    keyGenerator: (req) => {
        // Use both IP and email (if provided) as the rate limit key
        return req.body.email ? `${req.ip}-${req.body.email}` : req.ip;
    },
    handler: (req, res) => {
        const key = req.body.email ? `${req.ip}-${req.body.email}` : req.ip;
        const attempts = failedLoginAttempts.get(key) || 0;
        failedLoginAttempts.set(key, attempts + 1);

        const timeUntilReset = getMinutesUntilReset(res.getHeaders()['x-ratelimit-reset'] * 1000);
        res.status(429).json({
            status: 429,
            message: 'Too many login attempts. Please try again later.',
            details: {
                remainingTime: `${timeUntilReset} minutes`,
                nextValidAttempt: new Date(Date.now() + (timeUntilReset * 60 * 1000)).toISOString(),
                maxAttempts: 5,
                windowSize: '15 minutes',
                failedAttempts: attempts + 1
            }
        });
    }
});

// Rate limiter for registration attempts
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 registration attempts per hour
    message: (req, res) => {
        const timeUntilReset = getMinutesUntilReset(res.getHeaders()['x-ratelimit-reset'] * 1000);
        return {
            status: 429,
            message: 'Too many registration attempts. Please try again later.',
            details: {
                remainingTime: `${timeUntilReset} minutes`,
                nextValidAttempt: new Date(Date.now() + (timeUntilReset * 60 * 1000)).toISOString(),
                maxAttempts: 3,
                windowSize: '1 hour'
            }
        };
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use both IP and email for registration rate limiting
        return `${req.ip}-${req.body.email || ''}`;
    }
});

// Rate limiter for password reset attempts
const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 reset attempts per hour
    message: (req, res) => {
        const timeUntilReset = getMinutesUntilReset(res.getHeaders()['x-ratelimit-reset'] * 1000);
        return {
            status: 429,
            message: 'Too many password reset attempts. Please try again later.',
            details: {
                remainingTime: `${timeUntilReset} minutes`,
                nextValidAttempt: new Date(Date.now() + (timeUntilReset * 60 * 1000)).toISOString(),
                maxAttempts: 3,
                windowSize: '1 hour'
            }
        };
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return `${req.ip}-${req.body.email || ''}`;
    }
});

// Cleanup failed attempts periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of failedLoginAttempts.entries()) {
        if (now - timestamp > 15 * 60 * 1000) { // 15 minutes
            failedLoginAttempts.delete(key);
        }
    }
}, 5 * 60 * 1000); // Run cleanup every 5 minutes

module.exports = {
    loginLimiter,
    registerLimiter,
    passwordResetLimiter
}; 