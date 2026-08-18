import { it, describe, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { BrandVariations } from 'therr-js-utilities/constants';
import { CURRENT_BRAND_VARIATION, BRAND_DISPLAY_NAME } from '../main/config/brandConfig';
import translator from '../main/utilities/translator';

/**
 * Guards the brand surface against cross-brand leakage in either direction.
 *
 * Every assertion here corresponds to something that actually shipped to `general`
 * during the August 2026 Friends with Habits leak, and none of it was caught by a
 * conflict, a type error or a failing test — the whole failure class is silent:
 *
 *  - `applicationId` became com.therr.habits and versionCode went 445 -> 21, which
 *    would have made the flagship Therr app unreleasable on Play.
 *  - The shared locale dictionaries had "Therr" rewritten to "Friends with Habits",
 *    including the Play prominent disclosure that the Therr app itself renders.
 *  - The base theme palettes were overwritten with the Habits purple, even though
 *    `brandColorOverrides` already produced that look the correct way.
 *  - AndroidManifest stripped the location permissions Therr depends on.
 *
 * These are deliberately brand-*relative*: they assert the surface is consistent with
 * whatever `brandConfig.ts` selects, so the same suite passes on `general` and on
 * `niche/<TAG>-general` and fails the moment the two disagree.
 */

const read = (...p: string[]) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

const EXPECTED_APPLICATION_ID: Partial<Record<BrandVariations, string>> = {
    [BrandVariations.THERR]: 'app.therrmobile',
    [BrandVariations.TEEM]: 'com.therr.mobile.Teem',
    [BrandVariations.HABITS]: 'com.therr.habits',
};

// The base palettes are always Therr's. A niche look comes from `brandColorOverrides`
// in styles/themes/index.ts, never from editing these files — see the note at the top
// of brandConfig.ts.
const THERR_BASE_PRIMARY = '#1C7F8A';

const LOCALES = ['en-us', 'es', 'fr-ca'];
const ALL_BRAND_NAMES = ['Therr', 'Teem', 'Friends with Habits'];

/**
 * Brand names that must not appear literally in a shared dictionary: every brand's name
 * except the one this branch builds.
 *
 * "Therr" is always exempt. It is the company, the API domain (api.therr.com) and the
 * currency (TherrCoin), so it appears ~55 times in copy that is correct for every
 * variant. That exemption is why this check is about *other* brands leaking in — which
 * is the direction that actually shipped.
 */
const foreignBrandNames = () => ALL_BRAND_NAMES.filter(
    (name) => name !== BRAND_DISPLAY_NAME && name !== 'Therr',
);

describe('brand surface consistency', () => {
    it('names the same app in brandConfig and strings.xml', () => {
        const stringsXml = read('android/app/src/main/res/values/strings.xml');
        const appName = stringsXml.match(/<string name="app_name">([^<]+)<\/string>/)?.[1];

        expect(appName).toBe(BRAND_DISPLAY_NAME);
    });

    it('uses the applicationId that belongs to the selected brand', () => {
        const buildGradle = read('android/app/build.gradle');
        const applicationId = buildGradle.match(/applicationId "([^"]+)"/)?.[1];

        expect(applicationId).toBe(EXPECTED_APPLICATION_ID[CURRENT_BRAND_VARIATION]);
    });

    it('declares CURRENT_BRAND_VARIATION as the widened enum type', () => {
        // Without the `: BrandVariations` annotation TypeScript narrows this to a single
        // literal member, so every `CURRENT_BRAND_VARIATION === BrandVariations.<other>`
        // guard becomes a false TS2367 naming whichever brand is selected. The error
        // signatures then differ between general and niche/<TAG>-general (general emitted
        // two, HABITS emits none because the else-branch narrows to never), so the mobile
        // tsc baseline disagrees across the split — and a --update run on either branch
        // makes the gate fail on the other.
        //
        // The baseline gate only catches the annotation's removal on general, so this
        // asserts it brand-relatively and holds on both branches.
        const source = read('main/config/brandConfig.ts');

        expect(source).toMatch(/export const CURRENT_BRAND_VARIATION\s*:\s*BrandVariations\s*=/);
    });

    it.each(['light', 'dark'])('keeps the Therr base palette in the %s theme', (theme) => {
        // Only asserted when the selected brand is Therr — i.e. on `general`, which is the
        // branch this actually protects. The leak that shipped was Habits colors reaching
        // `general`, and `general` still selects THERR, so the guard fires there.
        //
        // A niche branch is allowed to rebrand the base palettes. `niche/HABITS-general`
        // does exactly that, because `brandColorOverrides` is one map applied to light,
        // dark and retro alike and cannot express a per-theme value (Habits' retro purple
        // differs from its light/dark purple). Asserting Therr's teal unconditionally
        // therefore fails on every niche branch by construction, which is noise rather
        // than a signal — and a red suite on the branch that triggers the Play build is
        // worse than no suite at all.
        //
        // Anchored to the `primary3:` assignment rather than merely containing the hex —
        // the teal appears on several other keys, so a loose check still passed while
        // primary3 had been swapped to the Habits purple.
        if (CURRENT_BRAND_VARIATION !== BrandVariations.THERR) {
            return;
        }

        const palette = read('main/styles/themes', theme, 'colors.ts');
        const primary3 = palette.match(/^\s*primary3:\s*'([^']+)'/m)?.[1];

        expect(primary3).toBe(THERR_BASE_PRIMARY);
    });

    it.each(LOCALES)('does not name another brand in the %s dictionary', (locale) => {
        // Dictionaries are shared by every variant, so another brand's name renders the
        // wrong app's name for everyone else. Copy that must name the app takes
        // `{appName}` and is passed BRAND_DISPLAY_NAME at the call site.
        const dictionary = read('main/locales', locale, 'dictionary.json');
        const offenders = foreignBrandNames().filter((name) => dictionary.includes(name));

        expect(offenders).toEqual([]);
    });

    it.each(LOCALES)('renders no literal {appName} in the %s dictionary', (locale) => {
        // `{appName}` is how copy names the app without hardcoding a brand. The shared
        // translator only substitutes params that are actually passed and leaves any other
        // placeholder verbatim, so a string whose call site forgets the param renders the
        // literal text "{appName}" on screen — invisible to tsc and to every other test.
        // utilities/translator.ts defaults it; this proves that still holds.
        //
        // Vacuous on a branch whose copy happens not to use {appName} yet, and meaningful
        // the moment it does, which is what keeps one file valid on general and on niche.
        const dictionary = JSON.parse(read('main/locales', locale, 'dictionary.json'));

        const flatten = (obj: Record<string, unknown>, prefix = ''): [string, string][] => Object.entries(obj)
            .flatMap(([key, value]) => {
                const p = prefix ? `${prefix}.${key}` : key;
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    return flatten(value as Record<string, unknown>, p);
                }
                return typeof value === 'string' ? [[p, value] as [string, string]] : [];
            });

        const unresolved = flatten(dictionary)
            .filter(([, value]) => value.includes('{appName}'))
            .map(([key]) => key)
            .filter((key) => translator(locale, key).includes('{appName}'));

        expect(unresolved).toEqual([]);
    });

    it('declares location permissions unless the brand opts out of location', () => {
        // Therr and Teem are location-based. HABITS strips these on its own branch with
        // tools:node="remove"; porting that to general silently disables location for
        // every variant that needs it.
        const manifest = read('android/app/src/main/AndroidManifest.xml');
        const isStripped = /ACCESS_FINE_LOCATION"\s+tools:node="remove"/.test(manifest);

        if (CURRENT_BRAND_VARIATION === BrandVariations.HABITS) {
            expect(isStripped).toBe(true);
        } else {
            expect(isStripped).toBe(false);
            expect(manifest).toContain('android.permission.ACCESS_FINE_LOCATION');
        }
    });
});
