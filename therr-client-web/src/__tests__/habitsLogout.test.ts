/**
 * @jest-environment jsdom
 */

/**
 * Behavioral tests for the inline script in views/habits/logout.hbs.
 *
 * That script is the whole of the sign-out path on habits.therr.com — the subdomain
 * is server-rendered Handlebars with no React and no redux, so none of the session
 * teardown in therr-react's UsersActions.logout applies here. The template is
 * compiled and its script executed in jsdom rather than asserted on as source text,
 * because the invariants worth protecting are ordering and request shape, and both
 * are invisible to a substring match.
 */

import * as fs from 'fs';
import * as path from 'path';
import hbs from 'hbs';

const VIEW_PATH = path.join(__dirname, '../views/habits/logout.hbs');
const PARTIALS_DIR = path.join(__dirname, '../views/partials');

// Both views include {{> habitsFooter}}; rendering throws without it. Mirrors the
// registration in server-client.tsx, which is async — hence the callback.
beforeAll((done) => {
    hbs.registerPartials(PARTIALS_DIR, () => done());
});

// Stands in for the serialize-javascript output that server-client.tsx injects via
// `{{{apiBaseJson}}}` — a JSON string literal, so it lands in the script as valid JS.
const API_BASE = 'https://api.test.therr.com/v1';

const renderLogoutView = (): string => hbs.handlebars.compile(fs.readFileSync(VIEW_PATH, 'utf8'))({
    title: 'Sign out — Friends with Habits',
    description: 'description',
    canonicalUrl: 'https://habits.therr.com/logout',
    apiBaseJson: JSON.stringify(API_BASE),
});

/**
 * Mounts the rendered page into jsdom and runs its inline script.
 *
 * Assigning markup through innerHTML deliberately does not execute <script> elements,
 * so the script is pulled out and evaluated explicitly — that keeps the DOM the script
 * operates on identical to the served page.
 *
 * The script is matched inside the <body> region rather than across the whole
 * document: every habits view also carries the analytics partial in <head>, so a
 * document-wide non-greedy match picks up the gtag snippet instead of the page's
 * own script and every assertion below fails on an untouched DOM.
 */
const mountAndRun = (): void => {
    const rendered = renderLogoutView();
    const body = rendered.match(/<body>([\s\S]*)<\/body>/);
    const script = body && body[1].match(/<script>([\s\S]*?)<\/script>/);

    if (!body || !script) {
        throw new Error('logout.hbs no longer has the expected <body>/<script> structure');
    }

    document.body.innerHTML = body[1];
    // eslint-disable-next-line no-new-func
    new Function(script[1])();
};

const A_SESSION = {
    id: 'ff4d2f5c-6f0e-4a1e-8b7e-0f9d3c2b1a00',
    userName: 'streakqueen',
    idToken: 'header.payload.signature',
    refreshToken: 'refresh-token-value',
};

const seedSession = (user: Record<string, unknown> = A_SESSION) => {
    sessionStorage.setItem('therrUser', JSON.stringify(user));
    localStorage.setItem('therrUser', JSON.stringify(user));
    localStorage.setItem('therrRefreshToken', 'refresh-token-value');
    sessionStorage.setItem('therrRefreshToken', 'refresh-token-value');
    localStorage.setItem('therrSession', 'session-value');
};

const isSignedOutUi = () => document.getElementById('state-pending')?.hasAttribute('hidden')
    && !document.getElementById('state-done')?.hasAttribute('hidden');

/** Lets the script's fetch promise chain settle without waiting on its timeout fallback. */
const flushPromises = () => new Promise((resolve) => { setTimeout(resolve, 0); });

