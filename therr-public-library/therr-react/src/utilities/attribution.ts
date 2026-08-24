/**
 * Marketing attribution capture.
 *
 * The B2B funnel spans two registrable domains — therr.app (landing/blog) →
 * therr.com (space pages, claim banner) → dashboard.therr.com (registration,
 * pricing, checkout). GA4 attribution does not survive that hop on its own, and
 * even where it does it lives in GA4 rather than next to the account that was
 * created. So the campaign is captured from the URL on first landing, held in
 * `sessionStorage`, and sent with the registration payload; the server writes
 * it to `main.userAcquisition`.
 *
 * **First touch wins within a session.** Once a session has an attribution
 * record, a later `utm_*` URL does not replace it. The question this data
 * exists to answer is "which campaign produced this signup", and the campaign
 * that started the session is the one that did — a blog CTA clicked three
 * pages in is a navigation event, not a new acquisition. (GA4's own reports
 * use last-non-direct; the two are expected to differ and each is right for
 * its own question.)
 *
 * Storage is `sessionStorage`, not `localStorage`, deliberately: attribution
 * that outlives the visit would credit a months-old campaign for a signup that
 * had nothing to do with it.
 */

export const ATTRIBUTION_STORAGE_KEY = 'therrUserAcquisition';

/** Which client the visitor arrived on. Mirrors the GA4 `surface` dimension. */
export type AttributionSurface = 'landing' | 'web' | 'dashboard' | 'mobile';

export interface IUserAcquisition {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
    /** `document.referrer` — the only signal an untagged organic arrival carries. */
    referrer?: string;
    /** Path (never the query string) of the first page of the session. */
    landingPath?: string;
    surface?: AttributionSurface;
}

/**
 * Caps, applied client-side so an oversized value never reaches the API, and
 * again server-side because a client-side cap is not a constraint.
 */
const MAX_UTM_LENGTH = 255;
const MAX_REFERRER_LENGTH = 1024;
const MAX_PATH_LENGTH = 512;

const UTM_KEYS: [keyof IUserAcquisition, string][] = [
    ['utmSource', 'utm_source'],
    ['utmMedium', 'utm_medium'],
    ['utmCampaign', 'utm_campaign'],
    ['utmContent', 'utm_content'],
    ['utmTerm', 'utm_term'],
];

const truncate = (value: string | null | undefined, max: number): string | undefined => {
    if (!value) return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, max) : undefined;
};

/**
 * True when the record carries an actual acquisition *signal* — a campaign tag
 * or an external referrer. `surface` and `landingPath` are always present and
 * are context, not signal, so they do not count on their own: a record holding
 * only those means "direct", which is a real and useful answer but not one
 * that identifies a source.
 */
export const hasAttribution = (acquisition: IUserAcquisition | null | undefined): boolean => {
    if (!acquisition) return false;
    return !!(acquisition.utmSource
        || acquisition.utmMedium
        || acquisition.utmCampaign
        || acquisition.utmContent
        || acquisition.utmTerm
        || acquisition.referrer);
};

/**
 * A referrer from one of our own properties is not an acquisition source — it
 * is the cross-domain hop the funnel is made of. Recording it would overwrite
 * "arrived from Google" with "arrived from therr.app" for every visitor who
 * crossed between properties before registering.
 */
const isSelfReferral = (referrer: string): boolean => {
    try {
        const { hostname } = new URL(referrer);
        return /(^|\.)therr\.(com|app)$/i.test(hostname);
    } catch {
        return false;
    }
};

export const readAttributionFromUrl = (
    search: string,
    pathname: string,
    referrer: string,
    surface: AttributionSurface,
): IUserAcquisition => {
    const params = new URLSearchParams(search || '');
    const acquisition: IUserAcquisition = { surface };

    UTM_KEYS.forEach(([field, param]) => {
        const value = truncate(params.get(param), MAX_UTM_LENGTH);
        if (value) {
            (acquisition as any)[field] = value;
        }
    });

    const cleanReferrer = truncate(referrer, MAX_REFERRER_LENGTH);
    if (cleanReferrer && !isSelfReferral(cleanReferrer)) {
        acquisition.referrer = cleanReferrer;
    }

    acquisition.landingPath = truncate(pathname, MAX_PATH_LENGTH);

    return acquisition;
};

export const getStoredAttribution = (): IUserAcquisition | null => {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;

    try {
        const stored = window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch {
        // Private browsing, a storage quota, or a value another tab corrupted.
        // Attribution is telemetry — never let it break the page it sits on.
        return null;
    }
};

/**
 * Record the session's acquisition source, if it does not already have one.
 * Safe to call on every mount; returns whatever the session is attributed to.
 *
 * The first-touch rule is enforced by the presence of *any* stored record, not
 * by whether that record carried a campaign: a session that started direct and
 * later picked up a `utm_*` from an internal link was still acquired directly,
 * and overwriting it would credit a campaign that did not bring anyone in.
 */
export const captureAttribution = (surface: AttributionSurface): IUserAcquisition | null => {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;

    const existing = getStoredAttribution();
    if (existing) return existing;

    const acquisition = readAttributionFromUrl(
        window.location.search,
        window.location.pathname,
        typeof document === 'undefined' ? '' : document.referrer,
        surface,
    );

    try {
        window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(acquisition));
    } catch {
        // Non-fatal — the value is still returned and used for this page load.
    }

    return acquisition;
};
