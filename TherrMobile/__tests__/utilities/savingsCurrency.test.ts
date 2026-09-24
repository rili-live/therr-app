import getDeviceSavingsCurrencyCode, {
    getCurrencyCodeForLocales,
    getRegionFromLocale,
} from '../../main/utilities/savingsCurrency';

/**
 * The currency a new savings goal is stored in (#2955).
 *
 * The earlier version passed `USD` into `Intl.NumberFormat` and read the currency back
 * off `resolvedOptions()`, so it returned USD whatever the device said. A Canadian user
 * got a USD goal and nothing reported it. These pin the two properties that matter: the
 * device region decides, and anything unknown falls back to the default without
 * throwing.
 */
describe('getRegionFromLocale', () => {
    it('reads the region from either separator', () => {
        expect(getRegionFromLocale('fr-CA')).toBe('CA');
        expect(getRegionFromLocale('fr_CA')).toBe('CA');
        expect(getRegionFromLocale('en-gb')).toBe('GB');
    });

    it('skips a script subtag', () => {
        expect(getRegionFromLocale('zh-Hant-TW')).toBe('TW');
    });

    it('never reads an extension or private-use subtag as a region', () => {
        expect(getRegionFromLocale('en-US-u-ca-gregory')).toBe('US');
        expect(getRegionFromLocale('en-u-nu-latn')).toBeNull();
        expect(getRegionFromLocale('en-x-ab')).toBeNull();
    });

    it('gives no answer for a bare language or a multi-country UN M.49 region', () => {
        // `es` names a language, not a country. That is the whole reason the app
        // locale cannot choose a currency.
        expect(getRegionFromLocale('es')).toBeNull();
        expect(getRegionFromLocale('es-419')).toBeNull();
        expect(getRegionFromLocale('')).toBeNull();
        expect(getRegionFromLocale(undefined)).toBeNull();
    });
});

describe('getCurrencyCodeForLocales', () => {
    it('maps a Canadian device to CAD, which is the case the bug hid', () => {
        expect(getCurrencyCodeForLocales(['fr-CA'])).toBe('CAD');
        expect(getCurrencyCodeForLocales(['en-CA'])).toBe('CAD');
    });

    it('distinguishes Spanish speakers by region, not language', () => {
        expect(getCurrencyCodeForLocales(['es-MX'])).toBe('MXN');
        expect(getCurrencyCodeForLocales(['es-ES'])).toBe('EUR');
        expect(getCurrencyCodeForLocales(['es-US'])).toBe('USD');
    });

    it('falls through to the next candidate when one has no usable region', () => {
        expect(getCurrencyCodeForLocales(['es', 'es_AR'])).toBe('ARS');
        expect(getCurrencyCodeForLocales([undefined, null, 'en-GB'])).toBe('GBP');
    });

    it('falls back to the default for an unknown region or no candidates', () => {
        expect(getCurrencyCodeForLocales(['en-ZZ'])).toBe('USD');
        expect(getCurrencyCodeForLocales(['es-419'])).toBe('USD');
        expect(getCurrencyCodeForLocales([])).toBe('USD');
    });
});

describe('getDeviceSavingsCurrencyCode', () => {
    const originalDateTimeFormat = Intl.DateTimeFormat;

    afterEach(() => {
        (Intl as any).DateTimeFormat = originalDateTimeFormat;
    });

    it('uses the device locale Intl resolves', () => {
        (Intl as any).DateTimeFormat = function DateTimeFormatMock() {
            return { resolvedOptions: () => ({ locale: 'fr-CA' }) };
        };

        expect(getDeviceSavingsCurrencyCode()).toBe('CAD');
    });

    it('does not throw when Intl is unusable, and never returns anything but a code', () => {
        (Intl as any).DateTimeFormat = function DateTimeFormatMock() {
            throw new Error('no ICU data');
        };

        expect(getDeviceSavingsCurrencyCode()).toMatch(/^[A-Z]{3}$/);
    });
});
