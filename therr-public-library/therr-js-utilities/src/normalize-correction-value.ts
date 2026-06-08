import { parsePhoneNumber } from 'awesome-phonenumber';

export type SpaceCorrectionFieldName = 'phoneNumber' | 'websiteUrl' | 'openingHours';

export interface IOpeningHoursValue {
    schema: string[];
    timezone: string;
}

export interface INormalizeOk<T> {
    ok: true;
    normalized: string;
    canonical: T;
}

export interface INormalizeError {
    ok: false;
    error: string;
}

export type NormalizeResult<T> = INormalizeOk<T> | INormalizeError;

// Recursive stable stringify: sorts object keys at every depth. Array order is
// preserved (semantically meaningful for openingHours.schema which is ordered
// by day-of-week).
const stableStringify = (value: unknown): string => {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
};

const normalizeWebsiteUrl = (raw: string): NormalizeResult<string> => {
    const trimmed = raw.trim();
    if (!trimmed) return { ok: false, error: 'EMPTY_URL' };

    let withScheme = trimmed;
    if (!/^https?:\/\//i.test(withScheme)) {
        withScheme = `https://${withScheme}`;
    }

    let url: URL;
    try {
        url = new URL(withScheme);
    } catch {
        return { ok: false, error: 'INVALID_URL' };
    }

    if (!url.hostname) return { ok: false, error: 'INVALID_URL' };

    let host = url.hostname.toLowerCase();
    if (host.startsWith('www.')) host = host.slice(4);

    // Drop default ports
    let port = url.port;
    if ((url.protocol === 'https:' && port === '443') || (url.protocol === 'http:' && port === '80')) {
        port = '';
    }

    let pathname = url.pathname || '/';
    if (pathname.length > 1 && pathname.endsWith('/')) {
        pathname = pathname.replace(/\/+$/, '');
    }

    const protocol = url.protocol.replace(':', '');
    const hostPort = port ? `${host}:${port}` : host;
    const canonical = `${protocol}://${hostPort}${pathname === '/' ? '' : pathname}`;

    return { ok: true, normalized: canonical, canonical };
};

const normalizePhone = (raw: string): NormalizeResult<string> => {
    const trimmed = raw.trim();
    if (!trimmed) return { ok: false, error: 'EMPTY_PHONE' };
    // Parse directly so we can grab E.164. The shared normalize-phone-number
    // helper returns US-local format ('1 (415) 555-1234') for numbers without
    // a country-code prefix, which is not what corrections want — we need a
    // canonical form (+14155551234) for equality bucketing.
    const regionCode = trimmed.includes('+') ? undefined : 'US';
    let pn;
    try {
        pn = parsePhoneNumber(trimmed, regionCode ? { regionCode } : undefined);
    } catch {
        return { ok: false, error: 'INVALID_PHONE' };
    }
    if (!pn?.valid || !pn.number?.e164) {
        return { ok: false, error: 'INVALID_PHONE' };
    }
    return { ok: true, normalized: pn.number.e164, canonical: pn.number.e164 };
};

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

const normalizeOpeningHours = (raw: unknown): NormalizeResult<IOpeningHoursValue> => {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'INVALID_HOURS_SHAPE' };
    const obj = raw as Record<string, unknown>;
    if (!isStringArray(obj.schema) || obj.schema.length === 0) {
        return { ok: false, error: 'INVALID_HOURS_SCHEMA' };
    }
    if (typeof obj.timezone !== 'string' || !obj.timezone.trim()) {
        return { ok: false, error: 'INVALID_HOURS_TIMEZONE' };
    }
    const canonical: IOpeningHoursValue = {
        schema: obj.schema.map((s) => s.trim().replace(/\s+/g, ' ')),
        timezone: obj.timezone.trim(),
    };
    return { ok: true, normalized: stableStringify(canonical), canonical };
};

export default function normalizeCorrectionValue(
    fieldName: SpaceCorrectionFieldName,
    value: unknown,
): NormalizeResult<unknown> {
    switch (fieldName) {
        case 'phoneNumber':
            if (typeof value !== 'string') return { ok: false, error: 'PHONE_NOT_STRING' };
            return normalizePhone(value);
        case 'websiteUrl':
            if (typeof value !== 'string') return { ok: false, error: 'URL_NOT_STRING' };
            return normalizeWebsiteUrl(value);
        case 'openingHours':
            return normalizeOpeningHours(value);
        default:
            return { ok: false, error: 'UNSUPPORTED_FIELD' };
    }
}
