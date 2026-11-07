import fs from 'fs';
import path from 'path';
import { expect } from 'chai';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import { createMessage } from '../../../src/api/firebaseAdmin';
import { shouldOfferPauseAction } from '../../../src/api/checkinNudgeCopy';

/**
 * "Pause" on a check-in nudge whose streak ends tonight with no freezes left. The producer decides
 * (`offerPause`); this pins that the push renders the button and the body that names it only then,
 * on both the streak-at-risk nudge and the evening "last chance" one.
 */

const config = {
    deviceToken: 'device-token',
    userId: 'user-1',
    userLocale: 'en-us',
    habitName: 'Running',
    habitGoalId: 'goal-1',
    habitCount: 1,
    streakCount: 12,
    freezesRemaining: 0,
};

const parseActions = (message: any): string[] => JSON
    .parse(message.data.notificationLinkPressActions || '[]')
    .map((action: { id: string }) => action.id);

const NUDGE_TYPES = [
    PushNotifications.Types.streakAtRisk,
    PushNotifications.Types.eveningCheckIn,
];

describe('pause offer on check-in nudges', () => {
    NUDGE_TYPES.forEach((type) => {
        describe(type, () => {
            it('offers Pause beside Check In, and says so in the body, when the producer asks', () => {
                const message: any = createMessage(type, {}, { ...config, offerPause: true } as any, BrandVariations.HABITS);

                expect(parseActions(message)).to.deep.equal([
                    PushNotifications.PressActionIds.habitCheckin,
                    PushNotifications.PressActionIds.habitPause,
                    PushNotifications.PressActionIds.checkinView,
                ]);
                expect(message.data.notificationBody).to.contain('pause');
                expect(message.data.notificationBody).to.contain('12-day');
                expect(message.data.habitGoalId).to.equal('goal-1');
            });

            it('offers nothing new without the flag', () => {
                const message: any = createMessage(type, {}, config as any, BrandVariations.HABITS);

                expect(parseActions(message)).to.not.include(PushNotifications.PressActionIds.habitPause);
                expect(message.data.notificationBody).to.not.contain('pause');
            });

            it('never offers Pause on a roll-up, which names no single habit', () => {
                const message: any = createMessage(type, {}, {
                    ...config,
                    offerPause: true,
                    habitGoalId: undefined,
                    habitCount: 3,
                    habitNames: ['Running', 'Reading', 'Saving'],
                } as any, BrandVariations.HABITS);

                expect(parseActions(message)).to.not.include(PushNotifications.PressActionIds.habitPause);
            });

            it('prefers the pause body over the weekly-progress body', () => {
                const message: any = createMessage(type, {}, {
                    ...config, offerPause: true, weekDone: 1, weekTarget: 3, daysLeft: 2,
                } as any, BrandVariations.HABITS);

                expect(message.data.notificationBody).to.contain('pause');
            });
        });
    });

    it('reads the flag after a string round-trip through the queue', () => {
        expect(shouldOfferPauseAction({ offerPause: 'true', habitGoalId: 'g', habitCount: '1' })).to.equal(true);
        expect(shouldOfferPauseAction({ offerPause: 'false', habitGoalId: 'g' })).to.equal(false);
        expect(shouldOfferPauseAction({ offerPause: true, habitGoalId: '' })).to.equal(false);
    });

    it('has the button label and both bodies in every locale', () => {
        ['en-us', 'es', 'fr-ca'].forEach((locale) => {
            const dictionary = JSON.parse(fs.readFileSync(
                path.resolve(__dirname, `../../../src/locales/${locale}/dictionary.json`),
                'utf8',
            ));
            expect(dictionary.notifications.shared.pressActionPause, locale).to.be.a('string').and.not.equal('');
            expect(dictionary.notifications.streakAtRisk.bodyOfferPause, locale).to.contain('{streakCount}');
            expect(dictionary.notifications.eveningCheckIn.bodyOfferPause, locale).to.contain('{habitName}');
        });
    });
});
