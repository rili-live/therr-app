import Cities, { ICityEntry } from '../constants/Cities';

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
 * This is how a human-authored thought gets coordinates. There is no inference from where
 * the author lives — a post is tagged only when its own text names a city, so the column
 * means the same thing for a person as it does for a bot: this post is *about* this place,
 * not written from it. "Chicago pizza is overrated" is a Chicago post no matter where the
 * author is sitting, and belongs in front of people who will argue about it.
 *
 * Returns null unless exactly one distinct city is named. A post that mentions two —
 * "flying from Seattle to Denver tomorrow" — is about a journey, not a place, and picking
 * the first mention would be a coin flip that drops a travel post into one random city's
 * feed. Naming the same city several times is still one city, and still tagged.
 */
const detectLocality = (message?: string | null): IDetectedLocality | null => {
    if (!message) {
        return null;
    }

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

    return {
        latitude: matchedCity.lat,
        longitude: matchedCity.lng,
        locality: `${matchedCity.name}, ${matchedCity.stateAbbr}`,
        slug: matchedCity.slug,
    };
};

export default detectLocality;
