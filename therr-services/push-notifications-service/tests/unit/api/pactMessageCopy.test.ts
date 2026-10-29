import { expect } from 'chai';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import { createMessage, isTypeAllowedForBrand } from '../../../src/api/firebaseAdmin';

/**
 * Pact chat push (docs/niche-sub-apps/habits/HABITS_PACT_CHAT_DESIGN.md). It quotes a person and
 * their words, so a field dropped between users-service and here renders an empty name or the raw
 * `{messagePreview}` placeholder with no error anywhere — which is what these pin.
 */

const baseConfig = {
    deviceToken: 'test-device-token',
    userId: 'a2b1c0d9-0000-4000-8000-000000000001',
    userLocale: 'en-us',
    fromUserName: 'Sam',
    habitName: 'Morning run',
    messagePreview: 'Done! 5k before work',
    pactId: 'b7c2d1e0-0000-4000-8000-000000000002',
};

const build = (overrides: Record<string, any> = {}, brand = BrandVariations.HABITS): any => createMessage(
    PushNotifications.Types.pactMessage,
    {},
    { ...baseConfig, ...overrides } as any,
    brand,
);

describe('pact message push', () => {
    it('quotes the sender and their message, and names the pact in the title', () => {
        const message = build();

        expect(message.data.notificationTitle).to.contain('Morning run');
        expect(message.data.notificationBody).to.contain('Sam');
        expect(message.data.notificationBody).to.contain('Done! 5k before work');
    });

    it('falls back to a generic body when there is no preview', () => {
        const message = build({ messagePreview: undefined });

        expect(message.data.notificationBody).to.contain('Sam');
        expect(message.data.notificationBody).to.not.match(/\{\w+\}/);
    });

    it('is data-only, carries the pact id and opens through the pactView press action', () => {
        const message = build();

        expect(message.notification).to.equal(undefined);
        expect(message.data.pactId).to.equal(baseConfig.pactId);
        expect(message.data.notificationPressActionId).to.equal(PushNotifications.PressActionIds.pactView);
        expect(message.data.clickActionId).to.equal('com.therr.mobile.habits.PACT_MESSAGE');
        expect(message.apns.headers['apns-push-type']).to.equal('alert');
    });

    it('is Habits-only', () => {
        expect(isTypeAllowedForBrand(PushNotifications.Types.pactMessage, BrandVariations.HABITS)).to.equal(true);
        expect(isTypeAllowedForBrand(PushNotifications.Types.pactMessage, BrandVariations.THERR)).to.equal(false);
    });

    ['es', 'fr-ca'].forEach((userLocale) => {
        it(`renders every placeholder in ${userLocale}`, () => {
            [build({ userLocale }), build({ userLocale, messagePreview: undefined })].forEach((message) => {
                expect(message.data.notificationTitle).to.contain('Morning run').and.not.match(/\{\w+\}/);
                expect(message.data.notificationBody).to.contain('Sam').and.not.match(/\{\w+\}/);
            });
        });
    });
});
