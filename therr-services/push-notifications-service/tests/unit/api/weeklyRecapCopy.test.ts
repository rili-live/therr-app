import fs from 'fs';
import path from 'path';
import { expect } from 'chai';
import {
    resolveWeeklyRecapHeadline,
    selectWeeklyRecapBodyKey,
    selectWeeklyRecapTitleKey,
    DEFAULT_WEEKLY_RECAP_HEADLINE,
    WEEKLY_RECAP_HEADLINES,
} from '../../../src/api/weeklyRecapCopy';

/**
 * The recap's copy selection, and — more importantly — that every key it can select actually
 * exists in all three dictionaries.
 *
 * These keys are built by string concatenation, so nothing checks them at compile time and
 * `translate` renders the raw key path into the notification tray when one is missing. A
 * locale that is simply absent a variant is therefore a shipped bug that no test, lint rule or
 * type would otherwise catch — `npm run locales:check` compares dictionary *shapes* between
 * locales and cannot know which paths the code asks for.
 */

const LOCALES = ['en-us', 'es', 'fr-ca'];

const readDictionary = (locale: string): any => JSON.parse(fs.readFileSync(
    path.resolve(__dirname, `../../../src/locales/${locale}/dictionary.json`),
    'utf8',
));

const lookup = (dictionary: any, keyPath: string): unknown => keyPath
    .split('.')
    .reduce((node: any, segment) => (node === undefined || node === null ? undefined : node[segment]), dictionary);

describe('weeklyRecap copy selection', () => {
    it('uses the headline the server decided rather than re-deriving one', () => {
        WEEKLY_RECAP_HEADLINES.forEach((headline) => {
            expect(resolveWeeklyRecapHeadline(headline), headline).to.equal(headline);
            expect(selectWeeklyRecapBodyKey(headline)).to.equal(`notifications.weeklyRecap.body.${headline}`);
        });
    });

    it('falls back to a variant that is true of any week when the headline is unrecognised', () => {
        // An older users-service, or a hand-made request. `steady` interpolates nothing a
        // fallback could get wrong and is honest about any week with activity in it.
        [undefined, null, '', 'bestWeekEver', 42, {}].forEach((value) => {
            expect(resolveWeeklyRecapHeadline(value as any), String(value)).to.equal(DEFAULT_WEEKLY_RECAP_HEADLINE);
        });
        expect(selectWeeklyRecapBodyKey(undefined)).to.equal('notifications.weeklyRecap.body.steady');
    });

    it('names the perfect week in the title and nothing else', () => {
        expect(selectWeeklyRecapTitleKey('perfectWeek')).to.equal('notifications.weeklyRecap.titlePerfect');
        WEEKLY_RECAP_HEADLINES
            .filter((headline) => headline !== 'perfectWeek')
            .forEach((headline) => {
                expect(selectWeeklyRecapTitleKey(headline), headline).to.equal('notifications.weeklyRecap.title');
            });
    });

    it('has copy for every selectable key in every locale', () => {
        const keyPaths = [
            'notifications.weeklyRecap.title',
            'notifications.weeklyRecap.titlePerfect',
            ...WEEKLY_RECAP_HEADLINES.map((headline) => `notifications.weeklyRecap.body.${headline}`),
        ];

        const missing: string[] = [];
        LOCALES.forEach((locale) => {
            const dictionary = readDictionary(locale);
            keyPaths.forEach((keyPath) => {
                const value = lookup(dictionary, keyPath);
                if (typeof value !== 'string' || !value.trim()) {
                    missing.push(`${locale} → ${keyPath}`);
                }
            });
        });

        expect(missing, 'a missing key renders the raw key path as the push body').to.deep.equal([]);
    });
});
