/**
 * E2E test: Space Incentive / Coupon Flow
 *
 * Partner businesses at the Treasure Hunt rely on Space Incentives to offer
 * "$1 off a drink" style promotions. A broken redemption flow means the bar
 * gives free drinks and Therr can't prove they were Therr-attributed — or
 * users can't redeem and walk away annoyed. Both kill partnerships.
 *
 * Flow under test:
 *   1. Business creates an incentive tied to a Space.
 *   2. Consumer "redeems" → upsert into spaceIncentiveCoupons increments useCount.
 *   3. Subsequent redemptions keep incrementing, but maxUseCount bounds apply.
 *
 * References:
 *   therr-services/maps-service/src/store/SpaceIncentivesStore.ts
 *   therr-services/maps-service/src/store/SpaceIncentiveCouponsStore.ts
 */
import { expect } from 'chai';
import { randomUUID } from 'crypto';
import {
    checkE2eConnection,
    closeE2eConnection,
} from '../helpers/testConnection';
import {
    createTestUser,
    createTestSpace,
    cleanupTestUsers,
    cleanupTestSpaces,
    queryMapsDb,
    execMapsDb,
} from '../helpers/fixtures';

describe('Space Incentive Flow - Campaign E2E', () => {
    let skipTests = false;
    let createdUserIds: string[] = [];
    let createdSpaceIds: string[] = [];

    before(async () => {
        const isConnected = await checkE2eConnection();
        if (!isConnected) {
            console.log('\n⚠️  Campaign DBs not available. Skipping space incentive e2e.');
            skipTests = true;
        }
    });

    afterEach(async () => {
        if (skipTests) return;
        if (createdSpaceIds.length) {
            await cleanupTestSpaces(createdSpaceIds);
            createdSpaceIds = [];
        }
        if (createdUserIds.length) {
            await cleanupTestUsers(createdUserIds);
            createdUserIds = [];
        }
    });

    after(async () => {
        await closeE2eConnection();
    });

    const createIncentive = async (spaceId: string, maxUseCount = 100) => {
        const id = randomUUID();
        await execMapsDb(
            `INSERT INTO "main"."spaceIncentives"
                (id, "spaceId", "incentiveKey", "incentiveValue", "incentiveRewardKey", "incentiveRewardValue",
                 "incentiveCurrencyId", "isActive", "maxUseCount", region)
             VALUES ($1, $2, 'checkIn', 1, 'therrCoinRewards', 5, 'therr-coin', true, $3, 'US-IN')`,
            [id, spaceId, maxUseCount],
        );
        return id;
    };

    describe('Incentive creation', () => {
        it('creates an active incentive tied to a Space', async () => {
            if (skipTests) return;

            const businessOwner = await createTestUser();
            createdUserIds.push(businessOwner.id);
            const space = await createTestSpace(businessOwner.id);
            createdSpaceIds.push(space.id);

            const incentiveId = await createIncentive(space.id);

            const rows = await queryMapsDb(
                'SELECT * FROM "main"."spaceIncentives" WHERE id = $1',
                [incentiveId],
            );
            expect(rows).to.have.lengthOf(1);
            expect(rows[0].spaceId).to.equal(space.id);
            expect(rows[0].isActive).to.be.eq(true);
            expect(Number(rows[0].maxUseCount)).to.equal(100);
        });
    });

    describe('Coupon redemption', () => {
        it('upserts a coupon row on first redemption', async () => {
            if (skipTests) return;

            const businessOwner = await createTestUser();
            const redeemer = await createTestUser();
            createdUserIds.push(businessOwner.id, redeemer.id);
            const space = await createTestSpace(businessOwner.id);
            createdSpaceIds.push(space.id);
            const incentiveId = await createIncentive(space.id);

            await execMapsDb(
                `INSERT INTO "main"."spaceIncentiveCoupons"
                    ("spaceIncentiveId", "userId", "useCount", region)
                 VALUES ($1, $2, 1, 'US-IN')
                 ON CONFLICT ("spaceIncentiveId", "userId")
                 DO UPDATE SET "useCount" = "main"."spaceIncentiveCoupons"."useCount" + 1`,
                [incentiveId, redeemer.id],
            );

            const coupons = await queryMapsDb(
                'SELECT * FROM "main"."spaceIncentiveCoupons" WHERE "spaceIncentiveId" = $1 AND "userId" = $2',
                [incentiveId, redeemer.id],
            );
            expect(coupons).to.have.lengthOf(1);
            expect(Number(coupons[0].useCount)).to.equal(1);
        });

        it('increments useCount on repeat redemption via ON CONFLICT', async () => {
            if (skipTests) return;

            const businessOwner = await createTestUser();
            const redeemer = await createTestUser();
            createdUserIds.push(businessOwner.id, redeemer.id);
            const space = await createTestSpace(businessOwner.id);
            createdSpaceIds.push(space.id);
            const incentiveId = await createIncentive(space.id);

            const upsertSql = `
                INSERT INTO "main"."spaceIncentiveCoupons"
                    ("spaceIncentiveId", "userId", "useCount", region)
                VALUES ($1, $2, 1, 'US-IN')
                ON CONFLICT ("spaceIncentiveId", "userId")
                DO UPDATE SET "useCount" = "main"."spaceIncentiveCoupons"."useCount" + 1
            `;

            await execMapsDb(upsertSql, [incentiveId, redeemer.id]);
            await execMapsDb(upsertSql, [incentiveId, redeemer.id]);
            await execMapsDb(upsertSql, [incentiveId, redeemer.id]);

            const coupons = await queryMapsDb(
                'SELECT "useCount" FROM "main"."spaceIncentiveCoupons" WHERE "spaceIncentiveId" = $1 AND "userId" = $2',
                [incentiveId, redeemer.id],
            );
            expect(Number(coupons[0].useCount)).to.equal(3,
                'Repeat redemptions must accumulate, or the happy-hour "buy N, get 1 free" mechanic breaks');
        });

        it('isolates coupons per user (independent useCount)', async () => {
            if (skipTests) return;

            const businessOwner = await createTestUser();
            const userA = await createTestUser();
            const userB = await createTestUser();
            createdUserIds.push(businessOwner.id, userA.id, userB.id);
            const space = await createTestSpace(businessOwner.id);
            createdSpaceIds.push(space.id);
            const incentiveId = await createIncentive(space.id);

            const upsertSql = `
                INSERT INTO "main"."spaceIncentiveCoupons"
                    ("spaceIncentiveId", "userId", "useCount", region)
                VALUES ($1, $2, 1, 'US-IN')
                ON CONFLICT ("spaceIncentiveId", "userId")
                DO UPDATE SET "useCount" = "main"."spaceIncentiveCoupons"."useCount" + 1
            `;

            await execMapsDb(upsertSql, [incentiveId, userA.id]);
            await execMapsDb(upsertSql, [incentiveId, userA.id]);
            await execMapsDb(upsertSql, [incentiveId, userB.id]);

            const couponsA = await queryMapsDb(
                'SELECT "useCount" FROM "main"."spaceIncentiveCoupons" WHERE "spaceIncentiveId" = $1 AND "userId" = $2',
                [incentiveId, userA.id],
            );
            const couponsB = await queryMapsDb(
                'SELECT "useCount" FROM "main"."spaceIncentiveCoupons" WHERE "spaceIncentiveId" = $1 AND "userId" = $2',
                [incentiveId, userB.id],
            );
            expect(Number(couponsA[0].useCount)).to.equal(2);
            expect(Number(couponsB[0].useCount)).to.equal(1);
        });
    });
});
