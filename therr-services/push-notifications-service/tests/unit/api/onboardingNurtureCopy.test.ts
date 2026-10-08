import { expect } from 'chai';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import { createMessage, isTypeAllowedForBrand } from '../../../src/api/firebaseAdmin';

/**
 * The Habits onboarding nurture pushes (#3011): the no-habit nudge, the inviter's "they haven't
 * joined yet", and the founder offer. Two of them interpolate a name or a number, and a payload
 * field dropped between the digest and here renders a hole with no error — which is what these
 * pin, in every locale.
 */

const baseConfig = {
    deviceToken: 'test-device-token',
    userId: 'a2b1c0d9-0000-4000-8000-000000000001',
    userLocale: 'en-us',
    partnerName: 'Sam',
    habitName: 'Morning run',
    checkinCount: 4,
    pactId: 'b7c2d1e0-0000-4000-8000-000000000002',
};

const build = (type: PushNotifications.Types, overrides: Record<string, any> = {}): any => createMessage(
    type,
    {},
    { ...baseConfig, ...overrides } as any,
    BrandVariations.HABITS,
);

const TYPES = [
    PushNotifications.Types.habitsFirstHabitNudge,
    PushNotifications.Types.pactInviteUnclaimed,
    PushNotifications.Types.habitsFounderOffer,
];

describe('onboarding nurture push copy', () => {
    it('names the invitee and the habit on the inviter prompt', () => {
        const message = build(PushNotifications.Types.pactInviteUnclaimed);

        expect(message.notification.title).to.contain('Sam');
        expect(message.notification.body).to.contain('Morning run');
    });

    it('counts the check-ins on the founder offer', () => {
        expect(build(PushNotifications.Types.habitsFounderOffer).notification.title).to.contain('4');
    });

    // Every claim here has to be true on the day it ships: the founder unlock is a one-time
    // purchase of unlimited habits. No price, no spots-left count, no guarantee (#3016 owns those).
    it('makes no claim the founder unlock does not keep', () => {
        const { body } = build(PushNotifications.Types.habitsFounderOffer).notification;

        expect(body).to.not.match(/\$|\d+ (spots|left)|guarantee|refund/i);
    });

    TYPES.forEach((type) => {
        it(`${type} is Habits-only`, () => {
            expect(isTypeAllowedForBrand(type, BrandVariations.HABITS)).to.equal(true);
            expect(isTypeAllowedForBrand(type, BrandVariations.THERR)).to.equal(false);
        });

        ['en-us', 'es', 'fr-ca'].forEach((userLocale) => {
            it(`${type} renders every placeholder in ${userLocale}`, () => {
                const message = build(type, { userLocale });

                expect(message.notification.title).to.be.a('string').and.not.match(/\{\w+\}/);
                expect(message.notification.title).to.not.contain('notifications.');
                expect(message.notification.body).to.be.a('string').and.not.match(/\{\w+\}/);
            });
        });
    });
});
