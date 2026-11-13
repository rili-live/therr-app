/**
 * Server side of the Friends with Habits web app (habits.therr.com/app).
 *
 * The app itself is a static script (src/_static/habits/app.js) rendered into the shell
 * view views/habits/app.hbs. This module decides which paths get the shell, which language
 * the shell speaks, and what is serialized into it.
 *
 * Kept out of server-client.tsx so it is unit-testable: importing that file starts an
 * Express listener.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import serialize from 'serialize-javascript';
import enUsDictionary from '../habitsAppLocales/en-us/dictionary.json';
import esDictionary from '../habitsAppLocales/es/dictionary.json';
import frCaDictionary from '../habitsAppLocales/fr-ca/dictionary.json';
import {
    HABITS_LANDING_LOCALES,
    HABITS_ORIGIN,
    HabitsLandingLocale,
    parseHabitsAcceptLanguage,
    readHabitsLocaleCookie,
} from './habitsLanding';

export type HabitsAppCopy = typeof enUsDictionary;

const HABITS_APP_DICTIONARIES: Record<HabitsLandingLocale, HabitsAppCopy> = {
    'en-us': enUsDictionary,
    es: esDictionary,
    'fr-ca': frCaDictionary,
};

export const HABITS_APP_BASE_PATH = '/app';

// Mirrors parseRoute in src/_static/habits/app.js. The server only decides whether to send
// the shell; the client decides what the path means. A path outside this list 404s here
// rather than rendering a shell that would show the today view under a wrong URL.
const HABITS_APP_PATH_RE = /^\/app(?:\/(?:discover|habits\/[0-9a-fA-F-]{8,64}))?\/?$/;

export const isHabitsAppPath = (pathname: string): boolean => HABITS_APP_PATH_RE.test(pathname);

/**
 * The shell's language: the landing page's remembered switcher choice, then the browser's
 * Accept-Language, then English. There is no locale in the app's URL; it is a signed-in,
 * noindex surface, so one URL per page is worth more than a shareable Spanish link.
 */
export const resolveHabitsAppLocale = ({ cookieHeader, acceptLanguage }: {
    cookieHeader?: string | null;
    acceptLanguage?: string | null;
}): HabitsLandingLocale => readHabitsLocaleCookie(cookieHeader)
    || parseHabitsAcceptLanguage(acceptLanguage)
    || 'en-us';

/**
 * A short content hash of the app script, for the `?v=` on its script tag.
 *
 * Everything under build/static is served `immutable` for a year, which is right for the
 * hashed webpack bundles and wrong for a hand-written file with a stable name: without a
 * version in the URL a returning visitor would keep running last month's app. Read once
 * per process by the caller; '0' when the file is missing so a bad path degrades to an
 * unversioned URL instead of failing the render.
 */
export const computeHabitsAppAssetVersion = (filePath: string): string => {
    try {
        return crypto.createHash('sha256').update(fs.readFileSync(filePath, 'utf8')).digest('hex').slice(0, 12);
    } catch (err) {
        return '0';
    }
};

export const buildHabitsAppViewContext = (
    locale: HabitsLandingLocale,
    { apiBase, assetVersion, pathname }: { apiBase: string; assetVersion: string; pathname: string },
) => {
    const copy = HABITS_APP_DICTIONARIES[locale] || enUsDictionary;
    const landingLocale = HABITS_LANDING_LOCALES.find((config) => config.locale === locale) || HABITS_LANDING_LOCALES[0];

    return {
        t: copy,
        // The shared footer partial, in the same language as the shell.
        footerCopy: landingLocale.copy.footer,
        htmlLang: landingLocale.htmlLang,
        title: copy.meta.title,
        description: copy.meta.description,
        canonicalUrl: `${HABITS_ORIGIN}${pathname.replace(/\/+$/, '') || HABITS_APP_BASE_PATH}`,
        assetVersion,
        // serialize-javascript escapes <, >, / and friends, so this is safe inside <script>.
        // Nothing here is per-user: the session lives in the browser's storage, and the
        // shell is the same for everyone who speaks the same language.
        bootJson: serialize({ apiBase, locale, dictionary: copy }, { isJSON: true }),
    };
};
