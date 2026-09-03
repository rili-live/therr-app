/**
 * @jest-environment jsdom
 */

import * as fs from 'fs';
import * as path from 'path';
import hbs from 'hbs';

const VIEWS_DIR = path.join(__dirname, '../views/habits');
const PARTIALS_DIR = path.join(__dirname, '../views/partials');
const ATTRIBUTION_PARTIAL = path.join(PARTIALS_DIR, 'habitsAttribution.hbs');
const ATTRIBUTION_UTIL = path.join(
    __dirname,
    '../../../therr-public-library/therr-react/src/utilities/attribution.ts',
);

const STORAGE_KEY = 'therrUserAcquisition';

/** The IIFE out of the partial, ready to run against jsdom's globals. */
const captureScript = (): string => {
    const source = fs.readFileSync(ATTRIBUTION_PARTIAL, 'utf8');
    const match = source.match(/<script>([\s\S]*?)<\/script>/);

    if (!match) throw new Error('habitsAttribution.hbs no longer contains a <script> block');

    return match[1];
};

/**
 * Run the capture against the real jsdom window with `document` shadowed.
 *
 * jsdom's document.referrer is non-configurable, so it is injected as a
 * parameter instead. That is only honest as long as `document.referrer` is the
 * script's sole use of `document` — asserted below so the shim cannot quietly
 * start hiding real DOM access.
 */
const runCapture = (script: string, referrer: string): void => {
    // eslint-disable-next-line no-new-func
    new Function('document', script)({ referrer });
};

const runCaptureOn = (url: string, referrer = ''): Record<string, string> | null => {
    window.sessionStorage.clear();
    window.history.replaceState({}, '', url);
    runCapture(captureScript(), referrer);

    const stored = window.sessionStorage.getItem(STORAGE_KEY);

    return stored ? JSON.parse(stored) : null;
};

describe('habits attribution capture', () => {
    // Regression: habits.therr.com is Handlebars SSR and ships no React bundle, so
    // therr-react's captureAttribution() never ran here. A fully tagged ad click
    // landed, converted, and wrote nothing to main."userAcquisition" — the paid
    // "measured arm" measured nothing, and every habits signup looked organic.
    beforeAll((done) => {
        hbs.registerPartials(PARTIALS_DIR, () => done());
    });

    it('touches document only for the referrer, which is what makes the test shim valid', () => {
        const uses = captureScript().match(/\bdocument\.\w+/g) || [];

        expect([...new Set(uses)]).toEqual(['document.referrer']);
    });

    describe('every habits page captures, not just the form', () => {
        const viewFiles = fs.readdirSync(VIEWS_DIR).filter((file) => file.endsWith('.hbs'));

        it('finds the habits views to check', () => {
            expect(viewFiles.length).toBeGreaterThan(0);
        });

        // Capture must happen on the FIRST page of the session, whatever that is —
        // the landing page, a blog post, an /invite/:userName link. Capturing only
        // on /register would attribute every signup to the last click before the
        // form rather than the click that brought the visitor in.
        it.each(viewFiles)('%s reaches the attribution partial via habitsAnalytics', (fileName) => {
            const rendered = hbs.handlebars.compile(
                fs.readFileSync(path.join(VIEWS_DIR, fileName), 'utf8'),
            )({
                title: 't', description: 'd', canonicalUrl: 'https://habits.therr.com/', apiBaseJson: '""',
            });

            expect(rendered).toContain(STORAGE_KEY);
        });
    });

    describe('what it records', () => {
        it('stores every utm parameter under the field names the API expects', () => {
            const stored = runCaptureOn(
                '/?utm_source=google&utm_medium=cpc&utm_campaign=fwh-web-us-search-2026q3'
                + '&utm_term=accountability+partner+app&utm_content=rsa1',
            );

            expect(stored).toMatchObject({
                utmSource: 'google',
                utmMedium: 'cpc',
                utmCampaign: 'fwh-web-us-search-2026q3',
                utmTerm: 'accountability partner app',
                utmContent: 'rsa1',
                surface: 'habits',
                landingPath: '/',
            });
        });

        it('marks the surface so habits traffic is separable from therr.com', () => {
            expect(runCaptureOn('/')?.surface).toBe('habits');
        });

        it('records the landing path but never the query string', () => {
            const stored = runCaptureOn('/blog/why-streaks-break?utm_campaign=x&email=someone@example.com');

            expect(stored?.landingPath).toBe('/blog/why-streaks-break');
            expect(JSON.stringify(stored)).not.toContain('someone@example.com');
        });

        it('keeps an external referrer', () => {
            expect(runCaptureOn('/', 'https://news.ycombinator.com/item?id=1')?.referrer)
                .toBe('https://news.ycombinator.com/item?id=1');
        });

        it('drops a self-referral, which is a funnel hop and not an acquisition', () => {
            // Otherwise crossing therr.app -> habits.therr.com overwrites
            // "arrived from Google" with "arrived from ourselves".
            expect(runCaptureOn('/', 'https://www.therr.app/blog')?.referrer).toBeUndefined();
            expect(runCaptureOn('/', 'https://www.therr.com/')?.referrer).toBeUndefined();
        });

        it('first touch wins — a later utm does not overwrite the session', () => {
            runCaptureOn('/?utm_campaign=first');
            window.history.replaceState({}, '', '/register?utm_campaign=second');
            runCapture(captureScript(), '');

            expect(JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) as string).utmCampaign)
                .toBe('first');
        });

        it('records an untagged visit rather than nothing', () => {
            // "direct" is a real and useful answer; storing nothing would let the
            // next internal link with a utm on it claim the session.
            expect(runCaptureOn('/')).toMatchObject({ surface: 'habits', landingPath: '/' });
        });

        it('truncates to the column widths the server sanitizer enforces', () => {
            const stored = runCaptureOn(`/?utm_campaign=${'c'.repeat(400)}`);

            expect(stored?.utmCampaign).toHaveLength(255);
        });
    });

    describe('parity with therr-react/utilities/attribution.ts', () => {
        // The server sanitizer drops unknown keys silently, so a field renamed on
        // one side and not the other does not error — it just stops being
        // recorded, on a surface nobody is watching.
        const util = fs.readFileSync(ATTRIBUTION_UTIL, 'utf8');
        const partial = fs.readFileSync(ATTRIBUTION_PARTIAL, 'utf8');

        it('uses the same sessionStorage key', () => {
            expect(util).toContain(`ATTRIBUTION_STORAGE_KEY = '${STORAGE_KEY}'`);
            expect(partial).toContain(`'${STORAGE_KEY}'`);
        });

        it.each([
            ['utmSource', 'utm_source'],
            ['utmMedium', 'utm_medium'],
            ['utmCampaign', 'utm_campaign'],
            ['utmContent', 'utm_content'],
            ['utmTerm', 'utm_term'],
        ])('maps %s from %s in both implementations', (field, param) => {
            expect(util).toContain(`['${field}', '${param}']`);
            expect(partial).toContain(`['${field}', '${param}']`);
        });

        it.each([
            ['MAX_UTM_LENGTH', 'MAX_UTM', '255'],
            ['MAX_REFERRER_LENGTH', 'MAX_REFERRER', '1024'],
            ['MAX_PATH_LENGTH', 'MAX_PATH', '512'],
        ])('shares the %s cap', (utilName, partialName, value) => {
            expect(util).toContain(`${utilName} = ${value}`);
            expect(partial).toContain(`${partialName} = ${value}`);
        });

        it('declares habits as a valid surface on the typed side', () => {
            expect(util).toContain("'habits'");
        });
    });
});
