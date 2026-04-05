const LOCALE_MAP: Record<string, string> = {
    'en-us': 'en-US',
    en: 'en-US',
    es: 'es',
    'fr-ca': 'fr-CA',
    fr: 'fr-CA',
};

export const toIntlLocale = (appLocale: string): string => LOCALE_MAP[appLocale?.toLowerCase()] || 'en-US';

export const formatDate = (dateStr: string, locale: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString(toIntlLocale(locale), {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

export const formatDateTime = (dateStr: string, locale: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString(toIntlLocale(locale), {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

export const formatEventDate = (dateStr: string, locale: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString(toIntlLocale(locale), {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};
