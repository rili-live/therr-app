export const normalizeLocale = (locale: string) => locale.toLowerCase().replace('_', '-');

export const fallbackToLocale = (originalLocale: string) => {
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

export const configureTranslator = (translations: any) => {
    const translateInternal = (locale: string, params?: any, key = '') => {
        if (!translations[locale]) {
            return null;
        }
        const propertyArray = key.split('.');
        let translatedValue = translations[locale];
        propertyArray.forEach((property: string) => {
            if (!translatedValue || !translatedValue[property]) {
                translatedValue = null;
            } else {
                translatedValue = translatedValue[property];
            }
        });

        // Easter Eag
        if (propertyArray[0] === 'quoteOfTheDay') {
            const totalQuotes = translations[locale].dailyQuotes.length - 1;
            const index = Math.floor(Math.random() * totalQuotes);
            return `${translations[locale].dailyQuotes[index].quote} - ${translations[locale].dailyQuotes[index].author}`; // eslint-disable-line max-len
        }

        if (translatedValue && typeof params === 'object' && params != null) {
            Object.keys(params).forEach((param) => {
                translatedValue = translatedValue.replace(`{${param}}`, params[param]);
            });
        }

        return translatedValue || key;
    };

    return (locale: string, key: string, params?: any) => {
        let newLocale = normalizeLocale(locale);
        let translatedValue = translateInternal(newLocale, params, key);
        while (!translatedValue) {
            newLocale = fallbackToLocale(newLocale);
            if (!newLocale) {
                break;
            }
            translatedValue = translateInternal(newLocale, params, key);
        }

        return translatedValue;
    };
};
