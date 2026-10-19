import { expect } from 'chai';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import { createMessage, isTypeAllowedForBrand } from '../../../src/api/firebaseAdmin';
import { NOTIFICATION_TITLE_EMOJI, withTitleEmoji } from '../../../src/api/notificationTitleEmoji';

/**
 * Habits push titles lead with a per-type emoji so a stack of notifications that land
 * together can be told apart without reading each one. These pin that every type the
 * Habits app can receive gets its emoji on whichever surface renders the title — the
 * OS (`notification.title`), Notifee (`data.notificationTitle`) and the iOS alert — and
 * that Therr's titles are untouched.
 */

const config = {
    deviceToken: 'test-device-token',
    userId: 'a2b1c0d9-0000-4000-8000-000000000001',
    userLocale: 'en-us',
    fromUserName: 'partner',
    habitName: 'Morning run',
    partnerName: 'Sam',
    streakCount: 12,
    rank: 4,
};

const ALL_TYPES = Object.values(PushNotifications.Types) as PushNotifications.Types[];

// The title of a built message, from wherever its renderer reads it.
const titlesOf = (message: any): string[] => [
    message.notification?.title,
    message.data?.notificationTitle,
    message.apns?.payload?.aps?.alert?.title,
].filter((title) => title !== undefined);

describe('notification title emoji', () => {
    it('gives every type a distinct emoji', () => {
        const emoji = ALL_TYPES.map((type) => NOTIFICATION_TITLE_EMOJI[type]);
        emoji.forEach((value, index) => {
            expect(value, `${ALL_TYPES[index]} has no emoji`).to.be.a('string').that.is.not.empty;
        });
        const duplicates = emoji.filter((value, index) => emoji.indexOf(value) !== index);
        expect(duplicates, 'two types share an emoji').to.deep.equal([]);
    });

    ALL_TYPES
        .filter((type) => isTypeAllowedForBrand(type, BrandVariations.HABITS))
        .forEach((type) => {
            const message: any = createMessage(type, {}, config as any, BrandVariations.HABITS);
            if (!message) {
                return;
            }
            it(`prefixes the "${type}" title for HABITS on every surface that renders it`, () => {
                const titles = titlesOf(message);
                expect(titles, `${type} built no title`).to.not.be.empty;
                titles.forEach((title) => {
                    expect(title).to.match(new RegExp(`^${NOTIFICATION_TITLE_EMOJI[type]} \\S`));
                });
            });
        });

    it('leaves THERR titles unchanged', () => {
        const message: any = createMessage(PushNotifications.Types.newDirectMessage, {}, config as any, BrandVariations.THERR);
        titlesOf(message).forEach((title) => {
            expect(title.startsWith(NOTIFICATION_TITLE_EMOJI[PushNotifications.Types.newDirectMessage])).to.equal(false);
        });
    });

    it('does not prefix twice, and passes unknown types and empty titles through', () => {
        const once = withTitleEmoji('Milestone Hit!', PushNotifications.Types.streakMilestone, BrandVariations.HABITS);
        expect(once).to.equal('🏅 Milestone Hit!');
        expect(withTitleEmoji(once, PushNotifications.Types.streakMilestone, BrandVariations.HABITS)).to.equal(once);
        expect(withTitleEmoji('Hello', 'not-a-type', BrandVariations.HABITS)).to.equal('Hello');
        expect(withTitleEmoji('', PushNotifications.Types.streakMilestone, BrandVariations.HABITS)).to.equal('');
    });
});
