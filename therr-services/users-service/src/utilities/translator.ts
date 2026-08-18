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
 */
export const translateOptional = (
    locale: string,
    key: string,
    params?: TranslateParams,
): string | undefined => {
    const translated = translator(locale, key, params);

    return translated === key ? undefined : translated;
};

export default translator;
