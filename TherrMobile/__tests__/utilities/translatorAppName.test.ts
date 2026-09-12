import { it, describe, expect } from '@jest/globals';
import translator from '../../main/utilities/translator';
import { BRAND_DISPLAY_NAME } from '../../main/config/brandConfig';
import enUs from '../../main/locales/en-us/dictionary.json';

/**
 * Copy that names the app takes `{appName}` rather than a literal brand name, because the
 * dictionaries are shared by every variant — a hardcoded name renders the wrong app's name
 * for all the others, which is how "Friends with Habits" reached the Therr build's Google
 * Play prominent disclosure.
 *
 * The shared translator only substitutes params that are actually passed and leaves any
 * other placeholder verbatim, so a `{appName}` string whose call site forgets the param
 * renders the literal text "{appName}" on screen. `utilities/translator.ts` defaults it for
 * exactly that reason, and these tests pin that behaviour — the failure is invisible to
 * type-checking and to every other test.
 */

const flatten = (obj: Record<string, unknown>, prefix = ''): Record<string, string> => Object.entries(obj)
    .reduce((acc: Record<string, string>, [key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(acc, flatten(value as Record<string, unknown>, path));
        } else if (typeof value === 'string') {
            acc[path] = value;
        }
        return acc;
    }, {});

describe('translator {appName}', () => {
    it('resolves {appName} when the call site passes no params', () => {
        // The disclosure is the case that matters most: it must name the app the user is
        // actually holding, and PermissionPrimerModal is not the only renderer of these.
        const result = translator('en-us', 'permissions.primer.contacts.summary');

        expect(result).toContain(BRAND_DISPLAY_NAME);
        expect(result).not.toContain('{appName}');
    });

    it('leaves no {appName} unresolved in any string that uses it', () => {
        const entries = Object.entries(flatten(enUs as Record<string, unknown>))
            .filter(([, value]) => value.includes('{appName}'));

        // Guards the premise — if this is empty the assertion below proves nothing.
        expect(entries.length).toBeGreaterThan(0);

        const unresolved = entries
            .map(([key]) => [key, translator('en-us', key)] as const)
            .filter(([, translated]) => translated.includes('{appName}'))
            .map(([key]) => key);

        expect(unresolved).toEqual([]);
    });

    it('lets an explicit appName param win over the default', () => {
        const result = translator('en-us', 'permissions.primer.contacts.summary', { appName: 'Overridden' });

        expect(result).toContain('Overridden');
    });
});
