const { isLanguageSupported } = require('../services/i18nService');

const languageMiddleware = (req, res, next) => {
    // Dil tercihini al (öncelik sırası: query param > header > cookie > default)
    let lang = req.query.lang ||
        req.headers['accept-language']?.split(',')[0]?.split('-')[0] ||
        req.cookies.preferredLanguage ||
        'tr';

    // Dil desteği kontrolü
    if (!isLanguageSupported(lang)) {
        lang = 'tr'; // Desteklenmeyen dil için varsayılan dile dön
    }

    // Dil tercihini request nesnesine ekle
    req.language = lang;

    // Dil tercihini cookie olarak kaydet (30 gün)
    res.cookie('preferredLanguage', lang, {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });

    next();
};

module.exports = languageMiddleware; 