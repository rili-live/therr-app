import { configureTranslator, TranslateParams } from 'therr-js-utilities/localization';
import locales from '../locales';
import { BRAND_DISPLAY_NAME } from '../config/brandConfig';

const translate = configureTranslator(locales);

/**
 * Wraps the shared translator so `{appName}` always resolves.
 *
 * Dictionaries are shared by every brand variant, so copy that names the app must not
 * hardcode one — a literal name renders the wrong app's name for every other variant.
 * Those strings take `{appName}` instead.
 *
 * The underlying translator only substitutes params that are actually passed, and leaves
 * any other placeholder in the output verbatim. Defaulting it here rather than at each
 * call site means a new `{appName}` string cannot render as the literal text "{appName}"
 * just because someone forgot to thread the param through — most such strings are rendered
 * somewhere that passes no params at all. An explicit `params.appName` still wins, since it
 * is spread last.
 */
const translator = (locale: string, key: string, params?: TranslateParams): string => translate(
    locale,
    key,
    { appName: BRAND_DISPLAY_NAME, ...params },
);

export default translator;
