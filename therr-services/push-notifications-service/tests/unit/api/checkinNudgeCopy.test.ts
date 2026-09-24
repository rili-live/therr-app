import { expect } from 'chai';
import { PushNotifications } from 'therr-js-utilities/constants';
import enUs from '../../../src/locales/en-us/dictionary.json';
import es from '../../../src/locales/es/dictionary.json';
import frCa from '../../../src/locales/fr-ca/dictionary.json';
import {
    formatHabitNames,
    getCheckinNudgeCopyNamespace,
    selectCheckinNudgeBodyKey,
    hasWeeklyTargetCopy,
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

    describe('weekly-progress copy', () => {
        it('is reserved for a cadence that asks for fewer than seven check-ins a week', () => {
            expect(hasWeeklyTargetCopy(4)).to.equal(true);
            expect(hasWeeklyTargetCopy(1)).to.equal(true);
            // Seven a week IS daily, and daily copy is unchanged.
            expect(hasWeeklyTargetCopy(7)).to.equal(false);
            expect(hasWeeklyTargetCopy(undefined)).to.equal(false);
            expect(hasWeeklyTargetCopy(0)).to.equal(false);
            expect(hasWeeklyTargetCopy('four')).to.equal(false);
        });

        it('renders the week for a non-daily habit instead of "log it today"', () => {
            expect(selectCheckinNudgeBodyKey(
                PushNotifications.Types.dailyHabitReminder,
                1,
                'notifications.dailyHabitReminder.body',
                4,
            )).to.equal('notifications.dailyHabitReminder.bodyWeekly');
        });

        it('leaves a daily habit on the daily body', () => {
            // The regression that matters: nearly every habit in production is daily, and none
            // of them should change wording.
            expect(selectCheckinNudgeBodyKey(
                PushNotifications.Types.dailyHabitReminder,
                1,
                'notifications.dailyHabitReminder.body',
                7,
            )).to.equal('notifications.dailyHabitReminder.body');
            expect(selectCheckinNudgeBodyKey(
                PushNotifications.Types.dailyHabitReminder,
                1,
                'notifications.dailyHabitReminder.body',
            )).to.equal('notifications.dailyHabitReminder.body');
        });

        it('yields to the freeze-aware body, which is the more urgent thing to say', () => {
            // A progress count is information; "a freeze will cover tonight" is the rule the
            // user is being held to. Telling someone their streak is on the line while silently
            // holding a net is the exact failure the freeze copy exists to prevent.
            expect(selectCheckinNudgeBodyKey(
                PushNotifications.Types.streakAtRisk,
                1,
                'notifications.streakAtRisk.bodyWithFreeze',
                4,
            )).to.equal('notifications.streakAtRisk.bodyWithFreeze');
        });

        it('yields to the plural body, which outranks everything', () => {
            expect(selectCheckinNudgeBodyKey(
                PushNotifications.Types.streakAtRisk,
                3,
                'notifications.streakAtRisk.body',
                4,
            )).to.equal('notifications.streakAtRisk.bodyMultiple');
        });

        it('uses the weekly body for a non-daily habit with no freeze left', () => {
            expect(selectCheckinNudgeBodyKey(
                PushNotifications.Types.eveningCheckIn,
                1,
                'notifications.eveningCheckIn.body',
                3,
            )).to.equal('notifications.eveningCheckIn.bodyWeekly');
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

        it('resolves the evening nudge to its own plural copy, not the reminder\'s', () => {
            // The failure this pins is silent: before the namespace table, every
            // type that was not `streakAtRisk` fell through to
            // `dailyHabitReminder.bodyMultiple`, so the evening "last chance"
            // push would have rendered "One check-in gets you started" — a
            // gentle opener, in the slot whose entire job is urgency.
            expect(selectCheckinNudgeBodyKey(
                PushNotifications.Types.eveningCheckIn,
                3,
                'notifications.eveningCheckIn.bodyWithFreeze',
            )).to.equal('notifications.eveningCheckIn.bodyMultiple');
        });

        it('keeps the evening nudge\'s freeze-aware singular copy for one habit', () => {
            expect(selectCheckinNudgeBodyKey(
                PushNotifications.Types.eveningCheckIn,
                1,
                'notifications.eveningCheckIn.bodyWithFreeze',
            )).to.equal('notifications.eveningCheckIn.bodyWithFreeze');
        });

        it('falls back to the neutral namespace for an unlisted type', () => {
            // Matches what the ternary this replaced already did, so adding a
            // nudge type without copy degrades rather than throwing a key path
            // at the user as the push body.
            expect(selectCheckinNudgeBodyKey(
                PushNotifications.Types.morningMotivation,
                2,
                'notifications.morningMotivation.body',
            )).to.equal('notifications.dailyHabitReminder.bodyMultiple');
        });
    });

    describe('getCheckinNudgeCopyNamespace', () => {
        it('maps each nudge type to its own dictionary namespace', () => {
            expect(getCheckinNudgeCopyNamespace(PushNotifications.Types.streakAtRisk))
                .to.equal('notifications.streakAtRisk');
            expect(getCheckinNudgeCopyNamespace(PushNotifications.Types.dailyHabitReminder))
                .to.equal('notifications.dailyHabitReminder');
            expect(getCheckinNudgeCopyNamespace(PushNotifications.Types.eveningCheckIn))
                .to.equal('notifications.eveningCheckIn');
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
                    dictionary.notifications.eveningCheckIn.bodyMultiple,
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
                expect(dictionary.notifications.eveningCheckIn.bodyMultiple).to.not.contain('{freezesRemaining}');
            });

            it(`${locale} gives the evening nudge streak-aware copy, not a generic prompt`, () => {
                // The evening slot is the second push a user can receive in a
                // day. A body that could have been written before we knew
                // anything about them — which is what this copy used to be —
                // does not earn that, and it is the difference between a
                // reminder and noise.
                const eveningCheckIn = dictionary.notifications.eveningCheckIn;
                expect(eveningCheckIn.body).to.contain('{streakCount}');
                expect(eveningCheckIn.body).to.contain('{habitName}');
                expect(eveningCheckIn.bodyWithFreeze).to.contain('{freezesRemaining}');
            });
        });
    });
});
