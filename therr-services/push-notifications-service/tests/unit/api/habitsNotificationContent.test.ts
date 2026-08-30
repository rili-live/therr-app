import { expect } from 'chai';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import { createMessage, isTypeAllowedForBrand } from '../../../src/api/firebaseAdmin';

const config = {
    deviceToken: 'device-token',
    userId: 'user-1',
    userLocale: 'en-us',
};

const parseActions = (message: any): { id: string; title: string }[] => JSON
    .parse(message.data.notificationLinkPressActions || '[]');

/**
 * What a Friends with Habits user actually sees in the tray.
 *
 * Three separate defects shipped here, all of them invisible to a type checker
 * and none of them caught by "did the push send" monitoring:
 *
 *  1. `{partnerName}` rendered verbatim in three titles, because `translate`
 *     substitutes only the params it is handed and those calls handed it none.
 *  2. Therr's map/moment retention copy reached Habits handsets — correct copy
 *     for the wrong app, unfixable in the dictionary because it is right for
 *     Therr.
 *  3. Check-in nudges had no way to act on them, which is the whole reason the
 *     roll-up carries `habitGoalId`.
 */
describe('habits notification content', () => {
    describe('partner copy interpolation', () => {
        const partnerTypes = [
            PushNotifications.Types.partnerCheckedIn,
            PushNotifications.Types.partnerMissedDay,
            PushNotifications.Types.partnerCelebrated,
        ];

        partnerTypes.forEach((type) => {
            it(`renders the partner's name in the "${type}" title instead of a placeholder`, () => {
                const message: any = createMessage(type, {}, {
                    ...config,
                    partnerName: 'Dana',
                    habitName: 'Reading',
                    streakCount: 12,
                }, BrandVariations.HABITS);

                expect(message.data.notificationTitle).to.contain('Dana');
                expect(message.data.notificationTitle).to.not.contain('{partnerName}');
                expect(message.data.notificationBody).to.not.contain('{partnerName}');
            });

            it(`falls back to the sending user's name for "${type}"`, () => {
                const message: any = createMessage(type, {}, {
                    ...config,
                    fromUserName: 'Sam',
                }, BrandVariations.HABITS);

                expect(message.data.notificationTitle).to.contain('Sam');
            });
        });
    });

    describe('brand gating', () => {
        const therrProductTypes = [
            PushNotifications.Types.createAMomentReminder,
            PushNotifications.Types.newAreasActivated,
            PushNotifications.Types.nudgeSpaceEngagement,
            PushNotifications.Types.proximityRequiredSpace,
            PushNotifications.Types.latestPostLikesStats,
        ];

        therrProductTypes.forEach((type) => {
            it(`blocks "${type}" on HABITS but keeps it on THERR`, () => {
                expect(isTypeAllowedForBrand(type, BrandVariations.HABITS)).to.equal(false);
                expect(isTypeAllowedForBrand(type, BrandVariations.THERR)).to.equal(true);
                expect(isTypeAllowedForBrand(type, BrandVariations.TEEM)).to.equal(true);
            });
        });

        it('leaves the cross-brand types alone', () => {
            // Habits ships achievements, leaderboards, connections, DMs and
            // groups. Excluding these would silence real product surfaces.
            [
                PushNotifications.Types.achievementCompleted,
                PushNotifications.Types.leaderboardRankMilestone,
                PushNotifications.Types.newConnectionRequest,
                PushNotifications.Types.newDirectMessage,
                PushNotifications.Types.newGroupMessage,
            ].forEach((type) => {
                expect(isTypeAllowedForBrand(type, BrandVariations.HABITS)).to.equal(true);
            });
        });

        it('never blocks a habits type on the habits brand', () => {
            [
                PushNotifications.Types.streakAtRisk,
                PushNotifications.Types.dailyHabitReminder,
                PushNotifications.Types.partnerCheckedIn,
                PushNotifications.Types.pactInvitation,
            ].forEach((type) => {
                expect(isTypeAllowedForBrand(type, BrandVariations.HABITS)).to.equal(true);
            });
        });
    });

    describe('check-in action buttons', () => {
        const nudgeTypes = [
            PushNotifications.Types.streakAtRisk,
            PushNotifications.Types.dailyHabitReminder,
            PushNotifications.Types.partnerCheckedIn,
            PushNotifications.Types.habitMaintenanceCheckIn,
        ];

        nudgeTypes.forEach((type) => {
            it(`offers a one-press check-in on "${type}" when one habit is named`, () => {
                const message: any = createMessage(type, {}, {
                    ...config,
                    habitGoalId: 'goal-1',
                    habitName: 'Reading',
                    habitCount: 1,
                    streakCount: 4,
                }, BrandVariations.HABITS);

                const actions = parseActions(message);
                expect(actions.map((a) => a.id)).to.include(PushNotifications.PressActionIds.habitCheckin);
                // The device needs the goal id to POST the check-in.
                expect(message.data.habitGoalId).to.equal('goal-1');
                actions.forEach((action) => {
                    expect(action.title, `${type} action ${action.id} has no label`).to.be.a('string').that.is.not.empty;
                });
            });
        });

        it('withholds the check-in action from a roll-up covering several habits', () => {
            const message: any = createMessage(PushNotifications.Types.streakAtRisk, {}, {
                ...config,
                habitName: 'Reading',
                habitCount: 3,
                habitNames: ['Reading', 'Gym', 'Journaling'],
                streakCount: 9,
            }, BrandVariations.HABITS);

            const actionIds = parseActions(message).map((a) => a.id);
            expect(actionIds).to.not.include(PushNotifications.PressActionIds.habitCheckin);
            // Still tappable — the user gets a way through to the list.
            expect(actionIds).to.include(PushNotifications.PressActionIds.checkinView);
        });

        it('renders the plural body with the count and the habit names', () => {
            const message: any = createMessage(PushNotifications.Types.streakAtRisk, {}, {
                ...config,
                habitName: 'Reading',
                habitCount: 3,
                habitNames: ['Reading', 'Gym', 'Journaling'],
                streakCount: 9,
                freezesRemaining: 2,
            }, BrandVariations.HABITS);

            expect(message.data.notificationBody).to.contain('3');
            expect(message.data.notificationBody).to.contain('Reading, Gym, Journaling');
            // A missed placeholder is the visible failure mode here.
            expect(message.data.notificationBody).to.not.contain('{');
        });

        it('keeps the singular freeze-aware body when only one habit is at stake', () => {
            const message: any = createMessage(PushNotifications.Types.streakAtRisk, {}, {
                ...config,
                habitGoalId: 'goal-1',
                habitName: 'Reading',
                habitCount: 1,
                streakCount: 9,
                freezesRemaining: 2,
            }, BrandVariations.HABITS);

            expect(message.data.notificationBody).to.contain('Reading');
            expect(message.data.notificationBody).to.contain('2');
            expect(message.data.notificationBody).to.not.contain('{');
        });
    });
});
