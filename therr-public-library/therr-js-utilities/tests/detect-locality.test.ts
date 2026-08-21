import { expect } from 'chai';
import { detectLocality as detect } from '../src/location';

/** Author points, for the proximity gate every case below has to clear. */
const AT = {
    chicago: { latitude: 41.8781, longitude: -87.6298 },
    chicagoSuburb: { latitude: 41.7508, longitude: -88.1535 }, // Naperville, ~45km out
    seattle: { latitude: 47.6062, longitude: -122.3321 },
    nashville: { latitude: 36.1627, longitude: -86.7816 },
    losAngeles: { latitude: 34.0522, longitude: -118.2437 },
    newYork: { latitude: 40.7128, longitude: -74.0060 },
    newOrleans: { latitude: 29.9511, longitude: -90.0715 },
    austin: { latitude: 30.2672, longitude: -97.7431 },
    phoenix: { latitude: 33.4484, longitude: -112.0740 },
    charlotte: { latitude: 35.2271, longitude: -80.8431 },
    washington: { latitude: 38.9072, longitude: -77.0369 },
    richmond: { latitude: 37.5407, longitude: -77.4360 },
    portland: { latitude: 45.5051, longitude: -122.6750 },
    kansasCity: { latitude: 39.0997, longitude: -94.5786 },
    saltLake: { latitude: 40.7608, longitude: -111.8910 },
    lasVegas: { latitude: 36.1699, longitude: -115.1398 },
    philadelphia: { latitude: 39.9526, longitude: -75.1652 },
    atlanta: { latitude: 33.7490, longitude: -84.3880 },
    miami: { latitude: 25.7617, longitude: -80.1918 },
    denverArea: { latitude: 39.7392, longitude: -104.9903 },
};

/**
 * Most cases below are about the text rules, so they assume an author sitting in the city
 * they are writing about. The proximity gate has its own describe block.
 */
