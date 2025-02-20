const { logApiRequest, logApiError } = require('../services/loggerService');

const apiLogger = (req, res, next) => {
    // İstek başlangıç zamanını kaydet
    req.startTime = Date.now();

    // Orijinal res.json metodunu kaydet
    const originalJson = res.json;

    // res.json metodunu override et
    res.json = function (data) {
        const responseTime = Date.now() - req.startTime;

        // İsteği logla
        logApiRequest(req, {
            responseTime,
            statusCode: res.statusCode,
            responseData: data
        });

        // Orijinal res.json metodunu çağır
        return originalJson.call(this, data);
    };

    // Hata yakalama
    const errorHandler = (error) => {
        const responseTime = Date.now() - req.startTime;
        logApiError(req, error, { responseTime });
    };

    // Error event listener ekle
    res.on('error', errorHandler);

    next();
};

module.exports = apiLogger; 