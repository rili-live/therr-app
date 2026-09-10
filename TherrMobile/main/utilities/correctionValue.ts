/**
 * Client-side validation and preview for crowdsourced space corrections
 * ("suggest an edit").
 *
 * The authoritative normalizer is `therr-js-utilities/normalize-correction-value`,
 * which the maps-service runs on every submission. It is deliberately NOT
 * imported here: it depends on `awesome-phonenumber`, which is not in
 * TherrMobile's package.json (see the same reasoning in `authIdentifier.ts`) and
 * would pull full libphonenumber metadata into the bundle for what is only a
 * "will be saved as" hint plus a submit-button gate.
 *
 * These rules mirror the server's canonical forms for the shapes a mobile user
 * actually types, and error codes reuse the server's vocabulary so both paths
 * resolve to the same locale keys. When the two disagree, the server wins: it
 * re-normalizes whatever we send and its rejection is surfaced in the modal.
 */

export type CorrectionFieldName = 'phoneNumber' | 'websiteUrl';

export interface ICorrectionValueOk {
    ok: true;
    canonical: string;
}

export interface ICorrectionValueError {
    ok: false;
    /** Matches the server normalizer's error codes (EMPTY_PHONE, INVALID_URL, ...). */
    error: string;
}

export type CorrectionValueResult = ICorrectionValueOk | ICorrectionValueError;

// Hostname with at least one dot-separated label and a TLD. Stricter than the
// server (which accepts anything `new URL()` parses, including `localhost`),
// which is the safe direction: it only blocks values no real business website has.
// `¡-￿` keeps internationalized domains (café.fr, 東京.jp) valid. There is no
// punycode encoder in the bundle, so the preview shows the unicode form while
// the server stores the encoded one (xn--caf-dma.fr) — the submitted value
// still buckets correctly because the server re-normalizes it.
const HOSTNAME_REGEX = /^[a-z0-9¡-￿]([a-z0-9¡-￿-]*[a-z0-9¡-￿])?(\.[a-z0-9¡-￿]([a-z0-9¡-￿-]*[a-z0-9¡-￿])?)+$/;

/**
 * E.164 canonicalization for the numbers people type into a phone field.
 *
 * Numbers with an explicit `+` keep their country code. Bare numbers are treated
 * as US/NANP, matching the server's `regionCode: 'US'` default.
 */
const normalizePhone = (raw: string): CorrectionValueResult => {
    const trimmed = raw.trim();
    if (!trimmed) {
        return { ok: false, error: 'EMPTY_PHONE' };
    }

    // Businesses commonly publish an extension. The server drops it from the
    // canonical number, so strip it here too rather than failing the value.
    const withoutExtension = trimmed.replace(/\s*(?:ext\.?|ext\.?n?|x|#|poste)\s*\d+\s*$/i, '').trim();

    // Reject letters and other junk so "call us at ..." doesn't get silently
    // stripped down to a number that happens to have the right digit count.
    if (!withoutExtension || !/^[+()\-.\s\d]+$/.test(withoutExtension)) {
        return { ok: false, error: 'INVALID_PHONE' };
    }

    const digits = withoutExtension.replace(/\D/g, '');

    if (withoutExtension.startsWith('+')) {
        // E.164 allows 1-3 digits of country code plus up to 12 of subscriber number.
        // Country-code assignment can't be checked without libphonenumber metadata,
        // so an unassigned prefix gets through here and is rejected by the server.
        if (digits.length < 8 || digits.length > 15) {
            return { ok: false, error: 'INVALID_PHONE' };
        }
        return { ok: true, canonical: `+${digits}` };
    }

    // NANP: 10 digits, or 11 with the '1' trunk prefix.
    const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
    if (national.length !== 10) {
        return { ok: false, error: 'INVALID_PHONE' };
    }
    // NANP area codes and central-office codes both start 2-9. Catches the
    // repeated-digit junk that would otherwise pass a bare length check.
    if (!/^[2-9]\d\d[2-9]\d{6}$/.test(national)) {
        return { ok: false, error: 'INVALID_PHONE' };
    }

    return { ok: true, canonical: `+1${national}` };
};

/**
 * Canonical URL form: lowercase host, no `www.`, no default port, no query or
 * fragment, no trailing slash. Mirrors the server, which builds its canonical
 * from `URL`'s protocol/host/port/pathname and drops the rest.
 */
const normalizeWebsiteUrl = (raw: string): CorrectionValueResult => {
    const trimmed = raw.trim();
    if (!trimmed) {
        return { ok: false, error: 'EMPTY_URL' };
    }
    if (/\s/.test(trimmed)) {
        return { ok: false, error: 'INVALID_URL' };
    }

    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const match = withScheme.match(/^(https?):\/\/([^/?#]+)([^?#]*)/i);
    if (!match) {
        return { ok: false, error: 'INVALID_URL' };
    }

    const protocol = match[1].toLowerCase();
    // Drop any `user:pass@` prefix, as `URL.hostname` does.
    const authority = match[2].slice(match[2].lastIndexOf('@') + 1);
    const path = match[3] || '';

    const portSplitIndex = authority.lastIndexOf(':');
    const hasPort = portSplitIndex > -1 && /^\d+$/.test(authority.slice(portSplitIndex + 1));
    let host = (hasPort ? authority.slice(0, portSplitIndex) : authority).toLowerCase();
    let port = hasPort ? authority.slice(portSplitIndex + 1) : '';

    if (!host) {
        return { ok: false, error: 'INVALID_URL' };
    }
    if (host.startsWith('www.')) {
        host = host.slice(4);
    }
    if (!HOSTNAME_REGEX.test(host)) {
        return { ok: false, error: 'INVALID_URL' };
    }

    if ((protocol === 'https' && port === '443') || (protocol === 'http' && port === '80')) {
        port = '';
    }

    let pathname = path;
    if (pathname.length > 1 && pathname.endsWith('/')) {
        pathname = pathname.replace(/\/+$/, '');
    }
    if (pathname === '/') {
        pathname = '';
    }

    const hostPort = port ? `${host}:${port}` : host;

    return { ok: true, canonical: `${protocol}://${hostPort}${pathname}` };
};

const normalizeCorrectionValue = (
    fieldName: CorrectionFieldName,
    value: string,
): CorrectionValueResult => {
    if (fieldName === 'phoneNumber') {
        return normalizePhone(value);
    }
    if (fieldName === 'websiteUrl') {
        return normalizeWebsiteUrl(value);
    }

    return { ok: false, error: 'UNSUPPORTED_FIELD' };
};

export default normalizeCorrectionValue;
