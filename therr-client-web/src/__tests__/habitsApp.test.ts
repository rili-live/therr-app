/**
 * @jest-environment jsdom
 */

import * as fs from 'fs';
import * as path from 'path';
import hbs from 'hbs';
import {
    buildHabitsAppViewContext,
    computeHabitsAppAssetVersion,
    isHabitsAppPath,
    resolveHabitsAppLocale,
} from '../utilities/habitsApp';

const APP_SCRIPT_PATH = path.join(__dirname, '../_static/habits/app.js');
const VIEWS_DIR = path.join(__dirname, '../views');
const GOAL_RUN = '11111111-1111-4111-8111-111111111111';
const GOAL_READ = '22222222-2222-4222-8222-222222222222';

// The script exports its pure helpers when a CommonJS `module` exists, which it does here.
// eslint-disable-next-line import/extensions
const helpers = require('../_static/habits/app.js');

const enUs = require('../habitsAppLocales/en-us/dictionary.json');
// Aliased so `npm run locales:check`, which scans .ts files for calls to a function of that name, does not
// read these lookups as keys of the React app's dictionary.
const lookup = helpers.translate;

describe('habits web app: path matching', () => {
    it.each([
        '/app',
        '/app/',
        '/app/discover',
        `/app/habits/${GOAL_RUN}`,
    ])('serves the shell for %s', (pathname) => {
        expect(isHabitsAppPath(pathname)).toBe(true);
    });

    it.each([
        '/apps',
        '/app/unknown',
        '/app/habits',
        '/app/habits/not a uuid',
        '/app/habits/../../etc/passwd',
        '/application',
    ])('does not serve the shell for %s', (pathname) => {
        expect(isHabitsAppPath(pathname)).toBe(false);
    });

    // The server decides whether to send the shell and the client decides what the path
    // means. If they disagree, a URL either 404s on reload or shows the wrong view.
    it('agrees with the client router on every app path', () => {
        expect(helpers.parseRoute('/app')).toEqual({ name: 'today' });
        expect(helpers.parseRoute('/app/')).toEqual({ name: 'today' });
        expect(helpers.parseRoute('/app/discover')).toEqual({ name: 'discover' });
        expect(helpers.parseRoute(`/app/habits/${GOAL_RUN}`)).toEqual({ name: 'habit', habitGoalId: GOAL_RUN });
    });
});

describe('habits web app: locale and view context', () => {
    it('prefers the remembered language, then the browser, then English', () => {
        expect(resolveHabitsAppLocale({ cookieHeader: 'habits-locale=fr', acceptLanguage: 'es-MX' })).toBe('fr-ca');
        expect(resolveHabitsAppLocale({ cookieHeader: '', acceptLanguage: 'es-MX,es;q=0.9' })).toBe('es');
        expect(resolveHabitsAppLocale({})).toBe('en-us');
    });

    it('serializes a boot payload that cannot break out of its script tag', () => {
        const context = buildHabitsAppViewContext('en-us', {
            apiBase: 'https://api.example.com/v1</script><script>alert(1)</script>',
            assetVersion: 'abc123',
            pathname: '/app/discover/',
        });

        expect(context.bootJson).not.toContain('</script>');
        expect(JSON.parse(context.bootJson).locale).toBe('en-us');
        expect(context.canonicalUrl).toBe('https://habits.therr.com/app/discover');
    });

    it('speaks the visitor language in the shell and the shared footer', () => {
        const context = buildHabitsAppViewContext('es', { apiBase: '/api', assetVersion: '1', pathname: '/app' });

        expect(context.htmlLang).toBe('es');
        expect(context.t.nav.today).toBe('Hoy');
        expect(context.footerCopy.privacyPolicy).not.toBe('Privacy Policy');
    });

    it('versions the script by content and survives a missing file', () => {
        expect(computeHabitsAppAssetVersion(APP_SCRIPT_PATH)).toMatch(/^[0-9a-f]{12}$/);
        expect(computeHabitsAppAssetVersion('/nonexistent/app.js')).toBe('0');
    });
});

