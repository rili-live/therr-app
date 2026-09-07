/**
 * @jest-environment jsdom
 */

/**
 * Behavioral tests for views/habits/register.hbs.
 *
 * This page is the entire reason the paid web arm costs more per signup than the
 * app arm: it is the only place a Google Ads click becomes a row in
 * main."userAcquisition" that a campaign can later be judged by. Before it
 * existed, habits.therr.com had a landing page whose only CTA went to the Play
 * Store, so the "measured arm" measured nothing.
 *
 * The script is executed rather than string-matched because the invariants worth
 * protecting — the honeypot field name, the brand header, and whether the
 * attribution record actually reaches the request body — are all invisible to a
 * substring assertion.
 */

import * as fs from 'fs';
import * as path from 'path';
import hbs from 'hbs';

const VIEW_PATH = path.join(__dirname, '../views/habits/register.hbs');
const LANDING_PATH = path.join(__dirname, '../views/habits/landing.hbs');
const SERVER_CLIENT_PATH = path.join(__dirname, '../server-client.tsx');
const PARTIALS_DIR = path.join(__dirname, '../views/partials');

const API_BASE = 'https://api.test.therr.com/v1';
const STORAGE_KEY = 'therrUserAcquisition';

beforeAll((done) => {
    hbs.registerPartials(PARTIALS_DIR, () => done());
});

const mountAndRun = (): void => {
    const rendered = hbs.handlebars.compile(fs.readFileSync(VIEW_PATH, 'utf8'))({
        title: 'Create your account — Friends with Habits',
        description: 'description',
        canonicalUrl: 'https://habits.therr.com/register',
        apiBaseJson: JSON.stringify(API_BASE),
    });
    const body = rendered.match(/<body>([\s\S]*)<\/body>/);
    // The page's own script is the LAST one in the body — matched from the end so
    // an inline partial script added later cannot shadow it.
    const scripts = body && body[1].match(/<script>([\s\S]*?)<\/script>/g);

    if (!body || !scripts || !scripts.length) {
        throw new Error('register.hbs no longer has the expected <body>/<script> structure');
    }

    document.body.innerHTML = body[1];
    const source = (scripts[scripts.length - 1].match(/<script>([\s\S]*?)<\/script>/) as string[])[1];
    // eslint-disable-next-line no-new-func
    new Function(source)();
};

const fillForm = (overrides: Record<string, string | boolean> = {}) => {
    const set = (id: string, value: string) => {
        (document.getElementById(id) as HTMLInputElement).value = value;
    };
    set('email', (overrides.email as string) ?? 'streakqueen@example.com');
    set('password', (overrides.password as string) ?? 'correct-horse-battery');
    set('repeat_password', (overrides.repeatPassword as string) ?? (overrides.password as string) ?? 'correct-horse-battery');
    set('birthdate', (overrides.birthdate as string) ?? '1990-04-01');
    set('sweety_pie', (overrides.website as string) ?? '');
    (document.getElementById('agree') as HTMLInputElement).checked = overrides.agree !== false;
};

const submit = () => {
    document.getElementById('signup-form')?.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
    );
};

const flushPromises = () => new Promise((resolve) => { setTimeout(resolve, 0); });

const lastRequestBody = (fetchMock: jest.Mock) => JSON.parse(fetchMock.mock.calls[0][1].body);

