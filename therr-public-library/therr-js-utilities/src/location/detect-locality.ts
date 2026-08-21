import Cities, { ICityEntry } from '../constants/Cities';
import Location from '../constants/Location';
import getDistanceInMeters from './get-distance';

/** Where the author actually is, as resolved from `main.userLocations`. */
export interface IAuthorLocation {
    latitude?: number | null;
    longitude?: number | null;
}

export interface IDetectedLocality {
    latitude: number;
    longitude: number;
    /** Display label, e.g. "Chicago, IL". Matches what therr-ai-automator writes. */
    locality: string;
    /** The city's slug, so a caller can link the post to its city page. */
    slug: string;
}

/**
 * City names that are also ordinary English words or common given names.
 *
 * These are the false-positive engine of any name matcher: "Austin said he'd be late",
 * "a phoenix rising", "my daughter Charlotte", "mesa" (Spanish for table, and this app has
 * an es locale), "Columbus Day", "George Washington". Matching them bare would tag a large
 * share of ordinary posts with a city nobody was talking about.
 *
 * They are not dropped — they are the names of real, large cities and people write about
 * them constantly — but they only count when the sentence says they are a place: a
 * preceding preposition ("in Austin"), or a following state ("Austin, TX").
 *
 * The cost is recall on bare adjectival use — "Austin traffic is insane" goes untagged.
 * That is the right side to err on. A missed tag is a post that behaves exactly as it did
 * before this feature existed; a false tag puts somebody's post about their kid into a
 * stranger's city feed.
 */
const NAMES_NEEDING_CONTEXT = new Set([
    'arlington',
    'aurora',
    'austin',
    'charlotte',
    'columbus',
    'dallas',
    'denver',
    'greenville',
    'houston',
    'mesa',
    'phoenix',
    'richmond',
    'santa ana',
    'washington',
]);

/**
 * Words that, immediately before a city name, mark it as a place rather than a person.
 *
 * Deliberately short and boring. Every addition here widens what counts as context for the
 * ambiguous set above, so it should only hold words that are about location and nothing else
 * ("of" is excluded: "University of Washington" is not a post about Washington).
 */
const PLACE_CUES = new Set([
    'in', 'to', 'from', 'near', 'around', 'outside', 'inside', 'visiting',
    'downtown', 'across', 'toward', 'towards', 'through', 'into', 'at',
]);

/**
 * Abbreviations people actually type, matched CASE-SENSITIVELY.
 *
 * Case sensitivity is load-bearing rather than fussy: "la" is a Spanish article and this app
 * serves an es locale, so a case-insensitive "LA" would tag a large fraction of Spanish
 * posts as Los Angeles. Uppercase-only costs the occasional all-caps post and buys back
 * every ordinary sentence.
 */
const UPPERCASE_ALIASES: { [alias: string]: string } = {
    NYC: 'new-york-ny',
    SF: 'san-francisco-ca',
    LA: 'los-angeles-ca',
    ATL: 'atlanta-ga',
    ATX: 'austin-tx',
    DC: 'washington-dc',
    NOLA: 'new-orleans-la',
    PDX: 'portland-or',
    SLC: 'salt-lake-city-ut',
    MPLS: 'minneapolis-mn',
};