describe('habits web app: helpers', () => {
    it('keys a date by the local calendar day, not the UTC one', () => {
        // 23:30 local on the 5th is the 5th, whatever UTC says.
        expect(helpers.toLocalDateKey(new Date(2026, 10, 5, 23, 30))).toBe('2026-11-05');
        expect(helpers.toDateKey('2026-11-05T00:00:00.000Z')).toBe('2026-11-05');
    });

    it('translates with placeholders and shows the key on a miss', () => {
        expect(lookup(enUs, 'habit.streak', { count: 4 })).toBe('4-day streak');
        expect(lookup(enUs, 'habit.nope')).toBe('habit.nope');
        // A missing param stays visible rather than rendering "undefined".
        expect(lookup(enUs, 'habit.streak')).toBe('{count}-day streak');
    });

    it('only accepts same-origin return paths', () => {
        expect(helpers.isSafeReturnPath('/app/discover')).toBe(true);
        expect(helpers.isSafeReturnPath('//evil.example')).toBe(false);
        expect(helpers.isSafeReturnPath('/\\evil.example')).toBe(false);
        expect(helpers.isSafeReturnPath('https://evil.example')).toBe(false);
        // Browsers strip these before parsing, turning '/\t/host' into '//host'.
        expect(helpers.isSafeReturnPath('/\t/evil.example')).toBe(false);
        expect(helpers.isSafeReturnPath('/\n/evil.example')).toBe(false);
    });

    it('detects iPhone and iPadOS, which reports itself as a Mac', () => {
        expect(helpers.isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 5)).toBe(true);
        expect(helpers.isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
        expect(helpers.isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
        expect(helpers.isIosDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 5)).toBe(false);
    });

    const pacts = [{
        habitGoalId: GOAL_RUN,
        members: [
            {
                userId: 'me', firstName: 'Maya', status: 'active', checkedInToday: false,
            },
            {
                userId: 'theo', firstName: 'Theo', status: 'active', checkedInToday: true, currentStreak: '5',
            },
            { userId: 'sam', userName: 'samk', status: 'pending' },
            { userId: 'gone', firstName: 'Lee', status: 'left' },
        ],
    }, {
        habitGoalId: GOAL_READ,
        members: [{ userId: 'priya', firstName: 'Priya', status: 'active' }],
    }];

    it('lists the partners on one habit, without the viewer or anyone who left', () => {
        const partners = helpers.getPartners(pacts, GOAL_RUN, 'me');

        expect(partners.map((partner: any) => partner.name)).toEqual(['Theo', 'samk']);
        expect(partners[0]).toMatchObject({ checkedInToday: true, currentStreak: 5, isPending: false });
        expect(partners[1].isPending).toBe(true);
    });

    it('says whether a single partner has shown up today', () => {
        const partners = helpers.getPartners(pacts, GOAL_RUN, 'me');

        expect(helpers.describePartners(enUs, partners)).toBe('Theo checked in today');
        expect(helpers.describePartners(enUs, [{ ...partners[0], checkedInToday: false }]))
            .toBe('Theo has not checked in yet');
        // Only an invitee who has not accepted: nothing to say about a partner yet.
        expect(helpers.describePartners(enUs, [partners[1]])).toBe('');
    });

    it('puts habits still to do above the ones already done', () => {
        const habits = [{ habitGoalId: 'a' }, { habitGoalId: 'b' }, { habitGoalId: 'c' }];

        expect(helpers.sortHabitsForToday(habits, { a: true }).map((habit: any) => habit.habitGoalId))
            .toEqual(['b', 'c', 'a']);
    });

    it('describes a cadence', () => {
        expect(helpers.describeCadence(enUs, 'daily')).toBe('Every day');
        expect(helpers.describeCadence(enUs, 'weekly', 3)).toBe('3 times a week');
        expect(helpers.describeCadence(enUs, undefined)).toBe('Every day');
    });

    it('builds a Monday-first calendar ending in the current week', () => {
        // 2026-11-13 is a Friday.
        const rows = helpers.buildCalendar('2026-11-13', [
            { status: 'completed', scheduledDate: '2026-11-12T00:00:00.000Z' },
            { status: 'skipped', scheduledDate: '2026-11-11' },
        ], 5);

        expect(rows).toHaveLength(5);
        expect(rows.every((row: any[]) => row.length === 7)).toBe(true);
        expect(rows[4][0].key).toBe('2026-11-09');
        expect(rows[4][3]).toMatchObject({ key: '2026-11-12', isDone: true, isToday: false });
        expect(rows[4][2].isDone).toBe(false);
        expect(rows[4][4]).toMatchObject({ key: '2026-11-13', isToday: true, isFuture: false });
        expect(rows[4][5].isFuture).toBe(true);
        expect(rows[0][0].key).toBe('2026-10-12');
    });
});

describe('habits web app: shell view', () => {
    beforeAll((done) => {
        hbs.registerPartials(path.join(VIEWS_DIR, 'partials'), () => done());
    });

    const renderShell = () => hbs.handlebars.compile(fs.readFileSync(path.join(VIEWS_DIR, 'habits/app.hbs'), 'utf8'))({
        ...buildHabitsAppViewContext('en-us', { apiBase: '/api', assetVersion: 'abc123def456', pathname: '/app' }),
        gaMeasurementIdsJson: '[]',
    });

    it('is noindex and loads the versioned script', () => {
        const html = renderShell();

        expect(html).toContain('<meta name="robots" content="noindex">');
        // Static .js is served immutable for a year; without the version a returning
        // visitor keeps last month's app.
        expect(html).toContain('<script src="/habits/app.js?v=abc123def456"></script>');
    });

    it('has a tab for every top-level route the client knows', () => {
        const html = renderShell();

        expect(html).toContain('href="/app" data-tab="today"');
        expect(html).toContain('href="/app/discover" data-tab="discover"');
    });
});

