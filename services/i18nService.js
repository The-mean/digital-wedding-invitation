const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const path = require('path');

i18next
    .use(Backend)
    .init({
        fallbackLng: 'tr',
        supportedLngs: ['tr', 'en'],
        ns: ['translation'],
        defaultNS: 'translation',
        backend: {
            loadPath: path.join(__dirname, '../locales/{{lng}}.json')
        },
        interpolation: {
            escapeValue: false
        }
    });

const translate = (key, lng = 'tr', options = {}) => {
    return i18next.t(key, { lng, ...options });
};

const changeLanguage = async (lng) => {
    if (!['tr', 'en'].includes(lng)) {
        throw new Error('Unsupported language');
    }
    await i18next.changeLanguage(lng);
};

const getCurrentLanguage = () => {
    return i18next.language;
};

const isLanguageSupported = (lng) => {
    return ['tr', 'en'].includes(lng);
};

module.exports = {
    translate,
    changeLanguage,
    getCurrentLanguage,
    isLanguageSupported
}; 