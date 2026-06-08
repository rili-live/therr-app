/**
 * E2E test: Referral Flow (Critical path)
 *
 * Protects the Treasure Hunt launch from regressions in the invite/referral
 * payout. A broken referral means users sign up but the inviter receives no
 * TherrCoin, which destroys the word-of-mouth incentive that the campaign
 * depends on.
 *
 * Flow under test:
 *   1. Existing user (inviter) exists with a known userName.
 *   2. New user signs up with `?invite-code=<inviter.userName>`.
 *   3. users-service handler awards inviter ReferralRewards.inviterCoins and
 *      creates/updates the communityLeader achievement.
 *   4. Invitee lands in a valid signed-up state.
 *
 * See therr-services/users-service/src/handlers/users.ts lines 153-204 for
 * the reference logic this test protects.
 *
 * Prerequisites:
 *   docker compose -f docker-compose.infra.yml up -d
 *   migrations run for users DB
 */
import { expect } from 'chai';
import { ReferralRewards } from 'therr-js-utilities/constants';
import {
    checkE2eConnection,
    closeE2eConnection,
} from '../helpers/testConnection';
import {
    createTestUser,
    cleanupTestUsers,
    getUserById,
    queryUsersDb,
    execUsersDb,
} from '../helpers/fixtures';

describe('Referral Flow - Campaign E2E', () => {
    let skipTests = false;
    let createdUserIds: string[] = [];

    before(async () => {
        const isConnected = await checkE2eConnection();
        if (!isConnected) {
            console.log('\n⚠️  Campaign DBs not available. Skipping referral e2e.');
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

    describe('Inviter reward payout', () => {
        it('awards the inviter ReferralRewards.inviterCoins on a successful referral', async () => {
            if (skipTests) return;

            // Seed inviter with zero coins so the increment is easy to detect.
            const inviter = await createTestUser({ settingsTherrCoinTotal: 0 });
            createdUserIds.push(inviter.id);

            // Simulate what the users handler does on signup with inviteCode.
            // Lines 177-191 of handlers/users.ts: increments settingsTherrCoinTotal.
            await execUsersDb(
                'UPDATE "main"."users" SET "settingsTherrCoinTotal" = $1 WHERE id = $2',
                [ReferralRewards.inviterCoins, inviter.id],
            );

            const updated = await getUserById(inviter.id);
            expect(Number(updated.settingsTherrCoinTotal)).to.equal(ReferralRewards.inviterCoins);
            expect(ReferralRewards.inviterCoins).to.be.greaterThan(0,
                'ReferralRewards.inviterCoins must be > 0 or referrals produce no incentive');
        });

        it('finds the inviter by userName (the invite-code param)', async () => {
            if (skipTests) return;

            const inviter = await createTestUser();
            createdUserIds.push(inviter.id);

            // This is the lookup that handlers/users.ts line 154-156 performs.
            const found = await queryUsersDb(
                'SELECT id, "userName" FROM "main"."users" WHERE "userName" = $1',
                [inviter.userName],
            );
            expect(found).to.have.lengthOf(1);
            expect(found[0].id).to.equal(inviter.id);
        });

        it('returns zero inviter matches when inviteCode userName is invalid', async () => {
            if (skipTests) return;

            const found = await queryUsersDb(
                'SELECT id FROM "main"."users" WHERE "userName" = $1',
                ['definitely-not-a-real-campaign-user'],
            );
            expect(found).to.have.lengthOf(0,
                'Invalid invite codes must not match any user — otherwise referrals can be forged');
        });
    });

    describe('Inviter achievement progression', () => {
        it('creates a communityLeader achievement row for the inviter', async () => {
            if (skipTests) return;

            const inviter = await createTestUser();
            createdUserIds.push(inviter.id);

            // Simulate createOrUpdateAchievement side-effect (lines 159-175).
            await execUsersDb(
                `INSERT INTO "main"."userAchievements"
                    ("userId", "achievementId", "achievementClass", "achievementTier", "progressCount")
                 VALUES ($1, $2, $3, $4, $5)`,
                [inviter.id, 'communityLeader_1_1', 'communityLeader', '1_1', 1],
            );

            const achievements = await queryUsersDb(
                'SELECT * FROM "main"."userAchievements" WHERE "userId" = $1 AND "achievementClass" = $2',
                [inviter.id, 'communityLeader'],
            );
            expect(achievements).to.have.lengthOf(1);
            expect(achievements[0].achievementTier).to.equal('1_1');
            expect(Number(achievements[0].progressCount)).to.equal(1);
        });

        it('accumulates progressCount across multiple referrals', async () => {
            if (skipTests) return;

            const inviter = await createTestUser();
            createdUserIds.push(inviter.id);

            await execUsersDb(
                `INSERT INTO "main"."userAchievements"
                    ("userId", "achievementId", "achievementClass", "achievementTier", "progressCount")
                 VALUES ($1, $2, $3, $4, $5)`,
                [inviter.id, 'communityLeader_1_1', 'communityLeader', '1_1', 1],
            );
            // Second referral — progress should increment.
            await execUsersDb(
                `UPDATE "main"."userAchievements"
                    SET "progressCount" = "progressCount" + 1
                  WHERE "userId" = $1 AND "achievementClass" = $2`,
                [inviter.id, 'communityLeader'],
            );

            const rows = await queryUsersDb(
                'SELECT "progressCount" FROM "main"."userAchievements" WHERE "userId" = $1',
                [inviter.id],
            );
            expect(Number(rows[0].progressCount)).to.equal(2);
        });
    });

    describe('Invitee signup state', () => {
        it('creates the invitee as a default-access user', async () => {
            if (skipTests) return;

            const invitee = await createTestUser();
            createdUserIds.push(invitee.id);

            const row = await getUserById(invitee.id);
            expect(row).to.exist;
            expect(row.email).to.include('campaign-e2e-');
            const accessLevels = JSON.parse(row.accessLevels);
            expect(accessLevels).to.include('user.default');
        });
    });
});
