/**
 * @jest-environment jsdom
 */

import {
    HABITS_LOCALE_COOKIE,
    matchHabitsLandingPath,
    parseHabitsAcceptLanguage,
    readHabitsLocaleCookie,
    resolveHabitsLandingRequest,
} from '../utilities/habitsLanding';

/**
 * Locale resolution for the habits.therr.com landing page. Most of its paid traffic comes
 * from Mexico, so the case that matters most is a Spanish-preferring browser on '/'.
 */
describe('matchHabitsLandingPath', () => {
    it.each([
        ['/', 'en-us'],
        ['/es', 'es'],
        ['/es/', 'es'],
        ['/fr', 'fr-ca'],
        ['/fr/', 'fr-ca'],
    ])('serves %s as %s', (pathname, locale) => {
        expect(matchHabitsLandingPath(pathname)).toBe(locale);
    });

    it.each(['/register', '/es/register', '/esp', '/blog', '/en'])('does not claim %s', (pathname) => {
        expect(matchHabitsLandingPath(pathname)).toBeNull();
    });
});

describe('parseHabitsAcceptLanguage', () => {
    it.each([
        ['es-MX,es;q=0.9,en;q=0.8', 'es'],
        ['es-419', 'es'],
        ['fr-CA,fr;q=0.9', 'fr-ca'],
        ['en-US,en;q=0.9,es;q=0.8', 'en-us'],
        // An unsupported first choice falls through to the best supported one.
        ['pt-BR,pt;q=0.9,es;q=0.8,en;q=0.5', 'es'],
        // q-values beat listing order.
        ['en;q=0.4,es;q=0.9', 'es'],
        ['ES-mx', 'es'],
    ])('reads %s as %s', (header, locale) => {
        expect(parseHabitsAcceptLanguage(header)).toBe(locale);
    });

    it.each([undefined, '', '*', 'de-DE,de;q=0.9', 'es;q=0'])('finds no supported preference in %p', (header) => {
        expect(parseHabitsAcceptLanguage(header)).toBeNull();
    });
});

describe('readHabitsLocaleCookie', () => {
    it('reads the remembered choice among other cookies', () => {
        expect(readHabitsLocaleCookie(`_ga=GA1.1.1; ${HABITS_LOCALE_COOKIE}=es; other=1`)).toBe('es');
        expect(readHabitsLocaleCookie(`${HABITS_LOCALE_COOKIE}=en`)).toBe('en-us');
    });

    it('ignores an unknown value or a similarly named cookie', () => {
        expect(readHabitsLocaleCookie(`${HABITS_LOCALE_COOKIE}=de`)).toBeNull();
        expect(readHabitsLocaleCookie(`x${HABITS_LOCALE_COOKIE}=es`)).toBeNull();
        expect(readHabitsLocaleCookie(undefined)).toBeNull();
    });
});

describe('resolveHabitsLandingRequest', () => {
    const resolve = (overrides: Partial<Parameters<typeof resolveHabitsLandingRequest>[0]>) => resolveHabitsLandingRequest({
        pathname: '/',
        search: '',
        cookieHeader: '',
        acceptLanguage: '',
        ...overrides,
    });

    it('leaves non-landing paths to the rest of the middleware', () => {
        expect(resolve({ pathname: '/register', acceptLanguage: 'es-MX' })).toBeNull();
    });

    it('renders English on / when nothing says otherwise — including for crawlers', () => {
        expect(resolve({})).toEqual({ action: 'render', locale: 'en-us' });
        expect(resolve({ acceptLanguage: 'en-US,en;q=0.9' })).toEqual({ action: 'render', locale: 'en-us' });
    });

    it('sends a Spanish-preferring browser on / to /es, keeping the ad click parameters', () => {
        // Dropping gclid / utm_* on this hop would strip the attribution the campaign is judged by.
        expect(resolve({ acceptLanguage: 'es-MX,es;q=0.9', search: '?gclid=abc&utm_source=google' })).toEqual({
            action: 'redirect',
            location: '/es?gclid=abc&utm_source=google',
        });
    });

    it('sends a French-preferring browser on / to /fr', () => {
        expect(resolve({ acceptLanguage: 'fr-CA' })).toEqual({ action: 'redirect', location: '/fr' });
    });

    it('lets the remembered choice beat the browser language', () => {
        expect(resolve({ acceptLanguage: 'es-MX', cookieHeader: `${HABITS_LOCALE_COOKIE}=en` }))
            .toEqual({ action: 'render', locale: 'en-us' });
        expect(resolve({ acceptLanguage: 'en-US', cookieHeader: `${HABITS_LOCALE_COOKIE}=fr` }))
            .toEqual({ action: 'redirect', location: '/fr' });
    });

    it('always renders an explicitly prefixed URL as asked', () => {
        // A shared /es link, or an ad whose final URL is /es, must not bounce elsewhere.
        expect(resolve({ pathname: '/es', acceptLanguage: 'en-US', cookieHeader: `${HABITS_LOCALE_COOKIE}=en` }))
            .toEqual({ action: 'render', locale: 'es' });
        expect(resolve({ pathname: '/fr/', acceptLanguage: 'es-MX' })).toEqual({ action: 'render', locale: 'fr-ca' });
    });

    it('remembers a switcher pick and redirects to the clean URL for it', () => {
        const resolution = resolve({ pathname: '/es', search: 'lang=en&utm_campaign=x', acceptLanguage: 'es-MX' });

        expect(resolution).toEqual({
            action: 'redirect',
            location: '/?utm_campaign=x',
            setCookie: expect.stringContaining(`${HABITS_LOCALE_COOKIE}=en;`),
        });
        expect((resolution as { setCookie: string }).setCookie).toContain('Path=/');
        expect((resolution as { setCookie: string }).setCookie).toContain('SameSite=Lax');
    });

    it('then keeps that pick on the next visit to / despite a Spanish browser', () => {
        expect(resolve({ acceptLanguage: 'es-MX', cookieHeader: `${HABITS_LOCALE_COOKIE}=en` }))
            .toEqual({ action: 'render', locale: 'en-us' });
    });

    it('drops an unrecognised ?lang= without setting a cookie', () => {
        expect(resolve({ pathname: '/es', search: 'lang=de' })).toEqual({ action: 'redirect', location: '/es' });
    });
});
