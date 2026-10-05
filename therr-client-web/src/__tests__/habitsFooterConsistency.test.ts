/**
 * @jest-environment jsdom
 */

import * as fs from 'fs';
import * as path from 'path';
import hbs from 'hbs';
import { buildHabitsLandingViewContext } from '../utilities/habitsLanding';

const VIEWS_DIR = path.join(__dirname, '../views/habits');
const PARTIALS_DIR = path.join(__dirname, '../views/partials');

const FOOTER_RE = /<footer class="site-footer">[\s\S]*?<\/footer>/g;

const renderView = (fileName: string): string => {
    const source = fs.readFileSync(path.join(VIEWS_DIR, fileName), 'utf8');

    // Every habits view is rendered with some subset of these; unknown keys render
    // empty, which is fine — nothing under test depends on the page body.
    return hbs.handlebars.compile(source)({
        title: 'title',
        description: 'description',
        canonicalUrl: 'https://habits.therr.com/',
        userName: 'someuser',
        // The landing page is the one localized view; render it as the English page it is
        // at '/', footer copy included, so its footer is compared as visitors see it.
        ...(fileName === 'landing.hbs' ? buildHabitsLandingViewContext('en-us', { freeHabitLimit: 3 }) : {}),
    });
};

describe('habits footer consistency', () => {
    // Regression: the footer used to be copy-pasted into all nine habits views and
    // drifted into three different link sets and two different copyright lines. It is
    // now a single partial (src/views/partials/habitsFooter.hbs); these tests fail if
    // a view stops using it or renders its own.
    beforeAll((done) => {
        // Mirrors the registration in server-client.tsx. Async, hence the callback.
        hbs.registerPartials(PARTIALS_DIR, () => done());
    });

    const viewFiles = fs.readdirSync(VIEWS_DIR).filter((file) => file.endsWith('.hbs'));

    it('finds the habits views to check', () => {
        expect(viewFiles.length).toBeGreaterThan(0);
    });

    // The partial's leading comment block is the part that keeps going wrong, and
    // comparing only the <footer> element misses it entirely: a comment delimiter
    // written as prose inside the long `{{!-- --}}` form closed the block early and
    // dumped the remaining explanation onto every habits page as visible text, yet
    // the <footer> elements still matched each other exactly. Assert on the whole
    // partial so anything outside the element counts as a failure.
    it('renders nothing outside the footer element', () => {
        const rendered = hbs.handlebars.compile('{{> habitsFooter}}')({}).trim();

        expect(rendered.startsWith('<footer class="site-footer">')).toBe(true);
        expect(rendered.endsWith('</footer>')).toBe(true);
    });

    it('has no unclosed comment leaking template prose into the page', () => {
        // Anything the comment block explains would read as page copy if it escaped.
        const rendered = hbs.handlebars.compile('{{> habitsFooter}}')({});

        expect(rendered).not.toContain('habitsFooter');
        expect(rendered).not.toContain('server-client.tsx');
        expect(rendered).not.toContain('footer.site-footer');
        expect(rendered).not.toContain('Handlebars');
    });

    it.each(viewFiles)('%s renders exactly one footer, identical to the landing page footer', (fileName) => {
        const landingFooters = renderView('landing.hbs').match(FOOTER_RE);
        expect(landingFooters).toHaveLength(1);

        const page = renderView(fileName);
        const footers = page.match(FOOTER_RE);
        expect(footers).toHaveLength(1);
        expect((footers as RegExpMatchArray)[0]).toBe((landingFooters as RegExpMatchArray)[0]);

        // Same leak check as above, but against the assembled page: a broken comment
        // in the partial surfaces here as visible copy just above the footer.
        expect(page).not.toContain('habitsFooter');
    });

    it.each(viewFiles)('%s styles the classes the shared footer markup uses', (fileName) => {
        // The partial carries markup only — these templates have no shared stylesheet,
        // so each one still needs the matching rules in its own <style> block.
        const source = fs.readFileSync(path.join(VIEWS_DIR, fileName), 'utf8');

        expect(source).toContain('footer.site-footer {');
        expect(source).toContain('footer.site-footer .footer-links');
        expect(source).toContain('footer.site-footer .footer-family');
        expect(source).toMatch(/\.container\s*\{/);
    });

    it('renders the en-us dictionary footer byte-identical to the partial\'s English fallback', () => {
        // Every view but the landing omits footerCopy and gets the fallback inline in the
        // partial; the English landing passes the dictionary. If the two drift, the footer
        // differs between '/' and every other habits page.
        const { footerCopy } = buildHabitsLandingViewContext('en-us', { freeHabitLimit: 3 });
        const partial = hbs.handlebars.compile('{{> habitsFooter}}');

        expect(partial({ footerCopy })).toBe(partial({}));
    });

    it.each(['es', 'fr-ca'] as const)('translates the footer on the %s landing page', (locale) => {
        const { footerCopy } = buildHabitsLandingViewContext(locale, { freeHabitLimit: 3 });
        const rendered = hbs.handlebars.compile('{{> habitsFooter}}')({ footerCopy });

        expect(rendered).toContain(footerCopy.privacyPolicy);
        expect(rendered).not.toContain('Privacy Policy');
        expect(rendered).toContain('href="https://www.therr.app/"');
    });

    it('keeps the outbound link to the sibling therr.app property', () => {
        // habits.therr.com has no inbound links of its own; this reciprocal link is how
        // crawlers reach it from an indexed domain.
        expect(renderView('landing.hbs')).toContain('href="https://www.therr.app/"');
    });
});
