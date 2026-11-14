/**
 * @jest-environment jsdom
 */

import * as fs from 'fs';
import * as path from 'path';
import hbs from 'hbs';

const VIEWS_DIR = path.join(__dirname, '../views');

/**
 * Runs habits/login.hbs's inline script against a fake location. jsdom cannot navigate,
 * so `location` is swapped for an object that records `replace` and `assign`.
 */
const runLogin = (search: string) => {
    const source = fs.readFileSync(path.join(VIEWS_DIR, 'habits/login.hbs'), 'utf8');
    const rendered = hbs.handlebars.compile(source)({ apiBaseJson: '"https://api.test"', gaMeasurementIdsJson: '[]' });
    const body = rendered.match(/<body>([\s\S]*)<\/body>/) as RegExpMatchArray;
    const script = body[1].match(/<script>([\s\S]*?)<\/script>/) as RegExpMatchArray;
    document.body.innerHTML = body[1];

    const replace = jest.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
            origin: 'https://habits.therr.com', search, pathname: '/login', replace, assign: jest.fn(),
        },
    });
    try {
        // eslint-disable-next-line no-new-func
        new Function(script[1])();
    } finally {
        Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
    return replace;
};

describe('habits login: signed-in skip and returnTo', () => {
    beforeAll((done) => {
        hbs.registerPartials(path.join(VIEWS_DIR, 'partials'), () => done());
    });

    beforeEach(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.localStorage.setItem('therrUser', JSON.stringify({ id: 'u1', idToken: 'token', userName: 'maya' }));
    });

    it('skips the form for a signed-in visitor heading into the web app', () => {
        expect(runLogin('')).toHaveBeenCalledWith('/app');
        expect(runLogin('?returnTo=%2Fapp%2Fdiscover')).toHaveBeenCalledWith('/app/discover');
    });

    // Regression: a challenge page sends a visitor whose token has expired here to sign in
    // again. Skipping the form bounced them straight back, still signed out, forever.
    it('shows the form when another page sent the visitor here to sign in again', () => {
        expect(runLogin('?returnTo=%2Fc%2FAbCdEf123456')).not.toHaveBeenCalled();
        expect(runLogin('?returnTo=%2Fverify-phone')).not.toHaveBeenCalled();
    });

    // Regression: browsers strip tab/CR/LF from URLs, so '/\t/evil.com' passed a pattern
    // check and was then followed as '//evil.com' — an open redirect with no click needed.
    it.each([
        '%2F%09%2Fevil.example',
        '%2F%0A%2Fevil.example',
        '%2F%2Fevil.example',
        '%2F%5Cevil.example',
        'https%3A%2F%2Fevil.example',
    ])('never redirects off-site for returnTo=%s', (returnTo) => {
        const replace = runLogin(`?returnTo=${returnTo}`);

        // An unsafe returnTo is ignored, so the default '/app' is the only possible target.
        replace.mock.calls.forEach(([target]) => expect(target).toBe('/app'));
    });
});

describe('habits login: where a password sign-in lands', () => {
    beforeAll((done) => {
        hbs.registerPartials(path.join(VIEWS_DIR, 'partials'), () => done());
    });

    const CHALLENGE = 'tS3AV7jozrl3';

    /** Signs in through the form and returns where the page sends the browser. */
    const signInWith = async (pending: string | null): Promise<string | undefined> => {
        window.localStorage.clear();
        window.sessionStorage.clear();
        if (pending !== null) {
            window.localStorage.setItem('habitsPendingChallenge', pending);
        }
        (window as any).fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 'u1', idToken: 'token', userName: 'maya' }),
        }));

        const source = fs.readFileSync(path.join(VIEWS_DIR, 'habits/login.hbs'), 'utf8');
        const rendered = hbs.handlebars.compile(source)({ apiBaseJson: '"https://api.test"', gaMeasurementIdsJson: '[]' });
        const body = rendered.match(/<body>([\s\S]*)<\/body>/) as RegExpMatchArray;
        const script = body[1].match(/<script>([\s\S]*?)<\/script>/) as RegExpMatchArray;
        document.body.innerHTML = body[1];

        const assign = jest.fn();
        const original = window.location;
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: {
                origin: 'https://habits.therr.com', search: '', pathname: '/login', replace: jest.fn(), assign,
            },
        });
        try {
            // eslint-disable-next-line no-new-func
            new Function(script[1])();
            (document.getElementById('email') as HTMLInputElement).value = 'maya@example.com';
            (document.getElementById('password') as HTMLInputElement).value = 'secret-password';
            (document.getElementById('login-form') as HTMLFormElement)
                .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            for (let i = 0; i < 6; i += 1) {
                // eslint-disable-next-line no-await-in-loop
                await new Promise((resolve) => { setTimeout(resolve, 0); });
            }
        } finally {
            Object.defineProperty(window, 'location', { configurable: true, value: original });
        }
        return assign.mock.calls[0] && assign.mock.calls[0][0];
    };

    it('lands on the habit list', async () => {
        expect(await signInWith(null)).toBe('/app');
    });

    it('finishes a challenge join started in the last few days, once', async () => {
        const fresh = JSON.stringify({ token: CHALLENGE, at: Date.now() - 60 * 60 * 1000 });

        expect(await signInWith(fresh)).toBe(`/c/${CHALLENGE}`);
        expect(window.localStorage.getItem('habitsPendingChallenge')).toBeNull();
    });

    // Regression: a pending challenge never expired and was never consumed, so a Join tapped
    // weeks earlier sent every later sign-in to that one challenge instead of the habit list.
    it.each([
        ['an unstamped value from before the expiry existed', CHALLENGE],
        ['a stamped value older than a week', JSON.stringify({ token: CHALLENGE, at: Date.now() - 8 * 24 * 60 * 60 * 1000 })],
        ['a malformed value', '{not json'],
    ])('ignores and clears %s', async (label, pending) => {
        expect(await signInWith(pending)).toBe('/app');
        expect(window.localStorage.getItem('habitsPendingChallenge')).toBeNull();
    });
});
