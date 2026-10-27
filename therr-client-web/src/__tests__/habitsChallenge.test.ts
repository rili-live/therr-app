/**
 * @jest-environment jsdom
 */

/**
 * habits.therr.com/c/:token — the challenge page (views/habits/challenge.hbs) and the pure
 * helpers behind it and its share card (utilities/habitsChallenge.ts).
 *
 * What must not regress, because nothing else would notice:
 *   1. A signed-out visitor is sent to register *with the challenge remembered*, or the join
 *      is lost somewhere between the verification email and signing in.
 *   2. A signed-in member's "Check in today" posts the challenge's habit goal with the habits
 *      brand header — without it the check-in lands on the wrong brand.
 *   3. The card escapes user-supplied names. A `<` in a display name must not break the SVG.
 */

import * as fs from 'fs';
import * as path from 'path';
import hbs from 'hbs';
import {
    CHALLENGE_CARD_PATH_RE,
    CHALLENGE_PATH_RE,
    IPublicChallenge,
    buildChallengeCardSvg,
    buildChallengeViewContext,
    formatScore,
    formatTimeLeft,
    truncate,
} from '../utilities/habitsChallenge';

const VIEW_PATH = path.join(__dirname, '../views/habits/challenge.hbs');
const SERVER_CLIENT_PATH = path.join(__dirname, '../server-client.tsx');
const PARTIALS_DIR = path.join(__dirname, '../views/partials');
const API_BASE = 'https://api.test.therr.com/v1';
const TOKEN = 'AbCdEf123456';
const GOAL_ID = 'aaaaaaaa-0000-4000-8000-0000000000a1';

const challenge = (overrides: Partial<IPublicChallenge> = {}): IPublicChallenge => ({
    joinToken: TOKEN,
    title: 'October miles',
    habitGoalId: GOAL_ID,
    goal: { name: 'Run', emoji: '🏃', amountUnit: null },
    creator: { userName: 'casey', displayName: 'Casey' },
    startDate: '2026-10-01',
    endDate: '2026-10-30',
    status: 'active',
    hasStarted: true,
    hasEnded: false,
    daysLeft: 8,
    durationDays: 30,
    memberCount: 3,
    isFull: false,
    rankedBy: 'checkinDays',
    standings: [
        {
            rank: 1, userName: 'casey', displayName: 'Casey', checkinDays: 12, totalAmount: 0,
        },
        {
            rank: 2, userName: 'sam', displayName: 'Sam', checkinDays: 1, totalAmount: 0,
        },
    ],
    ...overrides,
});

