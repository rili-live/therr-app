import { expect } from 'chai';
import { detectLocality } from '../src/location';

/**
 * Explicit city mentions in post text.
 *
 * The precision/recall trade-off is the whole design here, so the false-positive cases
 * below matter more than the happy path: a missed tag leaves a post behaving exactly as it
 * did before the feature existed, while a false tag drops somebody's post about their kid
 * into a stranger's city feed.
 */
describe('detectLocality', () => {
    describe('plain mentions', () => {
        it('tags a post that names an unambiguous city', () => {
            const result = detectLocality('chicago pizza is overrated and I will say it again');

            expect(result?.locality).to.equal('Chicago, IL');
            expect(result?.latitude).to.equal(41.8781);
            expect(result?.longitude).to.equal(-87.6298);
            expect(result?.slug).to.equal('chicago-il');
        });

        it('matches regardless of casing, since people type in lowercase', () => {
            expect(detectLocality('SEATTLE')?.slug).to.equal('seattle-wa');
            expect(detectLocality('seattle')?.slug).to.equal('seattle-wa');
            expect(detectLocality('Seattle')?.slug).to.equal('seattle-wa');
        });

        it('matches multi-word names, and prefers the longest one', () => {
            // Alternation is first-match-wins in JS, so without longest-first ordering
            // "Kansas City" could match a shorter token and resolve somewhere else.
            expect(detectLocality('best bbq in Kansas City, no contest')?.slug).to.equal('kansas-city-mo');
            expect(detectLocality('moving to Salt Lake City in the fall')?.slug).to.equal('salt-lake-city-ut');
            expect(detectLocality('new york bagels ruined me')?.slug).to.equal('new-york-ny');
        });

        it('counts a hashtag as an explicit mention', () => {
            expect(detectLocality('sunset over the bridge #portland')?.slug).to.equal('portland-or');
        });

        it('does not match a city name buried inside a longer word', () => {
            expect(detectLocality('read it on chicagotribune this morning')).to.equal(null);
        });

        it('returns null for a post that names nowhere', () => {
            expect(detectLocality('made a pumpkin latte at home and it beat the coffee shop')).to.equal(null);
        });

        it('handles empty and missing input', () => {
            expect(detectLocality('')).to.equal(null);
            expect(detectLocality(null)).to.equal(null);
            expect(detectLocality(undefined)).to.equal(null);
        });
    });

    describe('names that are also people and ordinary words', () => {
        it('does not tag a person who happens to share a city name', () => {
            expect(detectLocality('Austin said he would be late again')).to.equal(null);
            expect(detectLocality('my daughter Charlotte lost her first tooth')).to.equal(null);
            expect(detectLocality('Denver keeps stealing socks')).to.equal(null);
        });

        it('does not tag ordinary words that happen to be cities', () => {
            expect(detectLocality('like a phoenix from the ashes')).to.equal(null);
            expect(detectLocality('Columbus Day sales are relentless')).to.equal(null);
            // "mesa" is Spanish for table, and this app serves an es locale.
            expect(detectLocality('la mesa estaba llena de comida')).to.equal(null);
        });

        it('tags the same names once the sentence says they are a place', () => {
            expect(detectLocality('breakfast tacos in Austin are a food group')?.slug).to.equal('austin-tx');
            expect(detectLocality('flying to Phoenix for the week')?.slug).to.equal('phoenix-az');
            expect(detectLocality('back from Charlotte, exhausted')?.slug).to.equal('charlotte-nc');
        });

        it('accepts a following state as proof it is a place', () => {
            expect(detectLocality('Austin, TX has ruined me for other bbq')?.slug).to.equal('austin-tx');
            expect(detectLocality('Washington DC in cherry blossom season')?.slug).to.equal('washington-dc');
            expect(detectLocality('Richmond Virginia is underrated')?.slug).to.equal('richmond-va');
        });

        it('gives up recall on bare adjectival use, deliberately', () => {
            // "Austin traffic is insane" is genuinely about Austin, and goes untagged. The
            // alternative rule tags every sentence containing someone named Austin.
            expect(detectLocality('Austin traffic is insane lately')).to.equal(null);
        });
    });

    describe('abbreviations', () => {
        it('matches the uppercase forms people actually type', () => {
            expect(detectLocality('best tacos in LA, fight me')?.slug).to.equal('los-angeles-ca');
            expect(detectLocality('NYC in august is a mistake')?.slug).to.equal('new-york-ny');
            expect(detectLocality('the SF fog has personal beef with me')?.slug).to.equal('san-francisco-ca');
            expect(detectLocality('ATL airport is its own country')?.slug).to.equal('atlanta-ga');
        });

        it('does not match a lowercase abbreviation, which is usually another language', () => {
            // The reason abbreviation matching is case-sensitive at all.
            expect(detectLocality('la playa estaba preciosa ayer')).to.equal(null);
            expect(detectLocality('sf is not how anyone writes it')).to.equal(null);
        });

        it('matches word aliases in any casing, since they are unambiguous', () => {
            expect(detectLocality('vegas in july is a personal attack')?.slug).to.equal('las-vegas-nv');
            expect(detectLocality('Philly cheesesteak discourse never ends')?.slug).to.equal('philadelphia-pa');
        });
    });

    describe('more than one city', () => {
        it('abstains when a post names two different cities', () => {
            // A journey, not a place. Picking the first mention would be a coin flip.
            expect(detectLocality('flying from Seattle to Denver tomorrow')).to.equal(null);
            expect(detectLocality('chicago pizza vs new york pizza, no contest')).to.equal(null);
        });

        it('still tags a post that names the same city repeatedly', () => {
            expect(detectLocality('Nashville. Nashville! I love Nashville')?.slug).to.equal('nashville-tn');
        });

        it('does not read a state qualifier as a second city', () => {
            // "New Orleans, LA" — the LA here is Louisiana, not Los Angeles. Without
            // consuming the qualifier this reads as two cities and gets discarded.
            expect(detectLocality('crawfish season in New Orleans, LA')?.slug).to.equal('new-orleans-la');
            expect(detectLocality('Washington, DC traffic is a punishment')?.slug).to.equal('washington-dc');
        });
    });

    describe('cross-repo label parity', () => {
        it('formats the label the way therr-ai-automator writes it', () => {
            // Bot posts write `locality` as "Chicago, IL". A human post about the same city
            // must render identically or the feed shows two spellings of one place.
            expect(detectLocality('deep dish in Chicago')?.locality).to.equal('Chicago, IL');
            expect(detectLocality('cafecito in Miami')?.locality).to.equal('Miami, FL');
            expect(detectLocality('hot chicken in Nashville')?.locality).to.equal('Nashville, TN');
        });

        it('lands a mention of NYC close enough to reach the Brooklyn bot feed', () => {
            // Brooklyn is a borough, not a Cities entry, and the seeded Brooklyn bot sits
            // ~9km from the New York point — well inside the 60km local radius, so both end
            // up in the same local feed.
            expect(detectLocality('NYC')?.slug).to.equal('new-york-ny');
        });
    });
});
