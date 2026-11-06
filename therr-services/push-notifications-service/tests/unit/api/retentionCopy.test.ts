import fs from 'fs';
import path from 'path';
import { expect } from 'chai';
import {
    isRetentionMessageVariant,
    RETENTION_MESSAGE_VARIANTS,
    selectPactRenewalBodyKey,
    selectRetentionCopyKeys,
} from '../../../src/api/retentionCopy';

/**
 * The keys are built by string interpolation, so nothing checks them at compile time and
 * `translate` renders the raw key path into the notification tray when one is missing.
 */

const LOCALES = ['en-us', 'es', 'fr-ca'];

const readDictionary = (locale: string): any => JSON.parse(fs.readFileSync(
    path.resolve(__dirname, `../../../src/locales/${locale}/dictionary.json`),
    'utf8',
));

const lookup = (dictionary: any, key: string): unknown => key.split('.').reduce((node, part) => node?.[part], dictionary);

describe('Retention copy selection', () => {
    it('renders the ordinary reminder for no variant, or one it does not know', () => {
        [undefined, null, '', 'comeback-v2', 42, {}].forEach((value) => {
            expect(selectRetentionCopyKeys(value, 'Sam'), String(value)).to.equal(null);
            expect(isRetentionMessageVariant(value)).to.equal(false);
        });
    });

    it('names the partner only when there is a partner name to put in the copy', () => {
        expect(selectRetentionCopyKeys('day-two', 'Sam')).to.deep.equal({
            titleKey: 'notifications.habitRetention.dayTwo.title',
            bodyKey: 'notifications.habitRetention.dayTwo.bodyWithPartner',
        });
        [undefined, '', '   '].forEach((name) => {
            expect(selectRetentionCopyKeys('day-two', name)?.bodyKey).to.equal('notifications.habitRetention.dayTwo.body');
        });
    });

    it('only promises to keep a streak there is one to keep', () => {
        expect(selectPactRenewalBodyKey('pactExpiring', 12)).to.equal('notifications.pactExpiring.bodyWithStreak');
        expect(selectPactRenewalBodyKey('pactExpiring', 0)).to.equal('notifications.pactExpiring.body');
        expect(selectPactRenewalBodyKey('pactEnded', undefined)).to.equal('notifications.pactEnded.body');
        expect(selectPactRenewalBodyKey('pactEnded', '4')).to.equal('notifications.pactEnded.bodyWithStreak');
    });

    it('has every selectable key in every locale', () => {
        const keys = new Set<string>();
        RETENTION_MESSAGE_VARIANTS.forEach((variant) => {
            [undefined, 'Sam'].forEach((partnerName) => {
                const selected = selectRetentionCopyKeys(variant, partnerName);
                if (selected) {
                    keys.add(selected.titleKey);
                    keys.add(selected.bodyKey);
                }
            });
        });
        (['pactExpiring', 'pactEnded'] as const).forEach((type) => {
            keys.add(selectPactRenewalBodyKey(type, 0));
            keys.add(selectPactRenewalBodyKey(type, 5));
        });

        const missing: string[] = [];
        LOCALES.forEach((locale) => {
            const dictionary = readDictionary(locale);
            keys.forEach((key) => {
                const value = lookup(dictionary, key);
                if (typeof value !== 'string' || !value.trim()) {
                    missing.push(`${locale} → ${key}`);
                }
            });
        });

        expect(missing, 'a missing key renders the raw key path as the push body').to.deep.equal([]);
    });

    it('never tells a lapsed user about the streak they lost', () => {
        // The abstinence violation effect (docs/HABIT_LIFECYCLE_MESSAGING.md): citing a broken
        // streak turns a lapse into a relapse. The comeback copy takes no streak placeholder.
        LOCALES.forEach((locale) => {
            const block = readDictionary(locale).notifications.habitRetention;
            ['comeback', 'comebackNoBonus', 'freshStart'].forEach((variant) => {
                Object.values(block[variant]).forEach((text) => {
                    expect(String(text), `${locale} ${variant}`).to.not.include('{streakCount}');
                    expect(String(text), `${locale} ${variant}`).to.not.include('{bestStreakCount}');
                });
            });
        });
    });
});
