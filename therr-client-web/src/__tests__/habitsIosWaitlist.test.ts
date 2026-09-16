/**
 * @jest-environment jsdom
 */

/**
 * Behavioral tests for the iOS waitlist dialog in views/habits/landing.hbs.
 *
 * This dialog is the only measurement of iPhone demand either app has. There is no App Store
 * listing to click through to, so before it existed an iPhone visitor left without producing
 * a single observable event and looked exactly like a bounce. Two things must therefore keep
 * working, and neither is visible to a substring assertion:
 *
 *   1. `ios_interest_click` fires on the click itself, BEFORE and independently of whether
 *      anyone types an email. That is the demand number; the waitlist signups are a subset.
 *   2. The subscribe request carries `isSubscribedToIosWaitlist` and the habits brand header.
 *      Without the flag the address lands on the general marketing list and is
 *      indistinguishable from a newsletter signup — the waitlist becomes unqueryable.
 *
 * The script is executed rather than string-matched for the same reason as the register page
 * tests: the request body and the event ordering are what matter.
 */

import * as fs from 'fs';
import * as path from 'path';
import hbs from 'hbs';

const VIEW_PATH = path.join(__dirname, '../views/habits/landing.hbs');
const SERVER_CLIENT_PATH = path.join(__dirname, '../server-client.tsx');
const PARTIALS_DIR = path.join(__dirname, '../views/partials');

const API_BASE = 'https://api.test.therr.com/v1';

beforeAll((done) => {
    hbs.registerPartials(PARTIALS_DIR, () => done());
});

/**
 * Mounts the page body and runs only the waitlist script. The page has several inline
 * scripts (analytics, CTA tracking, the chameleon); this picks the one by content rather than
 * by position so adding another script cannot silently point these tests at the wrong one.
 */
const mountAndRun = (): void => {
    const rendered = hbs.handlebars.compile(fs.readFileSync(VIEW_PATH, 'utf8'))({
        title: 'Friends with Habits',
        description: 'description',
        canonicalUrl: 'https://habits.therr.com',
        apiBaseJson: JSON.stringify(API_BASE),
    });
    const body = rendered.match(/<body>([\s\S]*)<\/body>/);
    const scripts = body && body[1].match(/<script>([\s\S]*?)<\/script>/g);

    if (!body || !scripts || !scripts.length) {
        throw new Error('landing.hbs no longer has the expected <body>/<script> structure');
    }

    const waitlistScript = scripts.find((s) => s.includes('ios-waitlist-form'));
    if (!waitlistScript) {
        throw new Error('landing.hbs no longer contains the iOS waitlist script');
    }

    document.body.innerHTML = body[1];
    const source = (waitlistScript.match(/<script>([\s\S]*?)<\/script>/) as string[])[1];
    // eslint-disable-next-line no-new-func
    new Function(source)();
};

const click = (id: string) => (document.getElementById(id) as HTMLElement).click();

const submit = () => {
    document.getElementById('ios-waitlist-form')?.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
    );
};

const setEmail = (value: string) => {
    (document.getElementById('ios-waitlist-email') as HTMLInputElement).value = value;
};

const flushPromises = () => new Promise((resolve) => { setTimeout(resolve, 0); });

const trackedEvents = (gtagMock: jest.Mock) => gtagMock.mock.calls
    .filter((call) => call[0] === 'event')
    .map((call) => ({ name: call[1], params: call[2] }));

