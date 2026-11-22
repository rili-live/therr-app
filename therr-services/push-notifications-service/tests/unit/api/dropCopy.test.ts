import { expect } from 'chai';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import { createMessage, isTypeAllowedForBrand } from '../../../src/api/firebaseAdmin';

/**
 * Drop pushes (docs/DROPS.md). The drop's id and place name ride `data.drop` from users-service,
 * so a field lost on the way renders a tap that opens nothing, or the raw `{placeName}`
 * placeholder, with no error anywhere — which is what these pin.
 */

const baseConfig = {
    deviceToken: 'test-device-token',
    userId: 'a2b1c0d9-0000-4000-8000-000000000001',
    userLocale: 'en-us',
    fromUserName: 'Sam',
};

const drop = {
    id: 'c3d2e1f0-0000-4000-8000-000000000003',
    placeName: 'the bench by the fountain',
};

const build = (
    type: PushNotifications.Types,
    dropData: Record<string, any> | undefined = drop,
    overrides: Record<string, any> = {},
): any => createMessage(
    type,
    { drop: dropData as any },
    { ...baseConfig, ...overrides } as any,
    BrandVariations.THERR,
);

describe('drop pushes', () => {
    it('tells the recipient who left it and where', () => {
        const message = build(PushNotifications.Types.dropReceived);

        expect(message.data.notificationTitle).to.contain('Sam');
        expect(message.data.notificationBody).to.contain('the bench by the fountain');
    });

    it('tells the sender who opened it and where', () => {
        const message = build(PushNotifications.Types.dropOpened);

        expect(message.data.notificationBody).to.contain('Sam');
        expect(message.data.notificationBody).to.contain('the bench by the fountain');
    });

    [PushNotifications.Types.dropReceived, PushNotifications.Types.dropOpened].forEach((type) => {
        it(`falls back to copy with no place for "${type}" when the sender named none`, () => {
            const message = build(type, { id: drop.id });

            expect(message.data.notificationBody).to.not.match(/\{\w+\}/);
            expect(message.data.notificationBody).to.not.contain('undefined');
        });

        it(`is data-only for "${type}", carries the drop and opens through the dropView press action`, () => {
            const message = build(type);
            const intentKey = type === PushNotifications.Types.dropReceived ? 'DROP_RECEIVED' : 'DROP_OPENED';

            expect(message.notification).to.equal(undefined);
            expect(JSON.parse(message.data.drop).id).to.equal(drop.id);
            expect(message.data.notificationPressActionId).to.equal(PushNotifications.PressActionIds.dropView);
            expect(message.data.clickActionId).to.equal(`app.therrmobile.${intentKey}`);
        });

        it(`is a Therr-only type ("${type}")`, () => {
            expect(isTypeAllowedForBrand(type, BrandVariations.THERR)).to.equal(true);
            expect(isTypeAllowedForBrand(type, BrandVariations.HABITS)).to.equal(false);
        });

        ['es', 'fr-ca'].forEach((userLocale) => {
            it(`renders every placeholder for "${type}" in ${userLocale}`, () => {
                const withPlace = build(type, drop, { userLocale });
                const withoutPlace = build(type, { id: drop.id }, { userLocale });

                [withPlace, withoutPlace].forEach((message) => {
                    expect(message.data.notificationTitle).to.not.match(/\{\w+\}/);
                    expect(message.data.notificationBody).to.not.match(/\{\w+\}/);
                    expect(message.data.notificationTitle).to.not.contain('notifications.');
                });
            });
        });
    });
});
