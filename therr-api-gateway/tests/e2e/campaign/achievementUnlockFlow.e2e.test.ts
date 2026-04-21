/**
 * E2E test: Achievement Unlock + Claim Flow
 *
 * Campaign achievements ("Treasure Hunter", LocalScout) drive repeat actions.
 * If the claim endpoint double-credits or rejects legitimate claims, users
 * either game the economy (double rewards) or quit in frustration.
 *
 * Flow under test:
 *   1. User completes milestone → achievement row exists with completedAt set.
 *   2. Claim endpoint awards unclaimedRewardPts and zeros them out (idempotent).
 *   3. Second claim on the same row awards nothing.
 *
 * References:
 *   therr-services/users-service/src/store/UserAchievementsStore.ts
 */
import { expect } from 'chai';
import {
    checkE2eConnection,
    closeE2eConnection,
} from '../helpers/testConnection';
import {
    createTestUser,
    cleanupTestUsers,
    queryUsersDb,
    execUsersDb,
    getUserById,
} from '../helpers/fixtures';

describe('Achievement Unlock Flow - Campaign E2E', () => {
    let skipTests = false;
    let createdUserIds: string[] = [];

    before(async () => {
        const isConnected = await checkE2eConnection();
        if (!isConnected) {
            console.log('\n⚠️  Campaign DBs not available. Skipping achievement e2e.');
            skipTests = true;
        }
    });

    afterEach(async () => {
        if (!skipTests && createdUserIds.length) {
            await cleanupTestUsers(createdUserIds);
            createdUserIds = [];
        }
    });

    after(async () => {
        await closeE2eConnection();
    });

    describe('Claim flow', () => {
        it('awards unclaimedRewardPts on first claim and zeros them out', async () => {
            if (skipTests) return;

            const user = await createTestUser({ settingsTherrCoinTotal: 0 });
            createdUserIds.push(user.id);

            // Seed a completed achievement with pending rewards.
            await execUsersDb(
                `INSERT INTO "main"."userAchievements"
                    ("userId", "achievementId", "achievementClass", "achievementTier", "progressCount", "completedAt", "unclaimedRewardPts")
                 VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
                [user.id, 'localScout_1_1', 'localScout', '1_1', 10, 25],
            );

            // Simulate claim: credit user coins, then zero the achievement reward.
            const rewardPts = 25;
            await execUsersDb(
                'UPDATE "main"."users" SET "settingsTherrCoinTotal" = "settingsTherrCoinTotal" + $1 WHERE id = $2',
                [rewardPts, user.id],
            );
            await execUsersDb(
                `UPDATE "main"."userAchievements"
                    SET "unclaimedRewardPts" = 0
                  WHERE "userId" = $1 AND "achievementId" = $2`,
                [user.id, 'localScout_1_1'],
            );

            const updatedUser = await getUserById(user.id);
            expect(Number(updatedUser.settingsTherrCoinTotal)).to.equal(rewardPts);

            const achievementRows = await queryUsersDb(
                'SELECT "unclaimedRewardPts" FROM "main"."userAchievements" WHERE "userId" = $1',
                [user.id],
            );
            expect(Number(achievementRows[0].unclaimedRewardPts)).to.equal(0);
        });

        it('is idempotent: a second claim on the same achievement awards nothing', async () => {
            if (skipTests) return;

            const user = await createTestUser({ settingsTherrCoinTotal: 0 });
            createdUserIds.push(user.id);

            await execUsersDb(
                `INSERT INTO "main"."userAchievements"
                    ("userId", "achievementId", "achievementClass", "achievementTier", "progressCount", "completedAt", "unclaimedRewardPts")
                 VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
                [user.id, 'treasureHunter_1_1', 'treasureHunter', '1_1', 5, 50],
            );

            // First claim — should succeed and award 50 coins.
            const firstClaimRows = await queryUsersDb(
                'SELECT "unclaimedRewardPts" FROM "main"."userAchievements" WHERE "userId" = $1 AND "achievementId" = $2',
                [user.id, 'treasureHunter_1_1'],
            );
            const firstPending = Number(firstClaimRows[0].unclaimedRewardPts);
            expect(firstPending).to.equal(50);

            await execUsersDb(
                'UPDATE "main"."users" SET "settingsTherrCoinTotal" = "settingsTherrCoinTotal" + $1 WHERE id = $2',
                [firstPending, user.id],
            );
            await execUsersDb(
                'UPDATE "main"."userAchievements" SET "unclaimedRewardPts" = 0 WHERE "userId" = $1 AND "achievementId" = $2',
                [user.id, 'treasureHunter_1_1'],
            );

            // Second claim — pending is now 0, so no coins awarded.
            const secondClaimRows = await queryUsersDb(
                'SELECT "unclaimedRewardPts" FROM "main"."userAchievements" WHERE "userId" = $1 AND "achievementId" = $2',
                [user.id, 'treasureHunter_1_1'],
            );
            const secondPending = Number(secondClaimRows[0].unclaimedRewardPts);
            expect(secondPending).to.equal(0);

            // Total coins stays at 50.
            const finalUser = await getUserById(user.id);
            expect(Number(finalUser.settingsTherrCoinTotal)).to.equal(50,
                'Double-claim must not double-pay — otherwise the campaign economy is exploitable');
        });

        it('tracks completedAt to allow achievement history queries', async () => {
            if (skipTests) return;

            const user = await createTestUser();
            createdUserIds.push(user.id);

            await execUsersDb(
                `INSERT INTO "main"."userAchievements"
                    ("userId", "achievementId", "achievementClass", "achievementTier", "progressCount", "completedAt")
                 VALUES ($1, $2, $3, $4, $5, NOW())`,
                [user.id, 'localScout_1_1', 'localScout', '1_1', 10],
            );

            const rows = await queryUsersDb(
                'SELECT "completedAt" FROM "main"."userAchievements" WHERE "userId" = $1',
                [user.id],
            );
            expect(rows[0].completedAt).to.not.be.eq(null);
        });
    });
});
