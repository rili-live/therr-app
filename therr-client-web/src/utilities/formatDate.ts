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
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(toIntlLocale(locale), {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

/** What `formatTimeAgo` needs from a `useTranslation()` result. */
type TranslateFn = (key: string, params?: Record<string, any>) => string;

/**
 * Relative "time ago" label for feed timestamps ("3m", "5h", "2d", then an absolute date).
 *
 * Lifted here from ExploreThoughts once a third surface (the repost embed) needed it. The copy
 * in ViewThought.tsx hardcoded 'en-US' and so rendered English month names inside the Spanish
 * and French pages; routing every caller through this one keeps that from drifting back.
 *
 * `translate` is optional only so a non-rendering caller can format a timestamp without
 * standing up the hook — every UI caller should pass it. Without it the units fall back to
 * their English forms, which is the bug this parameter exists to close: "just now" and the
 * day suffix "d" are English, and French abbreviates days as "j".
 */
export const formatTimeAgo = (dateStr: string, locale: string, translate?: TranslateFn): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    // therr-ai-automator drips a run's output out by writing future-dated rows, so diffMs is
    // legitimately negative here — which lands in this first branch, the same as a brand new
    // post. That is the intended reading: a post dated ahead of now is "just now", never "-3m".
    if (diffMin < 1) return translate ? translate('common.justNow') : 'just now';
    if (diffMin < 60) return translate ? translate('common.minutesAgo', { count: diffMin }) : `${diffMin}m`;
    if (diffHr < 24) return translate ? translate('common.hoursAgo', { count: diffHr }) : `${diffHr}h`;
    if (diffDay < 7) return translate ? translate('common.daysAgo', { count: diffDay }) : `${diffDay}d`;
    return date.toLocaleDateString(toIntlLocale(locale), { month: 'short', day: 'numeric' });
};

export const formatDateTime = (dateStr: string, locale: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '';
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
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(toIntlLocale(locale), {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};
