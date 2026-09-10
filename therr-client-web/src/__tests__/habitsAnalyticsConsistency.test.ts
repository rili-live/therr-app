/**
 * @jest-environment jsdom
 */

import * as fs from 'fs';
import * as path from 'path';
import hbs from 'hbs';

const VIEWS_DIR = path.join(__dirname, '../views/habits');
const PARTIALS_DIR = path.join(__dirname, '../views/partials');

const renderView = (fileName: string, context: Record<string, unknown> = {}): string => {
    const source = fs.readFileSync(path.join(VIEWS_DIR, fileName), 'utf8');

    return hbs.handlebars.compile(source)({
        title: 'title',
        description: 'description',
        canonicalUrl: 'https://habits.therr.com/',
        userName: 'someuser',
        ...context,
    });
};

const renderPartial = (context: Record<string, unknown> = {}): string => hbs.handlebars
    .compile('{{> habitsAnalytics}}')(context);

describe('habits analytics tagging', () => {
    // Regression: habits.therr.com served real traffic for months and appeared as a
    // hostname in zero GA4 properties. These templates ship no React bundle, so the
    // app's normal init path (getGa4Configs from a React component) never ran here,
    // and nothing failed loudly — the pages rendered perfectly, just untracked.
    // These tests fail if a habits view stops carrying the analytics partial.
    beforeAll((done) => {
        // Mirrors the registration in server-client.tsx. Async, hence the callback.
        hbs.registerPartials(PARTIALS_DIR, () => done());
    });

    const viewFiles = fs.readdirSync(VIEWS_DIR).filter((file) => file.endsWith('.hbs'));

    it('finds the habits views to check', () => {
        expect(viewFiles.length).toBeGreaterThan(0);
    });

    it.each(viewFiles)('%s includes the analytics partial inside <head>', (fileName) => {
        const source = fs.readFileSync(path.join(VIEWS_DIR, fileName), 'utf8');

        expect(source).toContain('{{> habitsAnalytics}}');

        // Inside <head> specifically: gtag queues onto window.dataLayer before the
        // library loads, so an early tag captures the pageview even if the body is
        // slow. Below the fold it would still work, but a view that drifted the
        // include into the body is a signal nobody meant to move it.
        const headEnd = source.indexOf('</head>');
        expect(headEnd).toBeGreaterThan(-1);
        expect(source.indexOf('{{> habitsAnalytics}}')).toBeLessThan(headEnd);
    });

    it.each(viewFiles)('%s renders exactly one gtag config block', (fileName) => {
        const page = renderView(fileName, { gaMeasurementIdsJson: '["G-TEST12345"]' });

        expect(page.match(/googletagmanager\.com\/gtag\/js/g)).toHaveLength(1);
        expect(page).toContain('G-TEST12345');
    });

    it('renders nothing outside the script element', () => {
        // Same failure mode the footer partial hit: a comment delimiter written as
        // prose inside the long form closes the block early and dumps the rest of
        // the explanation onto every habits page as visible text.
        const rendered = renderPartial({ gaMeasurementIdsJson: '["G-TEST12345"]' }).trim();

        expect(rendered.startsWith('<script>')).toBe(true);
        expect(rendered.endsWith('</script>')).toBe(true);
    });

    it('has no unclosed comment leaking template prose into the page', () => {
        const rendered = renderPartial({ gaMeasurementIdsJson: '["G-TEST12345"]' });

        expect(rendered).not.toContain('habitsAnalytics');
        expect(rendered).not.toContain('server-client.tsx');
        expect(rendered).not.toContain('Handlebars');
        expect(rendered).not.toContain('triple-stash');
    });

    it('tags every hit with the habits surface so it is separable from therr.com', () => {
        // habits.therr.com shares a registrable domain and a serving pod with
        // therr.com. Without a distinct `surface` the two are one blob in GA4.
        expect(renderPartial({ gaMeasurementIdsJson: '["G-TEST12345"]' })).toContain("surface: 'habits'");
    });

    it('carries the cross-domain linker for the therr.app hop', () => {
        const rendered = renderPartial({ gaMeasurementIdsJson: '["G-TEST12345"]' });

        expect(rendered).toContain("domains: ['therr.app', 'therr.com']");
        expect(rendered).toContain('accept_incoming: true');
    });

    it('configures every measurement id, not just the first', () => {
        // The dual-property parallel run (googleAnalyticsKeyUnified alongside the
        // original key) means this is normally an array of two. Loading the library
        // for ids[0] and configuring only ids[0] would silently drop the second.
        const rendered = renderPartial({ gaMeasurementIdsJson: '["G-AAAAAAAAAA","G-BBBBBBBBBB"]' });

        expect(rendered).toContain('ids.forEach');
        expect(rendered).toContain('G-AAAAAAAAAA');
        expect(rendered).toContain('G-BBBBBBBBBB');
    });

    it('emits valid, inert JavaScript when no measurement id is configured', () => {
        // Local dev and any misconfiguration land here. An analytics gap must never
        // be what breaks a page, and a bare `var ids = ;` would be a syntax error.
        const rendered = renderPartial({});

        expect(rendered).toContain('var ids = [];');
        expect(() => {
            // eslint-disable-next-line no-new-func
            Function(rendered.replace(/<\/?script>/g, ''));
        }).not.toThrow();
    });

    it('makes no network request when the id list is empty', () => {
        const body = renderPartial({}).replace(/<\/?script>/g, '');
        const created: string[] = [];
        const fakeDocument = {
            createElement: () => ({ set src(v: string) { created.push(v); }, get src() { return ''; } }),
            head: { appendChild: () => undefined },
        };
        const win: Record<string, unknown> = {};

        // eslint-disable-next-line no-new-func
        Function('window', 'document', body)(win, fakeDocument);

        expect(created).toHaveLength(0);
    });
});
