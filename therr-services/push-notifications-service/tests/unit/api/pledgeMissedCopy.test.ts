import { expect } from 'chai';
import { BrandVariations, PLEDGE_CHARITIES, PushNotifications } from 'therr-js-utilities/constants';
import { createMessage } from '../../../src/api/firebaseAdmin';

/**
 * The charity pledge reminder (WORK_IN_PROGRESS § 2.8, Phase A). Its copy must name the member's
 * own promise — the amount and the charity they chose — because that promise is the whole
 * message. A payload field dropped anywhere along the queue → sender → push-service allow-lists
 * would render "$0" with no error, which is what these pin.
 */

const baseConfig = {
    deviceToken: 'test-device-token',
    userId: 'a2b1c0d9-0000-4000-8000-000000000001',
    userLocale: 'en-us',
    habitName: 'Morning run',
    pactId: 'b7c2d1e0-0000-4000-8000-000000000002',
    weekStartDate: '2026-09-21',
    pledgeAmount: 5,
    charityKey: 'direct_relief',
};

const build = (overrides: Record<string, any> = {}): any => createMessage(
    PushNotifications.Types.pledgeMissed,
    {},
    { ...baseConfig, ...overrides } as any,
    BrandVariations.HABITS,
);

describe('pledgeMissed copy', () => {
    it('names the habit, the amount and the chosen charity', () => {
        const message = build();

        expect(message).to.not.equal(false);
        expect(message.notification.title).to.contain('Morning run');
        expect(message.notification.body).to.contain('$5');
        expect(message.notification.body).to.contain('Direct Relief');
    });

    it('falls back to a generic recipient when the charity key is unknown', () => {
        const message = build({ charityKey: 'no_such_charity' });

        expect(message.notification.body).to.contain('to charity.');
        expect(message.notification.body).to.not.contain('undefined');
    });

    it('carries the pact and the week as routing ids for the mobile miss card', () => {
        const message = build();

        expect(message.data.pactId).to.equal(baseConfig.pactId);
        expect(message.data.weekStartDate).to.equal('2026-09-21');
    });

    ['es', 'fr-ca'].forEach((userLocale) => {
        it(`renders the amount and charity in ${userLocale}`, () => {
            const message = build({ userLocale, charityKey: 'unicef_usa', pledgeAmount: 20 });

            expect(message.notification.body).to.contain('20');
            expect(message.notification.body).to.contain('UNICEF USA');
            expect(message.notification.body).to.not.match(/\{\w+\}/);
        });
    });

    it('resolves every curated charity to a name', () => {
        PLEDGE_CHARITIES.forEach(({ key, name }) => {
            expect(build({ charityKey: key }).notification.body).to.contain(name);
        });
    });
});