const detectLocality = (message?: string | null, at: any = AT.chicago) => detect(message, at);

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
            expect(detectLocality('SEATTLE', AT.seattle)?.slug).to.equal('seattle-wa');
            expect(detectLocality('seattle', AT.seattle)?.slug).to.equal('seattle-wa');
            expect(detectLocality('Seattle', AT.seattle)?.slug).to.equal('seattle-wa');
        });

        it('matches multi-word names, and prefers the longest one', () => {
            // Alternation is first-match-wins in JS, so without longest-first ordering
            // "Kansas City" could match a shorter token and resolve somewhere else.
            expect(detectLocality('best bbq in Kansas City, no contest', AT.kansasCity)?.slug).to.equal('kansas-city-mo');
            expect(detectLocality('moving to Salt Lake City in the fall', AT.saltLake)?.slug).to.equal('salt-lake-city-ut');
            expect(detectLocality('new york bagels ruined me', AT.newYork)?.slug).to.equal('new-york-ny');
        });

        it('counts a hashtag as an explicit mention', () => {
            expect(detectLocality('sunset over the bridge #portland', AT.portland)?.slug).to.equal('portland-or');
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
            expect(detectLocality('Austin said he would be late again', AT.austin)).to.equal(null);
            expect(detectLocality('my daughter Charlotte lost her first tooth', AT.charlotte)).to.equal(null);
            expect(detectLocality('Denver keeps stealing socks', AT.denverArea)).to.equal(null);
        });

        it('does not tag ordinary words that happen to be cities', () => {
            expect(detectLocality('like a phoenix from the ashes', AT.phoenix)).to.equal(null);
            expect(detectLocality('Columbus Day sales are relentless')).to.equal(null);
            // "mesa" is Spanish for table, and this app serves an es locale.
            expect(detectLocality('la mesa estaba llena de comida', AT.phoenix)).to.equal(null);
        });

        it('tags the same names once the sentence says they are a place', () => {
            expect(detectLocality('breakfast tacos in Austin are a food group', AT.austin)?.slug).to.equal('austin-tx');
            expect(detectLocality('flying to Phoenix for the week', AT.phoenix)?.slug).to.equal('phoenix-az');
            expect(detectLocality('back from Charlotte, exhausted', AT.charlotte)?.slug).to.equal('charlotte-nc');
        });

        it('accepts a following state as proof it is a place', () => {
            expect(detectLocality('Austin, TX has ruined me for other bbq', AT.austin)?.slug).to.equal('austin-tx');
            expect(detectLocality('Washington DC in cherry blossom season', AT.washington)?.slug).to.equal('washington-dc');
            expect(detectLocality('Richmond Virginia is underrated', AT.richmond)?.slug).to.equal('richmond-va');
        });

        it('gives up recall on bare adjectival use, deliberately', () => {
            // "Austin traffic is insane" is genuinely about Austin, and goes untagged. The
            // alternative rule tags every sentence containing someone named Austin.
            expect(detectLocality('Austin traffic is insane lately', AT.austin)).to.equal(null);
        });
    });

    describe('abbreviations', () => {
        it('matches the uppercase forms people actually type', () => {
            expect(detectLocality('best tacos in LA, fight me', AT.losAngeles)?.slug).to.equal('los-angeles-ca');
            expect(detectLocality('NYC in august is a mistake', AT.newYork)?.slug).to.equal('new-york-ny');
            expect(detectLocality('the SF fog has personal beef with me', { latitude: 37.7749, longitude: -122.4194 })?.slug).to.equal('san-francisco-ca');
            expect(detectLocality('ATL airport is its own country', AT.atlanta)?.slug).to.equal('atlanta-ga');
        });

        it('does not match a lowercase abbreviation, which is usually another language', () => {
            // The reason abbreviation matching is case-sensitive at all.
            expect(detectLocality('la playa estaba preciosa ayer', AT.losAngeles)).to.equal(null);
            expect(detectLocality('sf is not how anyone writes it', { latitude: 37.7749, longitude: -122.4194 })).to.equal(null);
        });

        it('matches word aliases in any casing, since they are unambiguous', () => {
            expect(detectLocality('vegas in july is a personal attack', AT.lasVegas)?.slug).to.equal('las-vegas-nv');
            expect(detectLocality('Philly cheesesteak discourse never ends', AT.philadelphia)?.slug).to.equal('philadelphia-pa');
        });
    });

    describe('more than one city', () => {
        it('abstains when a post names two different cities', () => {
            // A journey, not a place. Picking the first mention would be a coin flip.
            expect(detectLocality('flying from Seattle to Denver tomorrow', AT.seattle)).to.equal(null);
            expect(detectLocality('chicago pizza vs new york pizza, no contest')).to.equal(null);
        });

        it('still tags a post that names the same city repeatedly', () => {
            expect(detectLocality('Nashville. Nashville! I love Nashville', AT.nashville)?.slug).to.equal('nashville-tn');
        });

        it('does not read a state qualifier as a second city', () => {
            // "New Orleans, LA" — the LA here is Louisiana, not Los Angeles. Without
            // consuming the qualifier this reads as two cities and gets discarded.
            expect(detectLocality('crawfish season in New Orleans, LA', AT.newOrleans)?.slug).to.equal('new-orleans-la');
            expect(detectLocality('Washington, DC traffic is a punishment', AT.washington)?.slug).to.equal('washington-dc');
        });
    });

    /**
     * The gate that makes this safe to run on user-controlled input.
     *
     * Post text is typed by the person being ranked. Without a proximity check, writing
     * "Chicago" into every post is all it takes to farm the Chicago feed from anywhere.
     */
    describe('author proximity', () => {
        it('tags a post by someone writing about the city they are in', () => {
            expect(detect('deep dish in Chicago', AT.chicago)?.slug).to.equal('chicago-il');
        });

        it('tags someone out in the metro, not just at the city center', () => {
            // Naperville is ~45km from the Loop and unambiguously part of Chicagoland.
            expect(detect('deep dish in Chicago', AT.chicagoSuburb)?.slug).to.equal('chicago-il');
        });

        it('refuses a post about a city the author is nowhere near', () => {
            // The whole point: an outsider naming a city cannot inject themselves into it.
            expect(detect('chicago pizza is overrated', AT.newYork)).to.equal(null);
            expect(detect('best tacos in LA, fight me', AT.newYork)).to.equal(null);
        });

        it('refuses a post from a visitor whose home is elsewhere', () => {
            // Accepted recall cost. A Chicagoan visiting Nashville writes an untagged
            // Nashville post, because the point it is checked against is their home.
            expect(detect('hot chicken in Nashville', AT.chicago)).to.equal(null);
        });

        it('refuses when the author has no known location', () => {
            // Fails closed. An unlocatable author cannot be shown to live anywhere, and a
            // missing location must never read as "skip the check".
            expect(detect('deep dish in Chicago', undefined)).to.equal(null);
            expect(detect('deep dish in Chicago', null)).to.equal(null);
            expect(detect('deep dish in Chicago', {})).to.equal(null);
        });

        it('refuses a half-written location row rather than reading it as Null Island', () => {
            // Both columns are nullable in main.userLocations, and Number(null) is 0 — which
            // is a real point in the Gulf of Guinea, 8,000km from anywhere in the catalog.
            expect(detect('deep dish in Chicago', { latitude: null, longitude: null })).to.equal(null);
            expect(detect('deep dish in Chicago', { latitude: 41.8781, longitude: null })).to.equal(null);
        });

        it('refuses a non-finite coordinate instead of passing the comparison', () => {
            expect(detect('deep dish in Chicago', { latitude: Number.NaN, longitude: -87.6298 })).to.equal(null);
        });

        it('checks distance against the city named, not merely that a city was named', () => {
            // Same author, two posts: the local one is tagged and the remote one is not.
            expect(detect('deep dish in Chicago', AT.chicago)?.slug).to.equal('chicago-il');
            expect(detect('sunset over Seattle', AT.chicago)).to.equal(null);
        });
    });

    describe('cross-repo label parity', () => {
        it('formats the label the way therr-ai-automator writes it', () => {
            // Bot posts write `locality` as "Chicago, IL". A human post about the same city
            // must render identically or the feed shows two spellings of one place.
            expect(detectLocality('deep dish in Chicago')?.locality).to.equal('Chicago, IL');
            expect(detectLocality('cafecito in Miami', AT.miami)?.locality).to.equal('Miami, FL');
            expect(detectLocality('hot chicken in Nashville', AT.nashville)?.locality).to.equal('Nashville, TN');
        });

        it('lands a mention of NYC close enough to reach the Brooklyn bot feed', () => {
            // Brooklyn is a borough, not a Cities entry, and the seeded Brooklyn bot sits
            // ~9km from the New York point — well inside the 60km local radius, so both end
            // up in the same local feed.
            expect(detectLocality('NYC', AT.newYork)?.slug).to.equal('new-york-ny');
        });
    });
});
