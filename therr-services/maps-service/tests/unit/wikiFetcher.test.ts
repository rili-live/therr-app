import { expect } from 'chai';
import { stripHtml } from '../../src/utilities/wikiFetcher';

// Section markup as returned by the Wikivoyage parse API without `disableeditsection`.
const editSection = (heading: string) => '<span class="mw-editsection"><span class="mw-editsection-bracket">[</span>'
    + `<a href="/w/index.php?title=Los_Angeles&amp;veaction=edit&amp;section=1" title="Edit section: ${heading}" `
    + 'class="mw-editsection-visualeditor"><span>edit</span></a><span class="mw-editsection-divider"> | </span>'
    + `<a href="/w/index.php?title=Los_Angeles&amp;action=edit&amp;section=1" title="Edit section&#039;s source code: ${heading}">`
    + '<span>edit source</span></a><span class="mw-editsection-bracket">]</span></span>';

describe('wikiFetcher', () => {
    describe('stripHtml', () => {
        it('removes nested section edit links entirely', () => {
            const html = '<div class="mw-heading mw-heading2"><h2 id="Understand">Understand</h2>'
                + `${editSection('Understand')}</div>`
                + '<div class="mw-heading mw-heading3"><h3 id="Geography">Geography</h3>'
                + `${editSection('Geography')}</div>`
                + '<p>The city of Los Angeles is huge.</p>';

            const text = stripHtml(html);

            expect(text).to.not.match(/edit/i);
            expect(text).to.not.include('[');
            expect(text).to.not.include(']');
            expect(text).to.equal('Understand\n\nGeography\n\nThe city of Los Angeles is huge.');
        });

        it('leaves the word "edit" in body copy alone', () => {
            expect(stripHtml('<p>Film crews edit footage downtown.</p>')).to.equal('Film crews edit footage downtown.');
        });
    });
});
