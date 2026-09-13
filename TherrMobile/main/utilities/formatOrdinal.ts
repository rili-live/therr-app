import translator from './translator';

export type OrdinalCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

/**
 * Which ordinal form a number takes in a locale — `one` for English 1/21/31 ("st"), `two` for
 * 2/22 ("nd"), `few` for 3/23 ("rd"), `other` for the rest; French has only `one` (1er) and
 * `other` (2e). A suffix rule in code would be English-only, so the rule comes from the
 * platform and the suffix from the dictionary.
 *
 * Falls back to `other` where `Intl.PluralRules` is unavailable or the locale unknown — the
 * fallback form is the common one in every locale shipped here.
 */
export const getOrdinalCategory = (locale: string, value: number): OrdinalCategory => {
    try {
        return new Intl.PluralRules(locale, { type: 'ordinal' }).select(value) as OrdinalCategory;
    } catch {
        return 'other';
    }
};

/**
 * Render a number as a localised ordinal ("21st", "1er", "21") through the dictionary keys
 * under `keyPrefix` — one per plural category the locale uses, each interpolating `{n}`.
 */
export const formatOrdinal = (locale: string, value: number, keyPrefix: string): string => {
    const category = getOrdinalCategory(locale, value);
    const formatted = translator(locale, `${keyPrefix}.${category}`, { n: value });
    // `translator` hands the key back when it is not a dictionary path; treat that as "this
    // locale has no form for this category" and use the common one.
    return formatted === `${keyPrefix}.${category}`
        ? translator(locale, `${keyPrefix}.other`, { n: value })
        : formatted;
};

export default formatOrdinal;