describe('habits register page', () => {
    let fetchMock: jest.Mock;

    beforeEach(() => {
        sessionStorage.clear();
        fetchMock = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 'a-user-id', userName: 'streakqueen' }),
        }));
        (window as any).fetch = fetchMock;
        (window as any).gtag = jest.fn();
    });

    describe('attribution — the reason this page exists', () => {
        it('sends the stored acquisition record with the registration', async () => {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
                utmSource: 'google',
                utmMedium: 'cpc',
                utmCampaign: 'fwh-web-us-search-2026q3',
                surface: 'habits',
                landingPath: '/',
            }));
            mountAndRun();
            fillForm();
            submit();
            await flushPromises();

            expect(lastRequestBody(fetchMock).userAcquisition).toMatchObject({
                utmCampaign: 'fwh-web-us-search-2026q3',
                surface: 'habits',
            });
        });

        it('registers fine when nothing was captured', async () => {
            // Attribution is advisory. A visitor with storage disabled must still
            // be able to create an account.
            mountAndRun();
            fillForm();
            submit();
            await flushPromises();

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(lastRequestBody(fetchMock).userAcquisition).toBeUndefined();
        });

        it('survives a corrupted storage value rather than failing the signup', async () => {
            sessionStorage.setItem(STORAGE_KEY, '{not json');
            mountAndRun();
            fillForm();
            submit();
            await flushPromises();

            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('request shape', () => {
        it('posts to the users endpoint with the habits brand header', async () => {
            mountAndRun();
            fillForm();
            submit();
            await flushPromises();

            const [url, options] = fetchMock.mock.calls[0];

            expect(url).toBe(`${API_BASE}/users-service/users`);
            expect(options.method).toBe('POST');
            // Without this the account is created against the Therr brand and the
            // user cannot sign in to Friends with Habits.
            expect(options.headers['x-brand-variation']).toBe('habits');
        });

        it('sends the honeypot under the exact name the server rejects on', async () => {
            // handlers/users.ts -> createUser 400s any registration carrying a
            // non-empty `website`. A renamed field silently disables spam
            // protection with nothing failing anywhere.
            mountAndRun();
            fillForm();
            submit();
            await flushPromises();

            expect(lastRequestBody(fetchMock)).toHaveProperty('website', '');
        });

        it('sends terms agreement and the marketing preference', async () => {
            mountAndRun();
            fillForm();
            (document.getElementById('marketing') as HTMLInputElement).checked = false;
            submit();
            await flushPromises();

            expect(lastRequestBody(fetchMock)).toMatchObject({
                hasAgreedToTerms: true,
                settingsEmailMarketing: false,
                settingsBirthdate: '1990-04-01',
            });
        });

        it('never sends the repeated password', async () => {
            mountAndRun();
            fillForm();
            submit();
            await flushPromises();

            expect(lastRequestBody(fetchMock)).not.toHaveProperty('repeatPassword');
        });
    });

    describe('client-side gates', () => {
        it.each([
            ['mismatched passwords', { repeatPassword: 'something-else' }],
            ['a password under 8 characters', { password: 'short' }],
            ['unaccepted terms', { agree: false }],
        ])('does not submit on %s', async (_label, overrides) => {
            mountAndRun();
            fillForm(overrides);
            submit();
            await flushPromises();

            expect(fetchMock).not.toHaveBeenCalled();
            expect(document.getElementById('signup-error')?.hasAttribute('hidden')).toBe(false);
        });

        it('refuses an under-13 birthdate', async () => {
            const tooYoung = new Date();
            tooYoung.setFullYear(tooYoung.getFullYear() - 8);
            mountAndRun();
            fillForm({ birthdate: tooYoung.toISOString().split('T')[0] });
            submit();
            await flushPromises();

            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('re-enables the button after a server rejection so the user can retry', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                json: () => Promise.resolve({ message: 'That email is already registered.' }),
            });
            mountAndRun();
            fillForm();
            submit();
            await flushPromises();

            const button = document.getElementById('signup-submit') as HTMLButtonElement;

            expect(button.disabled).toBe(false);
            expect(document.getElementById('signup-error')?.textContent)
                .toBe('That email is already registered.');
        });
    });

    describe('conversion tracking', () => {
        it('fires sign_up only on success — this is what Ads imports', async () => {
            mountAndRun();
            fillForm();
            submit();
            await flushPromises();

            expect((window as any).gtag).toHaveBeenCalledWith('event', 'sign_up', { method: 'habits_web' });
        });

        it('does not fire sign_up when the server rejects the registration', async () => {
            fetchMock.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) });
            mountAndRun();
            fillForm();
            submit();
            await flushPromises();

            const events = (window as any).gtag.mock.calls.map((call: unknown[]) => call[1]);

            expect(events).not.toContain('sign_up');
        });

        it('registers without gtag defined at all', async () => {
            delete (window as any).gtag;
            mountAndRun();
            fillForm();
            submit();
            await flushPromises();

            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
    });
});

describe('the route and the path to it', () => {
    const serverClient = fs.readFileSync(SERVER_CLIENT_PATH, 'utf8');
    const landing = fs.readFileSync(LANDING_PATH, 'utf8');

    it('is on the habits allowlist, which hard-404s anything absent from it', () => {
        expect(serverClient).toContain("'/register': {");
        expect(serverClient).toContain("view: 'habits/register'");
    });

    it('is served no-store and with the API base the form posts to', () => {
        const entry = serverClient.slice(
            serverClient.indexOf("'/register': {"),
            serverClient.indexOf("'/login': {"),
        );

        expect(entry).toContain('cacheControl: HABITS_NO_STORE');
        expect(entry).toContain('needsApiBase: true');
    });

    it('is reachable from the landing page, or no ad click can ever reach it', () => {
        expect(landing).toContain('href="/register"');
    });

    it('stays out of the sitemap, being noindex', () => {
        const sitemap = serverClient.slice(
            serverClient.indexOf("if (req.path === '/sitemap.xml')"),
            serverClient.indexOf("if (req.path === '/llms.txt')"),
        );

        expect(sitemap).not.toContain('/register');
    });

    it('stays crawlable — Ads disapproves landing paths its crawler cannot fetch', () => {
        const robots = serverClient.slice(
            serverClient.indexOf("if (req.path === '/robots.txt')"),
            serverClient.indexOf("if (req.path === '/sitemap.xml')"),
        );

        expect(robots).not.toContain("'Disallow: /register'");
    });
});
