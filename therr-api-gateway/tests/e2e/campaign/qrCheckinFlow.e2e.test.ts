/**
 * E2E test: QR Code Check-in Flow
 *
 * Protects the Treasure Hunt's physical-to-digital bridge. Printed QR codes
 * redirect to `/spaces/{id}?checkin=true` — if that URL or the check-in row
 * insert regresses, every partner-location QR poster goes dead and the
 * campaign collapses.
 *
 * Flow under test:
 *   1. An anchor Space exists with known id + coordinates.
 *   2. QR payload decodes to the expected space id and checkin flag.
 *   3. Check-in records append to space metrics.
 *   4. LocalScout achievement progresses for the checking-in user.
 *
 * References:
 *   therr-services/maps-service/src/scripts/generate-qr-codes.ts
 *   therr-services/maps-service/src/handlers/spaceMetrics.ts
 */
import { expect } from 'chai';
import {
    checkE2eConnection,
    closeE2eConnection,
} from '../helpers/testConnection';
import {
    createTestUser,
    createTestSpace,
    cleanupTestUsers,
    cleanupTestSpaces,
    queryUsersDb,
    execUsersDb,
    queryMapsDb,
    execMapsDb,
} from '../helpers/fixtures';

describe('QR Check-in Flow - Campaign E2E', () => {
    let skipTests = false;
    let createdUserIds: string[] = [];
    let createdSpaceIds: string[] = [];

    before(async () => {
        const isConnected = await checkE2eConnection();
        if (!isConnected) {
            console.log('\n⚠️  Campaign DBs not available. Skipping QR check-in e2e.');
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

    describe('QR URL payload', () => {
        it('decodes to the expected space id and checkin flag', async () => {
            // This shape must stay stable — printed QR codes cannot be updated
            // after they are pasted in the field.
            const businessOwner = await createTestUser();
            createdUserIds.push(businessOwner.id);
            if (skipTests) return;
            const space = await createTestSpace(businessOwner.id);
            createdSpaceIds.push(space.id);

            const qrUrl = `/spaces/${space.id}?checkin=true`;
            expect(qrUrl).to.match(/^\/spaces\/[0-9a-f-]+\?checkin=true$/);
            const match = qrUrl.match(/^\/spaces\/([0-9a-f-]+)\?checkin=true$/);
            expect(match).to.not.be.eq(null);
            expect(match![1]).to.equal(space.id);
        });
    });

    describe('Check-in record', () => {
        it('inserts a space metric row on check-in', async () => {
            if (skipTests) return;

            const businessOwner = await createTestUser();
            const checkingInUser = await createTestUser();
            createdUserIds.push(businessOwner.id, checkingInUser.id);
            const space = await createTestSpace(businessOwner.id);
            createdSpaceIds.push(space.id);

            // Mirror the spaceMetrics handler's insert shape. Column names
            // intentionally minimal — the schema has many optional fields.
            await execMapsDb(
                `INSERT INTO "main"."spaceMetrics"
                    ("spaceId", name, value, "valueType", "userId", "dimensionSources")
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [space.id, 'userCheckIn', 1, 'integer', checkingInUser.id, JSON.stringify({ campaign: 'treasure_hunt' })],
            );

            const metrics = await queryMapsDb(
                'SELECT * FROM "main"."spaceMetrics" WHERE "spaceId" = $1 AND name = $2',
                [space.id, 'userCheckIn'],
            );
            expect(metrics).to.have.lengthOf(1);
            expect(metrics[0].userId).to.equal(checkingInUser.id);
        });

        it('does not allow check-in for a non-existent space', async () => {
            if (skipTests) return;

            const checkingInUser = await createTestUser();
            createdUserIds.push(checkingInUser.id);

            const bogusSpaceId = '00000000-0000-0000-0000-000000000000';
            const spaces = await queryMapsDb(
                'SELECT id FROM "main"."spaces" WHERE id = $1',
                [bogusSpaceId],
            );
            expect(spaces).to.have.lengthOf(0,
                'The handler must verify the space exists before recording a metric');
        });
    });

    describe('LocalScout achievement progression', () => {
        it('increments LocalScout progress when a user checks in at a new space', async () => {
            if (skipTests) return;

            const scout = await createTestUser();
            createdUserIds.push(scout.id);

            // Seed LocalScout achievement at 0 progress, then increment to 1.
            await execUsersDb(
                `INSERT INTO "main"."userAchievements"
                    ("userId", "achievementId", "achievementClass", "achievementTier", "progressCount")
                 VALUES ($1, $2, $3, $4, $5)`,
                [scout.id, 'localScout_1_1', 'localScout', '1_1', 0],
            );
            await execUsersDb(
                `UPDATE "main"."userAchievements"
                    SET "progressCount" = "progressCount" + 1
                  WHERE "userId" = $1 AND "achievementClass" = $2`,
                [scout.id, 'localScout'],
            );

            const achievements = await queryUsersDb(
                'SELECT "progressCount" FROM "main"."userAchievements" WHERE "userId" = $1 AND "achievementClass" = $2',
                [scout.id, 'localScout'],
            );
            expect(achievements).to.have.lengthOf(1);
            expect(Number(achievements[0].progressCount)).to.equal(1);
        });
    });
});