describe('habits web app: in the browser', () => {
    const source = fs.readFileSync(APP_SCRIPT_PATH, 'utf8');
    const habits = [
        {
            habitGoalId: GOAL_RUN, goalName: 'Morning run', goalEmoji: '🏃', currentStreak: 3,
        },
        {
            habitGoalId: GOAL_READ, goalName: '<img src=x onerror=alert(1)>', currentStreak: 0,
        },
    ];
    let fetchMock: jest.Mock;
    let posted: any[];

    const respond = (status: number, body: unknown) => Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    });

    const flush = async () => {
        for (let i = 0; i < 12; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => { setTimeout(resolve, 0); });
        }
    };

    // Runs the script the way a browser does: no CommonJS `module` in scope, so it boots.
    // eslint-disable-next-line no-new-func
    const boot = () => new Function(source)();

    beforeEach(() => {
        posted = [];
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.history.replaceState({}, '', '/app');
        document.body.innerHTML = '<a href="/app" data-tab="today"></a><a href="/app/discover" data-tab="discover"></a>'
            + '<div id="app-view"></div><div id="app-toast" hidden></div>';
        (window as any).HABITS_APP = { apiBase: 'https://api.test', locale: 'en-us', dictionary: enUs };
        window.scrollTo = jest.fn();
        fetchMock = jest.fn((url: string, options: any = {}) => {
            if (options.method === 'POST' && url.endsWith('/habits/checkins')) {
                posted.push(JSON.parse(options.body));
                return respond(201, { id: 'c1', habitGoalId: GOAL_RUN, status: 'completed' });
            }
            if (url.includes('/habits/user-habits')) { return respond(200, { userHabits: habits }); }
            if (url.includes('/habits/checkins/today')) { return respond(200, []); }
            if (url.includes('/habits/pacts/open')) { return respond(200, { pacts: [], maxMembers: 8 }); }
            if (url.includes('/habits/pacts/')) { return respond(200, []); }
            if (url.includes('/daily-streak/me')) { return respond(200, { currentStreak: 2, week: [] }); }
            return respond(200, []);
        });
        (window as any).fetch = fetchMock;
    });

    it('sends a signed-out visitor to sign in instead of calling the API', () => {
        const assign = jest.fn();
        const original = window.location;
        Object.defineProperty(window, 'location', { configurable: true, value: { ...original, pathname: '/app', assign } });

        boot();

        expect(assign).toHaveBeenCalledWith('/login?returnTo=%2Fapp');
        expect(fetchMock).not.toHaveBeenCalled();
        Object.defineProperty(window, 'location', { configurable: true, value: original });
    });

    it('lists today\'s habits, treats names as text, and checks in with the local day', async () => {
        window.localStorage.setItem('therrUser', JSON.stringify({
            id: 'me', idToken: 'token', userName: 'maya', firstName: 'Maya',
        }));

        boot();
        await flush();

        const view = document.getElementById('app-view') as HTMLElement;
        expect(view.textContent).toContain('Morning run');
        expect(view.textContent).toContain('0 of 2 done today');
        // A habit name is another person's input: it must render as text, never as markup.
        expect(view.querySelector('img')).toBeNull();
        expect(view.textContent).toContain('<img src=x onerror=alert(1)>');

        const [, options] = fetchMock.mock.calls[0];
        expect(options.headers).toMatchObject({
            authorization: 'Bearer token', 'x-userid': 'me', 'x-brand-variation': 'habits', 'x-localecode': 'en-us',
        });

        (view.querySelector('button.checkin-btn') as HTMLButtonElement).click();
        await flush();

        const today = helpers.toLocalDateKey(new Date());
        expect(posted).toHaveLength(1);
        expect(posted[0]).toMatchObject({
            habitGoalId: GOAL_RUN, status: 'completed', scheduledDate: today, localDate: today,
        });
        expect(view.textContent).toContain('1 of 2 done today');
        expect(view.querySelectorAll('button.checkin-btn')).toHaveLength(1);
    });

    it('refreshes an expired token once and retries, rather than signing the user out', async () => {
        window.localStorage.setItem('therrUser', JSON.stringify({ id: 'me', idToken: 'stale', userName: 'maya' }));
        window.localStorage.setItem('therrRefreshToken', 'refresh-1');
        let refreshCalls = 0;
        const inner = fetchMock.getMockImplementation() as (url: string, options?: any) => any;
        fetchMock.mockImplementation((url: string, options: any = {}) => {
            if (url.endsWith('/auth/token/refresh')) {
                refreshCalls += 1;
                return respond(200, { idToken: 'fresh', refreshToken: 'refresh-2' });
            }
            if (options.headers && options.headers.authorization === 'Bearer stale') {
                return respond(401, {});
            }
            return inner(url, options);
        });

        boot();
        await flush();

        // Five requests 401 together; the refresh token is single-use, so exactly one refresh.
        expect(refreshCalls).toBe(1);
        expect((document.getElementById('app-view') as HTMLElement).textContent).toContain('Morning run');
        expect(JSON.parse(window.localStorage.getItem('therrUser') as string).idToken).toBe('fresh');
        expect(window.localStorage.getItem('therrRefreshToken')).toBe('refresh-2');
    });
    // Regression: any failed refresh (offline, 429, 5xx) used to wipe the stored session.
    it('keeps the session when a token refresh cannot be made, and offers a retry', async () => {
        window.localStorage.setItem('therrUser', JSON.stringify({ id: 'me', idToken: 'stale', userName: 'maya' }));
        window.localStorage.setItem('therrRefreshToken', 'refresh-1');
        fetchMock.mockImplementation((url: string) => (url.endsWith('/auth/token/refresh')
            ? respond(503, {})
            : respond(401, {})));

        boot();
        await flush();

        expect(window.localStorage.getItem('therrUser')).not.toBeNull();
        expect(window.localStorage.getItem('therrRefreshToken')).toBe('refresh-1');
        const view = document.getElementById('app-view') as HTMLElement;
        expect(view.textContent).toContain(enUs.common.networkError);
        expect(view.querySelector('button')?.textContent).toBe(enUs.common.retry);
    });

    // Regression: each card repainted from the snapshot it was drawn with, so the second of
    // two quick check-ins un-ticked the first, and re-enabled a button still in flight.
    it('keeps both habits ticked after two quick check-ins', async () => {
        window.localStorage.setItem('therrUser', JSON.stringify({ id: 'me', idToken: 'token', userName: 'maya' }));
        const resolvers: Array<() => void> = [];
        const inner = fetchMock.getMockImplementation() as (url: string, options?: any) => any;
        fetchMock.mockImplementation((url: string, options: any = {}) => {
            if (options.method === 'POST' && url.endsWith('/habits/checkins')) {
                const sent = JSON.parse(options.body);
                posted.push(sent);
                return new Promise((resolve) => {
                    resolvers.push(() => resolve(respond(201, { id: `c-${sent.habitGoalId}`, habitGoalId: sent.habitGoalId, status: 'completed' })));
                });
            }
            return inner(url, options);
        });

        boot();
        await flush();
        const view = document.getElementById('app-view') as HTMLElement;
        const buttons = view.querySelectorAll('button.checkin-btn');
        (buttons[0] as HTMLButtonElement).click();
        (buttons[1] as HTMLButtonElement).click();

        resolvers[0]();
        await flush();
        // The other habit's request is still in flight: its repainted button must stay busy.
        const stillPending = view.querySelector('button.checkin-btn') as HTMLButtonElement;
        expect(stillPending.disabled).toBe(true);
        stillPending.click();
        expect(posted).toHaveLength(2);

        resolvers[1]();
        await flush();
        expect(view.textContent).toContain('All 2 done today.');
        expect(view.querySelectorAll('button.checkin-btn')).toHaveLength(0);
    });

    // Regression: a render painted whenever its requests answered, so a slow today load that
    // finished after the user had switched tabs drew the today list under the Discover tab.
    it('does not let a slow load paint over the view the user moved to', async () => {
        window.localStorage.setItem('therrUser', JSON.stringify({ id: 'me', idToken: 'token', userName: 'maya' }));
        let releaseToday: () => void = () => undefined;
        const todayHeld = new Promise<void>((resolve) => { releaseToday = resolve; });
        const inner = fetchMock.getMockImplementation() as (url: string, options?: any) => any;
        fetchMock.mockImplementation((url: string, options: any = {}) => (url.includes('/habits/checkins/today')
            ? todayHeld.then(() => inner(url, options))
            : inner(url, options)));

        boot();
        await flush();
        (document.querySelector('[data-tab="discover"]') as HTMLAnchorElement).click();
        await flush();

        const view = document.getElementById('app-view') as HTMLElement;
        expect(view.textContent).toContain(enUs.discover.heading);

        releaseToday();
        await flush();
        expect(window.location.pathname).toBe('/app/discover');
        expect(view.textContent).toContain(enUs.discover.heading);
        expect(view.textContent).not.toContain('Morning run');
    });
});
