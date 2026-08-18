import { configureTranslator, TranslateParams } from 'therr-js-utilities/localization';
import locales from '../locales';

const translator = configureTranslator(locales);

/**
 * Translates a key that a dictionary is allowed not to have, resolving `undefined` on a miss
 * instead of the key itself.
 *
 * `configureTranslator` returns the key back when it finds nothing — sensible for a required
 * string, where a visible `emails.contactInvite.body2` beats an empty email, but useless for
 * an *optional* per-brand override, where echoing the key would put `invites.phoneTaglines.
 * habits` into an SMS. Comparing against the key is the only miss signal on offer, so this
 * wraps that one awkward comparison rather than repeating it at each call site.
 *
 * Used for copy that only some brands customize: the caller supplies its own fallback, which
 * is either the shared default (`?? translate(locale, baseKey)`) or nothing at all (`?? ''`).
 *
 * The `typeof` check covers the translator's other way of not returning a string: it walks the
 * dictionary by path and hands back whatever it lands on, so a key naming a branch rather than
 * a leaf (`emails.contactInvite.body2ByBrand`, no brand appended) resolves to the object
 * itself. That is a miss for our purposes — and without the guard it would reach a caller
 * typed to expect a string, and render as `[object Object]` in an email or SMS.
 */
export const translateOptional = (
    locale: string,
    key: string,
    params?: TranslateParams,
): string | undefined => {
    const translated = translator(locale, key, params);

    if (typeof translated !== 'string' || translated === key) {
        return undefined;
    }

    return translated;
};

export default translator;
