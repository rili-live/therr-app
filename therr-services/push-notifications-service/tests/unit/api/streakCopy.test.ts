import { expect } from 'chai';
import { PushNotifications } from 'therr-js-utilities/constants';
import enUs from '../../../src/locales/en-us/dictionary.json';
import es from '../../../src/locales/es/dictionary.json';
import frCa from '../../../src/locales/fr-ca/dictionary.json';
import {
    selectStreakAtRiskBodyKey,
    FREEZE_AWARE_COPY_KEYS,
    FREEZE_ANNOUNCEMENT_TYPES,
} from '../../../src/api/streakCopy';

/**
 * Streak freezes are the app's "build in the miss" rule. The mechanic has
 * always worked; what it has never done is say so, which makes it worthless as
 * a rule — the user only learns the net exists by inferring it from a streak
 * number that did not drop.
 *
 * These pin the two places that can silently undo the fix: picking the body
 * that omits the freeze when one is available, and a locale whose translation
 * drops the interpolation and therefore stops telling that locale's users the
 * rule at all (see CLAUDE.md § Localization).
 */
describe('streak freeze copy', () => {
    const dictionaries: [string, any][] = [['en-us', enUs], ['es', es], ['fr-ca', frCa]];

    describe('selectStreakAtRiskBodyKey', () => {
        it('names the freeze when the user still holds one', () => {
            expect(selectStreakAtRiskBodyKey(1)).to.equal('notifications.streakAtRisk.bodyWithFreeze');
            expect(selectStreakAtRiskBodyKey(3)).to.equal('notifications.streakAtRisk.bodyWithFreeze');
        });

        it('falls back to the plain warning when the net is spent', () => {
            expect(selectStreakAtRiskBodyKey(0)).to.equal('notifications.streakAtRisk.body');
        });

        it('treats a missing or unparseable count as no freeze rather than promising one', () => {
            // The field rides on a queued payload written by an older
            // users-service, so absent is the realistic case during a rollout —
            // and promising a net that is not there is the worse failure.
            expect(selectStreakAtRiskBodyKey(undefined)).to.equal('notifications.streakAtRisk.body');
            expect(selectStreakAtRiskBodyKey(null)).to.equal('notifications.streakAtRisk.body');
            expect(selectStreakAtRiskBodyKey('')).to.equal('notifications.streakAtRisk.body');
            expect(selectStreakAtRiskBodyKey(-1)).to.equal('notifications.streakAtRisk.body');
        });
    });

    describe('dictionary coverage', () => {
        dictionaries.forEach(([locale, dictionary]) => {
            FREEZE_AWARE_COPY_KEYS.forEach((key) => {
                it(`${locale} interpolates {freezesRemaining} in ${key}`, () => {
                    const copy = key.split('.').reduce(
                        (node: any, part: string) => node?.[part],
                        dictionary.notifications,
                    );
                    expect(copy, `${locale} is missing notifications.${key}`).to.be.a('string');
                    expect(copy).to.contain('{freezesRemaining}');
                    expect(copy).to.contain('{habitName}');
                });
            });

            it(`${locale} defines a title for every freeze announcement`, () => {
                FREEZE_ANNOUNCEMENT_TYPES.forEach(() => {
                    expect(dictionary.notifications.streakFreezeUsed?.title).to.be.a('string').and.not.empty;
                });
            });
        });
    });

    it('registers streakFreezeUsed as a distinct push type', () => {
        expect(PushNotifications.Types.streakFreezeUsed).to.equal('streak-freeze-used');
        expect(PushNotifications.Types.streakFreezeUsed).to.not.equal(PushNotifications.Types.streakAtRisk);
    });
});
