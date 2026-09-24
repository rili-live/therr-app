import { I18nManager } from 'react-native';
import { DEFAULT_SAVINGS_CURRENCY_CODE } from 'therr-js-utilities/constants';

/**
 * Which currency a new savings goal is recorded in.
 *
 * The currency comes from the device **region**, not the app locale. The app locale
 * (`en-us` | `es` | `fr-ca`) names a language: `es` says nothing about whether the user is
 * in Mexico, Spain or Texas. The region subtag of the device locale (`CA` in `fr-CA`) is
 * what implies a currency.
 *
 * The earlier version passed `USD` into `Intl.NumberFormat` and read back
 * `resolvedOptions().currency`. That returns whatever it was given, so every goal was
 * stored as USD whatever the device said (#2955). Hermes has no
 * `Intl.Locale.prototype.getCurrencies`, and `react-native-localize` is not a dependency.
 * So the mapping is the small table below.
 *
 * The result is display only, since nothing in the system converts between currencies.
 * It is written once, when the goal is created, and existing goals keep theirs:
 * changing a stored code after amounts are recorded against it would relabel money.
 */

/**
 * ISO 3166-1 alpha-2 region → ISO 4217 currency. It covers the regions the app is
 * likely to see, not every country. An unlisted region falls back to
 * `DEFAULT_SAVINGS_CURRENCY_CODE`, which is today's behaviour, so a gap is never worse
 * than before.
 */
const REGION_CURRENCIES: Record<string, string> = {
    // North America
    US: 'USD', CA: 'CAD', MX: 'MXN', PR: 'USD',
    // Central America & Caribbean
    GT: 'GTQ', HN: 'HNL', SV: 'USD', NI: 'NIO', CR: 'CRC', PA: 'PAB', DO: 'DOP', CU: 'CUP',
    JM: 'JMD', HT: 'HTG',
    // South America
    AR: 'ARS', BO: 'BOB', BR: 'BRL', CL: 'CLP', CO: 'COP', EC: 'USD', PY: 'PYG', PE: 'PEN',
    UY: 'UYU', VE: 'VES',
    // Euro area
    AT: 'EUR', BE: 'EUR', HR: 'EUR', CY: 'EUR', EE: 'EUR', FI: 'EUR', FR: 'EUR', DE: 'EUR',
    GR: 'EUR', IE: 'EUR', IT: 'EUR', LV: 'EUR', LT: 'EUR', LU: 'EUR', MT: 'EUR', NL: 'EUR',
    PT: 'EUR', SK: 'EUR', SI: 'EUR', ES: 'EUR', AD: 'EUR', MC: 'EUR',
    // Rest of Europe
    GB: 'GBP', CH: 'CHF', NO: 'NOK', SE: 'SEK', DK: 'DKK', IS: 'ISK', PL: 'PLN', CZ: 'CZK',
    HU: 'HUF', RO: 'RON', BG: 'BGN', UA: 'UAH', TR: 'TRY',
    // Africa (francophone West/Central Africa share the two CFA francs)
    MA: 'MAD', DZ: 'DZD', TN: 'TND', SN: 'XOF', CI: 'XOF', ML: 'XOF', BF: 'XOF', CM: 'XAF',
    GA: 'XAF', CD: 'CDF', ZA: 'ZAR', NG: 'NGN', KE: 'KES', EG: 'EGP', GQ: 'XAF',
    // Asia-Pacific
    AU: 'AUD', NZ: 'NZD', JP: 'JPY', CN: 'CNY', HK: 'HKD', TW: 'TWD', KR: 'KRW', IN: 'INR',
    SG: 'SGD', PH: 'PHP', ID: 'IDR', MY: 'MYR', TH: 'THB', VN: 'VND',
    // Middle East
    AE: 'AED', SA: 'SAR', IL: 'ILS',
};

/**
 * The region subtag of a BCP 47 tag, or null when there is none.
 *
 * Accepts both separators (`fr-CA` from `Intl`, `fr_CA` from the native locale
 * identifier). It skips a four-letter script subtag (`zh-Hant-TW`) and stops at an
 * extension singleton (`en-US-u-ca-gregory`, `-x-`), so a private-use suffix is never
 * read as a region. A numeric UN M.49 region (`es-419`, "Latin America") spans many
 * currencies, so it gives no answer rather than a guess.
 */
export const getRegionFromLocale = (locale?: string | null): string | null => {
    if (typeof locale !== 'string' || !locale.trim()) {
        return null;
    }

    const subtags = locale.trim().split(/[-_]/).slice(1);
    for (const subtag of subtags) {
        if (subtag.length === 1) {
            return null;
        }
        if (/^[A-Za-z]{2}$/.test(subtag)) {
            return subtag.toUpperCase();
        }
        if (/^\d{3}$/.test(subtag)) {
            return null;
        }
    }

    return null;
};

/**
 * The currency for the first candidate locale that names a known region, else the
 * default. Candidates are tried in order, so the caller decides which source it trusts
 * most.
 */
export const getCurrencyCodeForLocales = (locales: Array<string | null | undefined>): string => {
    for (const locale of locales) {
        const region = getRegionFromLocale(locale);
        if (region && REGION_CURRENCIES[region]) {
            return REGION_CURRENCIES[region];
        }
    }

    return DEFAULT_SAVINGS_CURRENCY_CODE;
};

/**
 * The device locale, as each source reports it.
 *
 * `Intl` comes first. Hermes resolves its default locale from the OS, so it is the
 * user's device region whatever language the app is running in. The native
 * `I18nManager` identifier is the second opinion, for a runtime whose `Intl` resolves
 * to a bare language. Each read is guarded, because a savings goal is not worth crashing
 * the wizard over and an unanswerable source only costs us the default.
 */
const getDeviceLocaleCandidates = (): Array<string | null | undefined> => {
    const candidates: Array<string | null | undefined> = [];

    try {
        candidates.push(Intl.DateTimeFormat().resolvedOptions().locale);
    } catch {
        // No usable Intl; fall through to the native identifier.
    }

    try {
        candidates.push((I18nManager as any).getConstants?.()?.localeIdentifier);
    } catch {
        // Not exposed on this platform/runtime.
    }

    return candidates;
};

const getDeviceSavingsCurrencyCode = (): string => getCurrencyCodeForLocales(getDeviceLocaleCandidates());

export default getDeviceSavingsCurrencyCode;