describe('habits logout page', () => {
    let fetchMock: jest.Mock;

    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 204 });
        (global as any).fetch = fetchMock;
    });

    afterEach(() => {
        delete (global as any).fetch;
        jest.useRealTimers();
    });

    describe('local session teardown', () => {
        it('removes every session key from both storages', () => {
            seedSession();

            mountAndRun();

            ['therrSession', 'therrUser', 'therrRefreshToken'].forEach((key) => {
                expect(localStorage.getItem(key)).toBeNull();
                expect(sessionStorage.getItem(key)).toBeNull();
            });
        });

        it('clears local storage before the network call, not after', () => {
            // The ordering is the point: if the request hangs, 500s, or the tab is closed
            // mid-flight, the device must still have no usable session. Asserting from
            // inside the fetch mock is the only way to observe the ordering.
            seedSession();
            let storageAtRequestTime: string | null = 'not-yet-observed';
            fetchMock.mockImplementation(() => {
                storageAtRequestTime = localStorage.getItem('therrUser');
                return Promise.resolve({ ok: true, status: 204 });
            });

            mountAndRun();

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(storageAtRequestTime).toBeNull();
        });

        it('leaves therrUserSettings in place', () => {
            // therr-react's logout deliberately preserves this key so the next sign-in on
            // this device does not inherit another user's settings. Same rule here.
            seedSession();
            localStorage.setItem('therrUserSettings', JSON.stringify({ id: A_SESSION.id, locale: 'en-us' }));

            mountAndRun();

            expect(localStorage.getItem('therrUserSettings')).not.toBeNull();
        });

        it('clears a corrupt therrUser entry instead of choking on it', () => {
            localStorage.setItem('therrUser', '{not json');
            sessionStorage.setItem('therrUser', '{not json');

            expect(() => mountAndRun()).not.toThrow();

            expect(localStorage.getItem('therrUser')).toBeNull();
            expect(sessionStorage.getItem('therrUser')).toBeNull();
        });
    });

    describe('server-side revocation request', () => {
        it('posts to the gateway logout route with the bearer token and userName', () => {
            seedSession();

            mountAndRun();

            expect(fetchMock).toHaveBeenCalledTimes(1);
            const [url, init] = fetchMock.mock.calls[0];
            expect(url).toBe(`${API_BASE}/users-service/auth/logout`);
            expect(init.method).toBe('POST');
            // logoutUserValidation requires a string userName; the gateway reads the
            // bearer token to blacklist its jti.
            expect(JSON.parse(init.body).userName).toBe(A_SESSION.userName);
            expect(init.headers.authorization).toBe(`Bearer ${A_SESSION.idToken}`);
        });

        it('identifies itself as the habits brand', () => {
            seedSession();

            mountAndRun();

            expect(fetchMock.mock.calls[0][1].headers['x-brand-variation']).toBe('habits');
        });

        it('never requests cross-brand revocation', () => {
            // The gateway revokes refresh tokens per-brand by default and cascades across
            // every brand on `scope: 'all'`. Signing out of Friends with Habits on the web
            // must not sign the user out of the core Therr app, so the field stays absent.
            seedSession();

            mountAndRun();

            expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('scope');
        });

        it.each([
            ['no stored session at all', undefined],
            ['a session with no idToken', { userName: 'streakqueen' }],
            ['a session with no userName', { idToken: 'header.payload.signature' }],
        ])('skips the request when there is %s', (_label, user) => {
            // Nothing for the server to revoke without both halves, and the request would
            // fail validation anyway.
            if (user) {
                seedSession(user);
            }

            mountAndRun();

            expect(fetchMock).not.toHaveBeenCalled();
            expect(isSignedOutUi()).toBe(true);
        });
    });

    describe('confirmation state', () => {
        it('starts on the pending state and swaps to the confirmation once settled', async () => {
            seedSession();

            mountAndRun();

            expect(isSignedOutUi()).toBe(false);

            await flushPromises();

            expect(isSignedOutUi()).toBe(true);
        });

        it('confirms the sign-out even when the request fails', async () => {
            // An expired or already-blacklisted token 401s, and the network can simply be
            // gone. Neither is worth surfacing: the local session is already cleared, so
            // the user is signed out on this device either way.
            seedSession();
            fetchMock.mockRejectedValue(new Error('network down'));

            mountAndRun();
            await flushPromises();

            expect(isSignedOutUi()).toBe(true);
        });

        it('confirms the sign-out even when the request never settles', () => {
            // A hung gateway must not strand the user on "Signing you out…" forever.
            jest.useFakeTimers();
            seedSession();
            fetchMock.mockReturnValue(new Promise(() => { /* never settles */ }));

            mountAndRun();
            expect(isSignedOutUi()).toBe(false);

            jest.advanceTimersByTime(2500);

            expect(isSignedOutUi()).toBe(true);
        });

        it('offers a route back to sign in', () => {
            seedSession();

            mountAndRun();

            const signInLink = document.querySelector('#state-done a.cta');
            expect(signInLink?.getAttribute('href')).toBe('/login');
        });
    });
});

describe('habits profile page sign-out link', () => {
    const PROFILE_PATH = path.join(__dirname, '../views/habits/profile.hbs');

    const mountProfile = (): void => {
        const rendered = hbs.handlebars.compile(fs.readFileSync(PROFILE_PATH, 'utf8'))({
            title: 'title',
            description: 'description',
            canonicalUrl: 'https://habits.therr.com/u/streakqueen',
            displayName: 'Streak Queen',
            userName: 'streakqueen',
        });
        const body = rendered.match(/<body>([\s\S]*)<\/body>/);
        // Body-scoped for the same reason as mountAndRun above: the analytics
        // partial in <head> would otherwise be the first match.
        const script = body && body[1].match(/<script>([\s\S]*?)<\/script>/);

        if (!body || !script) {
            throw new Error('profile.hbs no longer has the expected <body>/<script> structure');
        }

        document.body.innerHTML = body[1];
        // eslint-disable-next-line no-new-func
        new Function(script[1])();
    };

    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    it('ships hidden in the served markup', () => {
        // Profile pages are public and shared-proxy cached, so the link must not be
        // visible in the HTML a CDN hands to anonymous visitors.
        const rendered = hbs.handlebars.compile(fs.readFileSync(PROFILE_PATH, 'utf8'))({ userName: 'streakqueen' });

        expect(rendered).toMatch(/<a class="session-link" id="session-logout" href="\/logout" hidden>/);
    });

    it('stays hidden for a signed-out visitor', () => {
        mountProfile();

        expect(document.getElementById('session-logout')?.hidden).toBe(true);
    });

    it('is revealed for a visitor with a session', () => {
        localStorage.setItem('therrUser', JSON.stringify(A_SESSION));

        mountProfile();

        expect(document.getElementById('session-logout')?.hidden).toBe(false);
    });
});
