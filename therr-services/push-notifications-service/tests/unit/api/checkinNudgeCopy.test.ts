import { expect } from 'chai';
import { PushNotifications } from 'therr-js-utilities/constants';
import enUs from '../../../src/locales/en-us/dictionary.json';
import es from '../../../src/locales/es/dictionary.json';
import frCa from '../../../src/locales/fr-ca/dictionary.json';
import {
    formatHabitNames,
    selectCheckinNudgeBodyKey,
    shouldOfferOnePressCheckin,
    MAX_LISTED_HABIT_NAMES,
} from '../../../src/api/checkinNudgeCopy';

/**
 * The digest now rolls a user's whole day of check-in nudges into ONE
 * notification (users-service `checkinNudgeRollup`). Two things can silently
 * undo that from this side:
 *
 *  - rendering the singular body for a roll-up, which reads as a notification
 *    about one habit while quietly standing in for four; and
 *  - offering a "Check In" button on a roll-up, which would either do nothing
 *    or check in whichever habit happened to sort first.
 *
 * Both are pinned here, along with the locale coverage the plural copy needs —
 * a locale missing `bodyMultiple` falls back to the *key string itself*
 * (therr-js-utilities/src/localization.ts returns the key on a miss), so the
 * failure is a push body reading "notifications.streakAtRisk.bodyMultiple".
 */
describe('check-in nudge copy', () => {
    const dictionaries: [string, any][] = [['en-us', enUs], ['es', es], ['fr-ca', frCa]];

    describe('shouldOfferOnePressCheckin', () => {
        it('offers the button for a single-habit nudge', () => {
            expect(shouldOfferOnePressCheckin('goal-1', 1)).to.equal(true);
        });

        it('offers it when habitCount is absent — a producer that predates the roll-up', () => {
            // partnerCheckedIn and the lifecycle senders name one habit and
            // never set a count. Treating "no count" as "several" would drop the
            // button from every one of them.
            expect(shouldOfferOnePressCheckin('goal-1', undefined)).to.equal(true);
            expect(shouldOfferOnePressCheckin('goal-1', null)).to.equal(true);
        });

        it('withholds it from a roll-up covering several habits', () => {
            expect(shouldOfferOnePressCheckin('goal-1', 2)).to.equal(false);
            expect(shouldOfferOnePressCheckin('goal-1', 7)).to.equal(false);
        });

        it('withholds it when no habit goal is addressable', () => {
            // The action POSTs this id to /habits/checkins. Without one the
            // button is a no-op the user has already tapped.
            expect(shouldOfferOnePressCheckin(undefined, 1)).to.equal(false);
            expect(shouldOfferOnePressCheckin('', 1)).to.equal(false);
            expect(shouldOfferOnePressCheckin(42, 1)).to.equal(false);
        });
    });

    describe('selectCheckinNudgeBodyKey', () => {
        const singular = 'notifications.streakAtRisk.bodyWithFreeze';

        it('keeps the singular key — including the freeze variant — for one habit', () => {
            expect(selectCheckinNudgeBodyKey(PushNotifications.Types.streakAtRisk, 1, singular))
                .to.equal(singular);
            expect(selectCheckinNudgeBodyKey(PushNotifications.Types.streakAtRisk, undefined, singular))
                .to.equal(singular);
        });

        it('swaps to the plural body once the nudge covers more than one habit', () => {
            expect(selectCheckinNudgeBodyKey(PushNotifications.Types.streakAtRisk, 3, singular))
                .to.equal('notifications.streakAtRisk.bodyMultiple');
            expect(selectCheckinNudgeBodyKey(
                PushNotifications.Types.dailyHabitReminder,
                2,
                'notifications.dailyHabitReminder.body',
            )).to.equal('notifications.dailyHabitReminder.bodyMultiple');
        });
    });

    describe('formatHabitNames', () => {
        it('renders an array as a comma list', () => {
            expect(formatHabitNames(['Reading', 'Gym'])).to.equal('Reading, Gym');
        });

        it('parses the JSON-string form the FCM data map forces', () => {
            // The value round-trips through jsonb on the queue and through FCM's
            // string->string data map, so it arrives as an array on one path and
            // a string on the other.
            expect(formatHabitNames('["Reading","Gym"]')).to.equal('Reading, Gym');
        });

        it(`truncates at ${MAX_LISTED_HABIT_NAMES} so the body stays readable`, () => {
            expect(formatHabitNames(['A', 'B', 'C', 'D', 'E'])).to.equal('A, B, C');
        });

        it('degrades to something renderable rather than throwing', () => {
            expect(formatHabitNames(undefined)).to.equal('');
            expect(formatHabitNames(null)).to.equal('');
            expect(formatHabitNames({})).to.equal('');
            expect(formatHabitNames('Reading')).to.equal('Reading');
            expect(formatHabitNames([null, 'Gym', 3])).to.equal('Gym');
        });
    });

    describe('dictionary coverage', () => {
        dictionaries.forEach(([locale, dictionary]) => {
            it(`${locale} has plural check-in bodies that interpolate the count and the names`, () => {
                [
                    dictionary.notifications.streakAtRisk.bodyMultiple,
                    dictionary.notifications.dailyHabitReminder.bodyMultiple,
                ].forEach((copy) => {
                    expect(copy, `${locale} is missing a bodyMultiple`).to.be.a('string');
                    expect(copy).to.contain('{habitCount}');
                    expect(copy).to.contain('{habitNames}');
                });
            });

            it(`${locale} has labels for both notification action buttons`, () => {
                expect(dictionary.notifications.shared.pressActionCheckIn).to.be.a('string').that.is.not.empty;
                expect(dictionary.notifications.shared.pressActionView).to.be.a('string').that.is.not.empty;
            });

            it(`${locale} keeps the plural bodies free of the per-habit freeze clause`, () => {
                // A freeze count is per habit; naming one while the copy covers
                // three promises a net over habits it does not cover.
                expect(dictionary.notifications.streakAtRisk.bodyMultiple).to.not.contain('{freezesRemaining}');
            });
        });
    });
});
