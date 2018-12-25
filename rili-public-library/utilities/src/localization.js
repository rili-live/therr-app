export const normalizeLocale = locale => locale.toLowerCase().replace('_', '-');

export const fallbackToLocale = (originalLocale) => {
    // Fallback from locale to language, then fallback to 'en',
    // eg: pt-BR => pt => en
    if (originalLocale.includes('-')) {
        return originalLocale.split('-')[0];
    }
    if (originalLocale !== 'en') {
        return 'en';
    }
    return null;
};

export const configureTranslator = (translations) => {
    const translateInternal = (locale, key, params) => {
        if (!translations[locale]) {
            return null;
        }
        const propertyArray = key.split('.');
        let translatedValue = translations[locale];
        propertyArray.forEach((property) => {
            if (!translatedValue || !translatedValue[property]) {
                translatedValue = null;
            } else {
                translatedValue = translatedValue[property];
            }
        });

        if (translatedValue && typeof params === 'object') {
            Object.keys(params).forEach((param) => {
                translatedValue = translatedValue.replace(`{${param}}`, params[param]);
            });
        }

        return translatedValue;
    };

    return (locale, key, params) => {
        let newLocale = normalizeLocale(locale);
        let translatedValue = translateInternal(newLocale, key, params);
        while (!translatedValue) {
            newLocale = fallbackToLocale(newLocale);
            if (!newLocale) {
                break;
            }
            translatedValue = translateInternal(newLocale, key, params);
        }

        return translatedValue;
    };
};
