import { expect } from 'chai';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import { isHabitsOnlyType, isTypeAllowedForBrand } from '../../../src/api/firebaseAdmin';

/**
 * A Friends with Habits notification must never be delivered to another brand's app.
 *
 * `brandVariation` is what selects the recipient's device token
 * (`resolveDeviceTokenForBrand`, users-service), and a user holding two branded apps has
 * a separate token per install. So a `streakAtRisk` sent under THERR is addressed to
 * that user's *Therr* install and renders there — "Don't Break Your Streak" under Therr's
 * name and icon, on an app with no habits surface — while the Habits app gets nothing.
 *
 * This used to only log a warning and send anyway, on the reasoning that the copy was
 * still correct and only the deep link would break. That reasoning assumed the push
 * reached the Habits app; it does not. These tests pin the block so the behaviour cannot
 * silently revert to "warn and deliver to the wrong product".
 */
describe('HABITS-only notification routing', () => {
    const NON_HABITS_BRANDS = Object.values(BrandVariations)
        .filter((brand) => brand !== BrandVariations.HABITS) as BrandVariations[];

    it('allows every HABITS-only type under the HABITS brand', () => {
        const blocked = Object.values(PushNotifications.Types)
            .filter((type) => isHabitsOnlyType(type as PushNotifications.Types))
            .filter((type) => !isTypeAllowedForBrand(type as PushNotifications.Types, BrandVariations.HABITS));

        expect(blocked, 'HABITS must still receive its own notifications').to.deep.equal([]);
    });

    it('blocks every HABITS-only type under every other brand', () => {
        const habitsOnly = Object.values(PushNotifications.Types)
            .filter((type) => isHabitsOnlyType(type as PushNotifications.Types)) as PushNotifications.Types[];

        // Guards the guard: if HABITS_ONLY_TYPES were emptied, the loop below would
        // vacuously pass and the routing rule would be unenforced.
        expect(habitsOnly.length, 'expected a non-empty HABITS-only type set').to.be.greaterThan(0);

        const leaked: string[] = [];
        NON_HABITS_BRANDS.forEach((brand) => {
            habitsOnly.forEach((type) => {
                if (isTypeAllowedForBrand(type, brand)) {
                    leaked.push(`${type} → ${brand}`);
                }
            });
        });

        expect(leaked, 'these would render in the wrong app').to.deep.equal([]);
    });

    it('blocks the exact case seen in production: streakAtRisk under THERR', () => {
        expect(isTypeAllowedForBrand(PushNotifications.Types.streakAtRisk, BrandVariations.HABITS)).to.equal(true);
        expect(isTypeAllowedForBrand(PushNotifications.Types.streakAtRisk, BrandVariations.THERR)).to.equal(false);
    });

    it('leaves cross-brand types routable everywhere', () => {
        // Habits ships connections, DMs, groups, thoughts and achievements too, so the
        // block must be narrow — widening it to the whole habits surface would silence
        // notifications that are correct on both apps.
        const crossBrand = [
            PushNotifications.Types.achievementCompleted,
            PushNotifications.Types.newDirectMessage,
            PushNotifications.Types.newConnectionRequest,
            PushNotifications.Types.leaderboardRankMilestone,
        ];

        crossBrand.forEach((type) => {
            expect(isHabitsOnlyType(type), `${type} must not be HABITS-only`).to.equal(false);
            expect(isTypeAllowedForBrand(type, BrandVariations.THERR), `${type} on THERR`).to.equal(true);
            expect(isTypeAllowedForBrand(type, BrandVariations.HABITS), `${type} on HABITS`).to.equal(true);
        });
    });

    it('still applies the Therr-product exclusions to HABITS', () => {
        // The pre-existing rule in the other direction must survive this change.
        expect(isTypeAllowedForBrand(PushNotifications.Types.nudgeSpaceEngagement, BrandVariations.HABITS)).to.equal(false);
        expect(isTypeAllowedForBrand(PushNotifications.Types.nudgeSpaceEngagement, BrandVariations.THERR)).to.equal(true);
    });
});
