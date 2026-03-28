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

export type TranslateParams = Record<string, string | number>;

export const configureTranslator = (translations: Record<string, Record<string, unknown>>) => {
    const translateInternal = (locale: string, params?: TranslateParams, key = ''): string | null => {
        if (!translations[locale]) {
            return null;
        }
        const propertyArray = key.split('.');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let translatedValue: any = translations[locale];
        propertyArray.forEach((property: string) => {
            if (!translatedValue || !translatedValue[property]) {
                translatedValue = null;
            } else {
                translatedValue = translatedValue[property];
            }
        });

        // Easter Eag
        if (propertyArray[0] === 'quoteOfTheDay') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const localeTranslations = translations[locale] as any;
            const totalQuotes = localeTranslations.dailyQuotes.length - 1;
            const index = Math.floor(Math.random() * totalQuotes);
            return `${localeTranslations.dailyQuotes[index].quote} - ${localeTranslations.dailyQuotes[index].author}`; // eslint-disable-line max-len
        }

        if (translatedValue && typeof translatedValue === 'string' && typeof params === 'object' && params != null) {
            Object.keys(params).forEach((param) => {
                translatedValue = translatedValue.replace(`{${param}}`, String(params[param]));
            });
        }

        return translatedValue || key;
    };

    return (locale: string, key: string, params?: TranslateParams): string | null => {
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
