import fs from 'fs';
import path from 'path';
import { expect } from 'chai';
import { PACT_DECLINE_REASONS, selectPactDeclinedCopyKey } from '../../../src/api/pactDeclinedCopy';

/**
 * The keys are built by string interpolation, so nothing checks them at compile time and
 * `translate` renders the raw key path into the notification tray when one is missing.
 */

const LOCALES = ['en-us', 'es', 'fr-ca'];

const readDictionary = (locale: string): any => JSON.parse(fs.readFileSync(
    path.resolve(__dirname, `../../../src/locales/${locale}/dictionary.json`),
    'utf8',
));

describe('pactDeclined copy selection', () => {
    it('tells the creator a member left, not that the pact was declined', () => {
        expect(selectPactDeclinedCopyKey('memberLeft')).to.equal('pactMemberLeft');
    });

    it('keeps the decline copy when no reason, or one it does not know, is given', () => {
        // An older users-service, or a hand-made request.
        [undefined, null, '', 'abandoned', 42, {}].forEach((value) => {
            expect(selectPactDeclinedCopyKey(value), String(value)).to.equal('pactDeclined');
        });
    });

    it('has a title and body for every selectable key in every locale', () => {
        const keys = ['pactDeclined', ...PACT_DECLINE_REASONS.map(selectPactDeclinedCopyKey)];

        const missing: string[] = [];
        LOCALES.forEach((locale) => {
            const notifications = readDictionary(locale).notifications || {};
            keys.forEach((key) => {
                ['title', 'body'].forEach((field) => {
                    const value = notifications[key]?.[field];
                    if (typeof value !== 'string' || !value.trim()) {
                        missing.push(`${locale} → notifications.${key}.${field}`);
                    }
                });
            });
        });

        expect(missing, 'a missing key renders the raw key path as the push body').to.deep.equal([]);
    });
});
