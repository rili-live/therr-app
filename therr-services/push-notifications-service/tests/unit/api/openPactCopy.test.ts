import { expect } from 'chai';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import { createMessage, isTypeAllowedForBrand } from '../../../src/api/firebaseAdmin';

/**
 * Open pacts: the join request, its approval, and the digest's "your invite went unanswered"
 * suggestion. Each names a person and a habit, and a payload field dropped between the producer
 * and here renders an empty name with no error — which is what these pin.
 */

const baseConfig = {
    deviceToken: 'test-device-token',
    userId: 'a2b1c0d9-0000-4000-8000-000000000001',
    userLocale: 'en-us',
    fromUserName: 'sam_runs',
    habitName: 'Morning run',
    pactId: 'b7c2d1e0-0000-4000-8000-000000000002',
    habitGoalId: 'c8d3e2f1-0000-4000-8000-000000000003',
};

const build = (type: PushNotifications.Types, overrides: Record<string, any> = {}): any => createMessage(
    type,
    {},
    { ...baseConfig, ...overrides } as any,
    BrandVariations.HABITS,
);

const TYPES = [
    PushNotifications.Types.pactJoinRequested,
    PushNotifications.Types.pactJoinApproved,
    PushNotifications.Types.openPactSuggestion,
];

describe('open pact push copy', () => {
    it('names the requester and the habit on a join request', () => {
        const message = build(PushNotifications.Types.pactJoinRequested);

        expect(message.notification.body).to.contain('sam_runs');
        expect(message.notification.body).to.contain('Morning run');
    });

    it('names the creator and the habit on an approval', () => {
        const message = build(PushNotifications.Types.pactJoinApproved);

        expect(message.notification.body).to.contain('sam_runs');
        expect(message.notification.body).to.contain('Morning run');
    });

    it('names the habit on the suggestion', () => {
        const message = build(PushNotifications.Types.openPactSuggestion);

        expect(message.notification.body).to.contain('Morning run');
    });

    TYPES.forEach((type) => {
        it(`${type} carries the pact id for routing`, () => {
            expect(build(type).data.pactId).to.equal(baseConfig.pactId);
        });

        it(`${type} is Habits-only`, () => {
            expect(isTypeAllowedForBrand(type, BrandVariations.HABITS)).to.equal(true);
            expect(isTypeAllowedForBrand(type, BrandVariations.THERR)).to.equal(false);
        });

        ['es', 'fr-ca'].forEach((userLocale) => {
            it(`${type} renders every placeholder in ${userLocale}`, () => {
                const message = build(type, { userLocale });

                expect(message.notification.title).to.be.a('string').and.not.match(/\{\w+\}/);
                expect(message.notification.body).to.contain('Morning run');
                expect(message.notification.body).to.not.match(/\{\w+\}/);
            });
        });
    });
});