describe('habitsChallenge helpers', () => {
    it('matches the page and card paths, and nothing looser', () => {
        expect(`/c/${TOKEN}`.match(CHALLENGE_PATH_RE)?.[1]).toBe(TOKEN);
        expect(`/c/${TOKEN}/`.match(CHALLENGE_PATH_RE)?.[1]).toBe(TOKEN);
        expect(`/c/${TOKEN}/card.png`.match(CHALLENGE_CARD_PATH_RE)?.[1]).toBe(TOKEN);
        expect('/c/short'.match(CHALLENGE_PATH_RE)).toBeNull();
        expect('/c/../../etc/passwd'.match(CHALLENGE_PATH_RE)).toBeNull();
        expect(`/c/${TOKEN}/card.png`.match(CHALLENGE_PATH_RE)).toBeNull();
    });

    it('formats scores by days, or by amount on a measured goal', () => {
        expect(formatScore({ checkinDays: 1, totalAmount: 0 }, 'checkinDays')).toBe('1 day');
        expect(formatScore({ checkinDays: 12, totalAmount: 0 }, 'checkinDays')).toBe('12 days');
        expect(formatScore({ checkinDays: 3, totalAmount: 42.46 }, 'amount', 'km')).toBe('42.5 km');
        expect(formatScore({ checkinDays: 3, totalAmount: 40 }, 'amount', 'pages')).toBe('40 pages');
    });

    it('says how long is left', () => {
        expect(formatTimeLeft({ hasEnded: false, daysLeft: 8 })).toBe('8 days left');
        expect(formatTimeLeft({ hasEnded: false, daysLeft: 1 })).toBe('Last day');
        expect(formatTimeLeft({ hasEnded: true, daysLeft: 0 })).toBe('Final results');
    });

    it('truncates on code points, never mid-character', () => {
        expect(truncate('Zoë', 10)).toBe('Zoë');
        expect(truncate('abcdefghij', 5)).toBe('abcd…');
        expect(Array.from(truncate('😀😀😀😀😀😀', 4))).toHaveLength(4);
    });

    it('builds unfurl text that names the leader once someone has checked in', () => {
        const context = buildChallengeViewContext(challenge());
        expect(context.description).toContain('Casey leads with 12 days');
        expect(context.cardUrl).toBe(`https://habits.therr.com/c/${TOKEN}/card.png`);
        expect(context.isJoinable).toBe(true);

        const fresh = buildChallengeViewContext(challenge({ standings: [] }));
        expect(fresh.description).toContain('Casey started a 30-day Run challenge');
        expect(buildChallengeViewContext(challenge({ hasEnded: true })).isJoinable).toBe(false);
        expect(buildChallengeViewContext(challenge({ isFull: true })).isJoinable).toBe(false);
    });

    it('escapes user text in the card and drops emoji the font cannot draw', () => {
        const svg = buildChallengeCardSvg(challenge({
            title: 'Run 🏃 & <script>',
            standings: [{
                rank: 1, userName: 'x', displayName: 'Sam & <Jo>', checkinDays: 2, totalAmount: 0,
            }],
        }));
        expect(svg).toContain('Run &amp; &lt;script&gt;');
        expect(svg).toContain('Sam &amp; &lt;Jo&gt;');
        expect(svg).not.toContain('<script>');
        expect(svg).not.toContain('🏃');
    });

    it('shows an invitation rather than a board of zeroes before anyone checks in', () => {
        const svg = buildChallengeCardSvg(challenge({
            standings: [{
                rank: 1, userName: 'casey', displayName: 'Casey', checkinDays: 0, totalAmount: 0,
            }],
        }));
        expect(svg).toContain('Nobody has checked in yet.');
    });

    it('is wired into the habits host before the profile route', () => {
        const source = fs.readFileSync(SERVER_CLIENT_PATH, 'utf8');
        const cardIndex = source.indexOf('req.path.match(CHALLENGE_CARD_PATH_RE)');
        const profileIndex = source.indexOf('req.path.match(HABITS_PROFILE_PATH_RE)');
        expect(cardIndex).toBeGreaterThan(-1);
        expect(cardIndex).toBeLessThan(profileIndex);
    });
});

