import { it, describe, expect } from '@jest/globals';
import { formatCalendarDate } from '../../main/utilities/formatCalendarDate';

/**
 * `formatCalendarDate` replaces `toLocaleDateString()` on the pact timeline, which was called
 * with no locale tag at all — so it rendered in the *device's* language while every other
 * string on the screen came from the app's. It resolves month names from the dictionary for
 * the same reason `formatDayTitle` does: Hermes on Android is not guaranteed to carry ICU data
 * for every locale this app ships, so even a correctly-tagged `Intl` call can fall back to
 * English.
 */

// Stands in for the real dictionary, with en-us and es orderings — the point of holding the
// format in a translated key rather than a template literal is that the two differ.
const DICTIONARIES: Record<string, Record<string, string>> = {
    'en-us': {
        'dateTime.monthDayYear': '{month} {day}, {year}',
        'dateTime.months.september': 'September',
        'dateTime.months.january': 'January',
    },
    es: {
        'dateTime.monthDayYear': '{day} de {month} de {year}',
        'dateTime.months.september': 'Septiembre',
        'dateTime.months.january': 'Enero',
    },
};

const translatorFor = (locale: string) => (key: string, params: any = {}) => {
    const template = DICTIONARIES[locale][key];
    if (template === undefined) {
        return key;
    }
    return template.replace(/\{(\w+)\}/g, (_match, name) => String(params[name]));
};

describe('formatCalendarDate', () => {
    it('renders the date in the app locale, not the device locale', () => {
        const date = new Date(2026, 8, 15);

        expect(formatCalendarDate(date, translatorFor('en-us'))).toBe('September 15, 2026');
        expect(formatCalendarDate(date, translatorFor('es'))).toBe('15 de Septiembre de 2026');
    });

    it('takes its field order from the dictionary, not from the code', () => {
        const date = new Date(2026, 0, 3);

        expect(formatCalendarDate(date, translatorFor('en-us'))).toBe('January 3, 2026');
        expect(formatCalendarDate(date, translatorFor('es'))).toBe('3 de Enero de 2026');
    });

    it('accepts the ISO timestamp the pacts API returns', () => {
        // Local noon, so the rendered day is the same in every timezone CI might run in.
        const iso = new Date(2026, 8, 15, 12).toISOString();

        expect(formatCalendarDate(iso, translatorFor('en-us'))).toBe('September 15, 2026');
    });

    it('reads local calendar fields, so an instant renders as the day it was lived in', () => {
        const date = new Date(2026, 8, 15, 23, 50);

        expect(formatCalendarDate(date, translatorFor('en-us'))).toBe('September 15, 2026');
    });

    it('returns an empty string rather than "Invalid Date" for junk or nothing', () => {
        const translate = translatorFor('en-us');

        expect(formatCalendarDate(null, translate)).toBe('');
        expect(formatCalendarDate(undefined, translate)).toBe('');
        expect(formatCalendarDate('', translate)).toBe('');
        expect(formatCalendarDate('not-a-date', translate)).toBe('');
    });
});
