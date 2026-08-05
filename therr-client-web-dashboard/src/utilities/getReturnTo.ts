/**
 * Extracts and validates a returnTo query parameter.
 *
 * Only same-origin relative paths are allowed. Rejecting protocol-relative ('//evil.com')
 * and absolute URLs keeps this from becoming an open redirect — the handoff lands an
 * authenticated session, so an attacker-controlled destination would be worth stealing.
 */
const getReturnTo = (search?: string, fallback = '/dashboard'): string => {
    if (!search) return fallback;

    let returnTo: string | null = null;
    try {
        returnTo = new URLSearchParams(search).get('returnTo');
    } catch {
        return fallback;
    }

    if (!returnTo) return fallback;
    // Reject anything that isn't a plain path, including '//host' and '/\host' — browsers
    // treat a backslash as a slash when parsing authority, so both escape the origin.
    if (!returnTo.startsWith('/') || returnTo.startsWith('//') || returnTo.startsWith('/\\')) {
        return fallback;
    }

    return returnTo;
};

export default getReturnTo;