describe('habits landing iOS waitlist', () => {
    let fetchMock: jest.Mock;
    let gtagMock: jest.Mock;

    beforeEach(() => {
        fetchMock = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 'a-subscriber-id' }),
        }));
        gtagMock = jest.fn();
        (window as any).fetch = fetchMock;
        (window as any).gtag = gtagMock;
    });

    describe('the demand signal', () => {
        it('fires ios_interest_click on the click, with no email involved', () => {
            mountAndRun();
            click('hero-ios-cta');

            expect(trackedEvents(gtagMock)).toEqual([
                { name: 'ios_interest_click', params: { app: 'habits', location: 'hero' } },
            ]);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it.each([
            ['hero-ios-cta', 'hero'],
            ['closer-ios-cta', 'closer'],
            ['faq-ios-cta', 'faq'],
        ])('distinguishes the placement %s as location %s', (id, location) => {
            mountAndRun();
            click(id);

            expect(trackedEvents(gtagMock)[0].params).toEqual({ app: 'habits', location });
        });

        it('carries the opening placement through to the submit event', async () => {
            mountAndRun();
            click('faq-ios-cta');
            setEmail('streakqueen@example.com');
            submit();
            await flushPromises();

            expect(trackedEvents(gtagMock)).toEqual([
                { name: 'ios_interest_click', params: { app: 'habits', location: 'faq' } },
                { name: 'ios_waitlist_submit', params: { app: 'habits', location: 'faq' } },
            ]);
        });

        it('opens the dialog even when gtag was never defined', () => {
            delete (window as any).gtag;
            mountAndRun();
            click('hero-ios-cta');

            expect((document.getElementById('ios-modal') as HTMLElement).hidden).toBe(false);
        });
    });

    describe('request shape', () => {
        it('posts to the subscribers endpoint with the waitlist flag and brand header', async () => {
            mountAndRun();
            click('hero-ios-cta');
            setEmail('streakqueen@example.com');
            submit();
            await flushPromises();

            const [url, options] = fetchMock.mock.calls[0];

            expect(url).toBe(`${API_BASE}/users-service/subscribers/signup`);
            expect(options.method).toBe('POST');
            // Without this the row is indistinguishable from a general newsletter signup and
            // the waitlist cannot be queried at all.
            expect(JSON.parse(options.body)).toEqual({
                email: 'streakqueen@example.com',
                isSubscribedToIosWaitlist: true,
            });
            expect(options.headers['x-brand-variation']).toBe('habits');
        });

        it('trims the address before sending it', async () => {
            mountAndRun();
            click('hero-ios-cta');
            setEmail('  streakqueen@example.com  ');
            submit();
            await flushPromises();

            expect(JSON.parse(fetchMock.mock.calls[0][1].body).email).toBe('streakqueen@example.com');
        });
    });

    describe('submission outcomes', () => {
        it('shows the confirmation and hides the form on success', async () => {
            mountAndRun();
            click('hero-ios-cta');
            setEmail('streakqueen@example.com');
            submit();
            await flushPromises();

            expect((document.getElementById('ios-waitlist-done') as HTMLElement).hidden).toBe(false);
            expect((document.getElementById('ios-waitlist-form') as HTMLElement).hidden).toBe(true);
        });

        it('surfaces the server message and counts no conversion on failure', async () => {
            fetchMock.mockImplementation(() => Promise.resolve({
                ok: false,
                json: () => Promise.resolve({ message: 'A subscription with this e-mail already exists' }),
            }));
            mountAndRun();
            click('hero-ios-cta');
            setEmail('streakqueen@example.com');
            submit();
            await flushPromises();

            const errorBox = document.getElementById('ios-waitlist-error') as HTMLElement;
            expect(errorBox.hidden).toBe(false);
            expect(errorBox.textContent).toContain('already exists');
            expect(trackedEvents(gtagMock).map((e) => e.name)).not.toContain('ios_waitlist_submit');
        });

        it('recovers from a network error rather than leaving the button disabled', async () => {
            fetchMock.mockImplementation(() => Promise.reject(new Error('offline')));
            mountAndRun();
            click('hero-ios-cta');
            setEmail('streakqueen@example.com');
            submit();
            await flushPromises();

            expect((document.getElementById('ios-waitlist-submit') as HTMLButtonElement).disabled).toBe(false);
            expect((document.getElementById('ios-waitlist-error') as HTMLElement).hidden).toBe(false);
        });

        it('asks for an address instead of posting an empty one', () => {
            mountAndRun();
            click('hero-ios-cta');
            submit();

            expect(fetchMock).not.toHaveBeenCalled();
            expect((document.getElementById('ios-waitlist-error') as HTMLElement).hidden).toBe(false);
        });

        it('rejects a malformed address before it reaches the gateway', () => {
            mountAndRun();
            click('hero-ios-cta');
            setEmail('streakqueen');
            submit();

            expect(fetchMock).not.toHaveBeenCalled();
            expect((document.getElementById('ios-waitlist-error') as HTMLElement).textContent)
                .toContain('email address');
        });

        it('silently drops a honeypot submission without counting it', async () => {
            mountAndRun();
            click('hero-ios-cta');
            setEmail('bot@example.com');
            (document.getElementById('ios_sweety_pie') as HTMLInputElement).value = 'http://spam.example';
            submit();
            await flushPromises();

            expect(fetchMock).not.toHaveBeenCalled();
            expect(trackedEvents(gtagMock).map((e) => e.name)).not.toContain('ios_waitlist_submit');
            // The bot is shown the same success a person sees, so it learns nothing.
            expect((document.getElementById('ios-waitlist-done') as HTMLElement).hidden).toBe(false);
        });
    });

    describe('dialog behaviour', () => {
        it('starts hidden, so a visitor without JS is never shown it', () => {
            mountAndRun();

            expect((document.getElementById('ios-modal') as HTMLElement).hidden).toBe(true);
        });

        it('closes on the close button and on Escape', () => {
            mountAndRun();
            const modal = document.getElementById('ios-modal') as HTMLElement;

            click('hero-ios-cta');
            click('ios-modal-close');
            expect(modal.hidden).toBe(true);

            click('hero-ios-cta');
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            expect(modal.hidden).toBe(true);
        });

        it('does not close when the click lands inside the card', () => {
            mountAndRun();
            const modal = document.getElementById('ios-modal') as HTMLElement;
            click('hero-ios-cta');

            (document.querySelector('.modal-card') as HTMLElement).dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            );

            expect(modal.hidden).toBe(false);
        });

        it('resets a previous success when reopened', async () => {
            mountAndRun();
            click('hero-ios-cta');
            setEmail('streakqueen@example.com');
            submit();
            await flushPromises();
            click('ios-modal-close');

            click('closer-ios-cta');

            expect((document.getElementById('ios-waitlist-done') as HTMLElement).hidden).toBe(true);
            expect((document.getElementById('ios-waitlist-form') as HTMLElement).hidden).toBe(false);
            expect((document.getElementById('ios-waitlist-email') as HTMLInputElement).value).toBe('');
        });
    });

    describe('server wiring', () => {
        it('marks the landing route as needing the API base', () => {
            // The dialog's fetch target comes from `apiBaseJson`. Without `needsApiBase` on
            // the '/' renderer the template interpolates an empty base and every submission
            // posts to a relative path on habits.therr.com, which does not serve the API.
            const serverClient = fs.readFileSync(SERVER_CLIENT_PATH, 'utf8');
            const landingEntry = serverClient.match(/'\/': \{[\s\S]*?\n {4}\},/);

            expect(landingEntry).not.toBeNull();
            expect((landingEntry as RegExpMatchArray)[0]).toContain('needsApiBase: true');
        });

        it('never links the iOS CTA to an App Store listing', () => {
            // There is no published build. A badge linking to a dead listing is what this
            // replaced, and re-adding one would delete the measurement entirely.
            const view = fs.readFileSync(VIEW_PATH, 'utf8');

            expect(view).not.toContain('apps.apple.com');
        });
    });
});