/** Aliases that are ordinary words and safe to match in any casing. */
const CASE_INSENSITIVE_ALIASES: { [alias: string]: string } = {
    vegas: 'las-vegas-nv',
    philly: 'philadelphia-pa',
    nashvegas: 'nashville-tn',
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * One regex over every name and alias, longest first.
 *
 * Longest-first alternation is what makes "New York" win over a bare "York" would-be match
 * and "Kansas City" win over "Kansas", since JS alternation is first-match-wins rather than
 * longest-match-wins. Built once at module load; the catalog is static.
 */
const buildMatcher = () => {
    const bySlug: { [slug: string]: ICityEntry } = {};
    const tokens: string[] = [];

    Cities.CitiesList.forEach((city) => {
        bySlug[city.slug] = city;
        tokens.push(city.name);
    });
    Object.keys(UPPERCASE_ALIASES).forEach((alias) => tokens.push(alias));
    Object.keys(CASE_INSENSITIVE_ALIASES).forEach((alias) => tokens.push(alias));

    const pattern = tokens
        .slice()
        .sort((a, b) => b.length - a.length)
        .map(escapeRegExp)
        .join('|');

    return {
        bySlug,
        regex: new RegExp(`\\b(${pattern})\\b`, 'gi'),
    };
};

const { bySlug, regex: CITY_REGEX } = buildMatcher();

/** Resolves one matched token to a city, applying the alias casing rules. */
const resolveToken = (token: string): ICityEntry | undefined => {
    const upperAliasSlug = UPPERCASE_ALIASES[token];
    if (upperAliasSlug) {
        // Matched the alias spelling — but only the uppercase form counts.
        return token === token.toUpperCase() ? bySlug[upperAliasSlug] : undefined;
    }

    const lowered = token.toLowerCase();
    const insensitiveAliasSlug = CASE_INSENSITIVE_ALIASES[lowered];
    if (insensitiveAliasSlug) {
        return bySlug[insensitiveAliasSlug];
    }

    return Cities.CityNameMap[lowered];
};

/**
 * How far the "City, ST" / "City, State" qualifier after a match extends, or 0 if absent.
 *
 * Consuming the qualifier does double duty: it proves the name is being used as a place
 * (which is what the ambiguous set needs), and it stops the state token from being matched
 * on its own afterwards. Without that, "New Orleans, LA" would match New Orleans *and* the
 * LA alias, read as two different cities, and get discarded as ambiguous.
 */
const getStateQualifierLength = (text: string, city: ICityEntry): number => {
    const qualifier = new RegExp(`^,?\\s+(${escapeRegExp(city.stateAbbr)}|${escapeRegExp(city.state)})\\b`, 'i');
    const match = qualifier.exec(text);

    return match ? match[0].length : 0;
};

/** The word immediately before a match, lowercased, or '' at the start of the message. */
const getPrecedingWord = (message: string, index: number): string => {
    const before = message.slice(0, index).trimEnd();
    const match = /([A-Za-z']+)$/.exec(before);

    return match ? match[1].toLowerCase() : '';
};

/**
 * Finds the one city a post is explicitly about, or null.
 *
 * Returns null unless exactly one distinct city is named. A post that mentions two —
 * "flying from Seattle to Denver tomorrow" — is about a journey, not a place, and picking
 * the first mention would be a coin flip that drops a travel post into one random city's
 * feed. Naming the same city several times is still one city.
 *
 * Deliberately module-private: every caller must go through `detectLocality`, which also
 * checks that the author is anywhere near the city they named. An exported parse-only
 * function would be an easy way to skip that check by accident.
 */
const findNamedCity = (message: string): ICityEntry | null => {
    const matchedSlugs = new Set<string>();
    let matchedCity: ICityEntry | undefined;
    let consumedUntil = 0;

    CITY_REGEX.lastIndex = 0;
    let match = CITY_REGEX.exec(message);

    while (match !== null) {
        const [token] = match;
        const start = match.index;

        // Inside a span already consumed by a preceding match's state qualifier.
        if (start >= consumedUntil) {
            const city = resolveToken(token);

            if (city) {
                const qualifierLength = getStateQualifierLength(message.slice(start + token.length), city);
                const hasPlaceCue = PLACE_CUES.has(getPrecedingWord(message, start));
                const needsContext = NAMES_NEEDING_CONTEXT.has(city.name.toLowerCase());

                if (!needsContext || qualifierLength > 0 || hasPlaceCue) {
                    matchedSlugs.add(city.slug);
                    matchedCity = city;
                }

                if (qualifierLength > 0) {
                    consumedUntil = start + token.length + qualifierLength;
                }
            }
        }

        match = CITY_REGEX.exec(message);
    }

    if (matchedSlugs.size !== 1 || !matchedCity) {
        return null;
    }

    return matchedCity;
};

/**
 * The city a post is about, when its author is close enough to be writing about home.
 *
 * Two independent gates, and a post has to clear both:
 *
 *  1. The text explicitly names exactly one city (`findNamedCity`).
 *  2. The author is within `LOCAL_AUTHOR_MAX_DISTANCE_METERS` of it.
 *
 * The second gate is what makes this safe to run on user-controlled input. Post text is
 * typed by the person being ranked, so without it, writing "Chicago" into every post is all
 * it takes to farm a city's feed from anywhere in the world. It also raises what a local
 * feed is made of: a post from someone who lives there carries knowledge a remote take
 * does not.
 *
 * The cost, which is real: an outsider's post about a city is no longer tagged, including
 * the informed ones — someone visiting Nashville who has a declared home in Chicago writes
 * an untagged Nashville post. `authorLocation` should be the *same* point the feed uses to
 * decide which local content that user sees (`UserLocationsStore.getPrimary`), which keeps
 * the rule symmetrical: you can only tag a city whose local feed you would be served.
 *
 * Returns null when the author's location is unknown. That is the safe direction rather
 * than an oversight — an unlocatable author cannot be shown to live anywhere, so there is
 * nothing to verify against, and a missing location must never mean "skip the check".
 */
const detectLocality = (
    message?: string | null,
    authorLocation?: IAuthorLocation | null,
): IDetectedLocality | null => {
    if (!message) {
        return null;
    }

    // Null-checked before coercion: both columns are nullable in main.userLocations, and
    // `Number(null)` is 0 — treating a half-written row as the Gulf of Guinea would fail
    // every real comparison while looking like a legitimate distance check.
    if (authorLocation?.latitude == null || authorLocation?.longitude == null) {
        return null;
    }

    const city = findNamedCity(message);
    if (!city) {
        return null;
    }

    const distance = getDistanceInMeters(
        Number(authorLocation.latitude),
        Number(authorLocation.longitude),
        city.lat,
        city.lng,
    );

    // NaN fails this comparison, which is the point: a non-finite coordinate must not pass.
    if (!(distance <= Location.LOCAL_AUTHOR_MAX_DISTANCE_METERS)) {
        return null;
    }

    return {
        latitude: city.lat,
        longitude: city.lng,
        locality: `${city.name}, ${city.stateAbbr}`,
        slug: city.slug,
    };
};

export default detectLocality;
