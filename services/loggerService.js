const winston = require('winston');
const path = require('path');
require('winston-daily-rotate-file');

// Log formatını yapılandır
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// API istekleri için logger oluştur
const apiLogger = winston.createLogger({
    format: logFormat,
    transports: [
        new winston.transports.DailyRotateFile({
            filename: path.join('logs', 'api-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            level: 'info'
        }),
        new winston.transports.DailyRotateFile({
            filename: path.join('logs', 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            level: 'error'
        })
    ]
});

// Geliştirme ortamında konsola da log ekle
if (process.env.NODE_ENV !== 'production') {
    apiLogger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

// Hassas verileri temizle
const sanitizeData = (data) => {
    const sensitiveFields = ['password', 'token', 'refreshToken', 'authorization'];
    const sanitized = { ...data };

    sensitiveFields.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = '[HIDDEN]';
        }
        if (sanitized.body && sanitized.body[field]) {
            sanitized.body[field] = '[HIDDEN]';
        }
        if (sanitized.headers && sanitized.headers[field]) {
            sanitized.headers[field] = '[HIDDEN]';
        }
    });

    return sanitized;
};

const logApiRequest = (req, data = {}) => {
    const logData = {
        timestamp: new Date().toISOString(),
        ip: req.ip,
        method: req.method,
        url: req.originalUrl,
        userId: req.user?.userId,
        userAgent: req.headers['user-agent'],
        body: req.body,
        params: req.params,
        query: req.query,
        ...data
    };

    apiLogger.info('API Request', sanitizeData(logData));
};

const logApiError = (req, error, data = {}) => {
    const logData = {
        timestamp: new Date().toISOString(),
        ip: req.ip,
        method: req.method,
        url: req.originalUrl,
        userId: req.user?.userId,
        userAgent: req.headers['user-agent'],
        error: {
            message: error.message,
            stack: error.stack,
            code: error.code
        },
        ...data
    };

    apiLogger.error('API Error', sanitizeData(logData));
};

const logSecurityEvent = (req, eventType, data = {}) => {
    const logData = {
        timestamp: new Date().toISOString(),
        ip: req.ip,
        method: req.method,
        url: req.originalUrl,
        userId: req.user?.userId,
        userAgent: req.headers['user-agent'],
        eventType,
        ...data
    };

    apiLogger.warn('Security Event', sanitizeData(logData));
};

module.exports = {
    logApiRequest,
    logApiError,
    logSecurityEvent
}; 