describe('challenge page', () => {
    let fetchMock: jest.Mock;

    beforeAll((done) => {
        hbs.registerPartials(PARTIALS_DIR, () => done());
    });

    const flushPromises = () => new Promise((resolve) => { setTimeout(resolve, 0); });

    const mountAndRun = (overrides: Partial<IPublicChallenge> = {}) => {
        const data = challenge(overrides);
        const rendered = hbs.handlebars.compile(fs.readFileSync(VIEW_PATH, 'utf8'))({
            ...buildChallengeViewContext(data),
            apiBaseJson: JSON.stringify(API_BASE),
            joinTokenJson: JSON.stringify(data.joinToken),
            habitGoalIdJson: JSON.stringify(data.habitGoalId),
            isJoinableJson: JSON.stringify(!data.hasEnded && !data.isFull),
        });
        const body = rendered.match(/<body>([\s\S]*)<\/body>/) as string[];
        const scripts = body[1].match(/<script>([\s\S]*?)<\/script>/g) as string[];
        const pageScript = scripts.find((s) => s.includes('habitsPendingChallenge')) as string;
        document.body.innerHTML = body[1];
        // eslint-disable-next-line no-new-func
        new Function((pageScript.match(/<script>([\s\S]*?)<\/script>/) as string[])[1])();
    };

    const signIn = () => localStorage.setItem('therrUser', JSON.stringify({ id: 'user-1', idToken: 'jwt', userName: 'sam' }));

    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        fetchMock = jest.fn();
        (window as any).fetch = fetchMock;
    });

    it('sends a signed-out visitor to register with the challenge remembered', () => {
        mountAndRun();
        const joinLink = document.getElementById('join-link') as HTMLAnchorElement;
        expect(joinLink.getAttribute('href')).toBe(`/register?challenge=${TOKEN}`);
        expect((document.getElementById('signin-link') as HTMLAnchorElement).getAttribute('href'))
            .toBe(`/login?returnTo=/c/${TOKEN}`);

        // jsdom cannot navigate; stop the link after the page's own handler has run.
        joinLink.addEventListener('click', (event) => event.preventDefault());
        joinLink.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        expect(localStorage.getItem('habitsPendingChallenge')).toBe(TOKEN);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('keeps the hidden attribute stronger than the action rows\' display:flex', () => {
        // Without this rule every action row (join, check in, join again) shows at once.
        expect(fs.readFileSync(VIEW_PATH, 'utf8')).toMatch(/\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/);
    });

    it('offers no join on an ended challenge', () => {
        mountAndRun({ hasEnded: true });
        expect(document.getElementById('join-link')).toBeNull();
    });

    it('lets a signed-in member check in on the challenge habit', async () => {
        signIn();
        fetchMock
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ hasEnded: false, viewer: { isMember: true } }) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'checkin-1' }) });

        mountAndRun();
        await flushPromises();

        expect((document.getElementById('member-actions') as HTMLElement).hidden).toBe(false);
        expect((document.getElementById('signed-out-actions') as HTMLElement).hidden).toBe(true);
        expect(document.querySelector('[data-username="sam"]')?.className).toBe('me');

        (document.getElementById('checkin-btn') as HTMLButtonElement).click();
        await flushPromises();

        const [url, options] = fetchMock.mock.calls[1];
        expect(url).toBe(`${API_BASE}/users-service/habits/checkins`);
        expect(options.headers['x-brand-variation']).toBe('habits');
        expect(options.headers.authorization).toBe('Bearer jwt');
        expect(JSON.parse(options.body)).toEqual(expect.objectContaining({ habitGoalId: GOAL_ID, status: 'completed' }));
    });

    it('lets a signed-in visitor join in place, and shows the free-tier refusal if it comes', async () => {
        signIn();
        fetchMock
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ hasEnded: false, viewer: { isMember: false } }) })
            .mockResolvedValueOnce({ ok: false, status: 402, json: () => Promise.resolve({ message: 'Free accounts can track 3 habits at a time.' }) });

        mountAndRun();
        await flushPromises();
        expect((document.getElementById('join-actions') as HTMLElement).hidden).toBe(false);

        (document.getElementById('join-btn') as HTMLButtonElement).click();
        await flushPromises();

        const [url, options] = fetchMock.mock.calls[1];
        expect(url).toBe(`${API_BASE}/users-service/habits/challenges/by-token/${TOKEN}/join`);
        expect(options.method).toBe('POST');
        expect((document.getElementById('action-status') as HTMLElement).textContent).toBe('Free accounts can track 3 habits at a time.');
    });

    it('treats a stale session as signed out', async () => {
        signIn();
        fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({}) });

        mountAndRun();
        await flushPromises();

        expect((document.getElementById('signed-out-actions') as HTMLElement).hidden).toBe(false);
        expect((document.getElementById('member-actions') as HTMLElement).hidden).toBe(true);
    });
});
