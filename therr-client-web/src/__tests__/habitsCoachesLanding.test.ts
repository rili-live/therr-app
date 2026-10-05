/**
 * @jest-environment jsdom
 */

/**
 * Tests for the coach waitlist at habits.therr.com/coaches (views/habits/coaches.hbs).
 *
 * The page is a demand test: its answers decide whether a coach view gets built. So the
 * things that must not regress are the ones a visual check cannot see:
 *
 *   1. The request carries `isSubscribedToCoachesWaitlist`, or the address lands on the general
 *      list and the waitlist cannot be counted.
 *   2. The select option values match the whitelist in the users-service
 *      (COACHES_WAITLIST_ANSWERS in handlers/subscribers.ts), which drops anything else silently.
 *   3. A honeypot hit counts nothing.
 *   4. The route is served, and listed in the sitemap.
 */

import * as fs from 'fs';
import * as path from 'path';
import hbs from 'hbs';

const VIEW_PATH = path.join(__dirname, '../views/habits/coaches.hbs');
const SERVER_CLIENT_PATH = path.join(__dirname, '../server-client.tsx');
const PARTIALS_DIR = path.join(__dirname, '../views/partials');

const API_BASE = 'https://api.test.therr.com/v1';

// Mirrors COACHES_WAITLIST_ANSWERS in therr-services/users-service/src/handlers/subscribers.ts.
// If this test fails after changing the form, change the service whitelist too.
const EXPECTED_OPTIONS: Record<string, string[]> = {
    'coach-type': ['nutrition', 'fitness', 'wellness', 'adhd', 'life-business', 'other'],
    'coach-clients': ['1-5', '6-15', '16-40', '41-plus'],
    'coach-budget': ['under-20', '20-40', '40-plus', 'unsure'],
};

beforeAll((done) => {
    hbs.registerPartials(PARTIALS_DIR, () => done());
});

const mountAndRun = (): void => {
    const rendered = hbs.handlebars.compile(fs.readFileSync(VIEW_PATH, 'utf8'))({
        title: 'Friends with Habits for Coaches',
        description: 'description',
        canonicalUrl: 'https://habits.therr.com/coaches',
        apiBaseJson: JSON.stringify(API_BASE),
    });
    const body = rendered.match(/<body>([\s\S]*)<\/body>/);
    const scripts = body && body[1].match(/<script>([\s\S]*?)<\/script>/g);
    const waitlistScript = scripts && scripts.find((s) => s.includes('coach-waitlist-form'));
    if (!body || !waitlistScript) {
        throw new Error('coaches.hbs no longer contains the coach waitlist script');
    }

    document.body.innerHTML = body[1];
    const source = (waitlistScript.match(/<script>([\s\S]*?)<\/script>/) as string[])[1];
    // eslint-disable-next-line no-new-func
    new Function(source)();
};

const setValue = (id: string, value: string) => {
    (document.getElementById(id) as HTMLInputElement | HTMLSelectElement).value = value;
};

const submit = () => {
    document.getElementById('coach-waitlist-form')?.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
    );
};

const flushPromises = () => new Promise((resolve) => { setTimeout(resolve, 0); });

const trackedEvents = (gtagMock: jest.Mock) => gtagMock.mock.calls
    .filter((call) => call[0] === 'event')
    .map((call) => ({ name: call[1], params: call[2] }));

describe('habits coaches landing', () => {
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

    it.each(Object.keys(EXPECTED_OPTIONS))('offers exactly the whitelisted values in #%s', (id) => {
        mountAndRun();
        const values = Array.from((document.getElementById(id) as HTMLSelectElement).options)
            .map((option) => option.value)
            .filter(Boolean);

        expect(values).toEqual(EXPECTED_OPTIONS[id]);
    });

    it('posts the coach flag, the answers and the habits brand header', async () => {
        mountAndRun();
        setValue('coach-email', '  coach@example.com ');
        setValue('coach-type', 'nutrition');
        setValue('coach-budget', '20-40');
        submit();
        await flushPromises();

        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe(`${API_BASE}/users-service/subscribers/signup`);
        expect(options.headers['x-brand-variation']).toBe('habits');
        // The unanswered client-count question is left out, not sent empty.
        expect(JSON.parse(options.body)).toEqual({
            email: 'coach@example.com',
            isSubscribedToCoachesWaitlist: true,
            coachesWaitlistDetails: { coachingType: 'nutrition', monthlyBudget: '20-40' },
        });
    });

    it('counts the signup with its answers and shows the confirmation', async () => {
        mountAndRun();
        setValue('coach-email', 'coach@example.com');
        setValue('coach-clients', '16-40');
        submit();
        await flushPromises();

        expect(trackedEvents(gtagMock)).toEqual([{
            name: 'coach_waitlist_submit',
            params: {
                app: 'habits',
                coaching_type: 'unanswered',
                client_count: '16-40',
                monthly_budget: 'unanswered',
            },
        }]);
        expect((document.getElementById('coach-waitlist-done') as HTMLElement).hidden).toBe(false);
        expect((document.getElementById('coach-waitlist-form') as HTMLElement).hidden).toBe(true);
    });

    it('sends and counts nothing when the honeypot is filled', async () => {
        mountAndRun();
        setValue('coach-email', 'bot@example.com');
        setValue('coach_sweety_pie', 'http://spam.example.com');
        submit();
        await flushPromises();

        expect(fetchMock).not.toHaveBeenCalled();
        expect(trackedEvents(gtagMock)).toEqual([]);
        expect((document.getElementById('coach-waitlist-done') as HTMLElement).hidden).toBe(false);
    });

    it('rejects a malformed address without a request', async () => {
        mountAndRun();
        setValue('coach-email', 'not-an-email');
        submit();
        await flushPromises();

        expect(fetchMock).not.toHaveBeenCalled();
        expect((document.getElementById('coach-waitlist-error') as HTMLElement).hidden).toBe(false);
    });

    it('surfaces a server error and counts no conversion', async () => {
        fetchMock.mockImplementation(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ message: 'Too many requests' }),
        }));
        mountAndRun();
        setValue('coach-email', 'coach@example.com');
        submit();
        await flushPromises();

        expect((document.getElementById('coach-waitlist-error') as HTMLElement).textContent).toContain('Too many requests');
        expect(trackedEvents(gtagMock)).toEqual([]);
    });

    it('tracks CTA clicks by placement', () => {
        mountAndRun();
        (document.getElementById('hero-waitlist-cta') as HTMLElement).click();

        expect(trackedEvents(gtagMock)).toEqual([
            { name: 'coach_waitlist_cta_click', params: { app: 'habits', location: 'hero' } },
        ]);
    });

    it('is served on habits.therr.com and listed in the sitemap', () => {
        const serverSource = fs.readFileSync(SERVER_CLIENT_PATH, 'utf8');

        expect(serverSource).toMatch(/'\/coaches': \{\s*view: 'habits\/coaches'/);
        expect(serverSource).toContain("loc: 'https://habits.therr.com/coaches'");
    });
});
