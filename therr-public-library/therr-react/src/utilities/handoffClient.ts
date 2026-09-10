// Cross-app handoff URL helpers.
//
// The flow:
//   1. Source app (e.g. Therr) calls UsersService.mintHandoff(targetBrand) to get a code.
//   2. Source app opens a universal/app link of the form `https://<host>/handoff?code=<code>&brand=<targetBrand>`.
//   3. iOS / Android route that link to the installed target app via AASA / assetlinks.json.
//   4. Target app extracts (code, brand) via parseHandoffUrl and calls UsersService.redeemHandoff(code, brand).
//
// Keep this file platform-agnostic: no React Native, no DOM. Consumers (mobile, web) supply their
// own opener (Linking.openURL / window.location.assign).

const HANDOFF_PATH = '/handoff';

const HANDOFF_HOST_FALLBACK = 'therr.com';

export interface IHandoffUrlParts {
    code: string;
    brand: string;
}

const sanitize = (value: string): string => value.replace(/[^A-Za-z0-9_-]/g, '');

/**
 * Build the universal-link URL the source app opens to hand off to the target app.
 *
 * @param code — handoff code returned by /auth/handoff/mint. Treat as a credential; never log.
 * @param targetBrand — destination brand (e.g. 'habits'). Must be the brand the user is being handed off TO.
 * @param host — optional. Defaults to therr.com. Pass the niche-specific domain when known so the
 *               OS picks the right installed app via AASA.
 */
export const buildHandoffUrl = (code: string, targetBrand: string, host?: string): string => {
    const safeCode = sanitize(code);
    const safeBrand = sanitize(targetBrand);
    const safeHost = (host || HANDOFF_HOST_FALLBACK).replace(/^https?:\/\//, '').replace(/\/+$/, '');
    if (!safeCode || !safeBrand) {
        throw new Error('buildHandoffUrl: code and targetBrand are required');
    }
    return `https://${safeHost}${HANDOFF_PATH}?code=${encodeURIComponent(safeCode)}&brand=${encodeURIComponent(safeBrand)}`;
};

/**
 * Parse an inbound deep-link URL and return its handoff parts, or null if the URL is not a
 * handoff link or is malformed. Tolerant of trailing slashes, query-only fragments, and
 * platform-specific URL shapes (Linking on RN normalizes universal-links to https://...).
 */
export const parseHandoffUrl = (url: string): IHandoffUrlParts | null => {
    if (!url || typeof url !== 'string') return null;
    try {
        // The URL constructor exists on both modern web and Hermes/React Native runtimes.
        const parsed = new URL(url);
        if (!parsed.pathname.startsWith(HANDOFF_PATH)) return null;
        const code = sanitize(parsed.searchParams.get('code') || '');
        const brand = sanitize(parsed.searchParams.get('brand') || '');
        if (!code || !brand) return null;
        return { code, brand };
    } catch {
        return null;
    }
};

/**
 * Convenience predicate. Useful when wiring up a router-level URL filter that should only react
 * to handoff links and pass everything else through to the regular deep-link handler.
 */
export const isHandoffUrl = (url: string): boolean => parseHandoffUrl(url) !== null;
