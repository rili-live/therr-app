/**
 * E2E test: Onboarding + Invite-Ready State
 *
 * A new campaign user must land in a state where the InviteFriends onboarding
 * stage can generate a shareable URL. If the user is created without a
 * userName, the `/invite/{userName}` shareUrls helper emits an invalid URL
 * and the viral loop stops at user 1.
 *
 * Flow under test:
 *   1. New user created has a non-empty userName.
 *   2. Default access level is set so InviteFriends stage renders.
 *   3. shareUrls path produces the expected form.
 *
 * References:
 *   TherrMobile/main/utilities/shareUrls.ts
 *   TherrMobile/main/components/0_First_Time_UI/onboarding-stages/InviteFriends.tsx
 */
import { expect } from 'chai';
import {
    checkE2eConnection,
    closeE2eConnection,
} from '../helpers/testConnection';
import {
    createTestUser,
    cleanupTestUsers,
    getUserById,
} from '../helpers/fixtures';

const buildInviteUrl = (userName: string) => `/invite/${userName}`;

describe('Onboarding Flow - Campaign E2E', () => {
    let skipTests = false;
    let createdUserIds: string[] = [];

    before(async () => {
        const isConnected = await checkE2eConnection();
        if (!isConnected) {
            console.log('\n⚠️  Campaign DBs not available. Skipping onboarding e2e.');
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

    describe('New user invite-ready state', () => {
        it('creates a user with a non-empty userName', async () => {
            if (skipTests) return;

            const user = await createTestUser();
            createdUserIds.push(user.id);

            const row = await getUserById(user.id);
            expect(row.userName).to.be.a('string');
            expect(row.userName.length).to.be.greaterThan(0,
                'userName is required or shareUrls.ts cannot build a /invite URL');
        });

        it('sets default access level so InviteFriends stage is reachable', async () => {
            if (skipTests) return;

            const user = await createTestUser();
            createdUserIds.push(user.id);

            const row = await getUserById(user.id);
            const accessLevels = JSON.parse(row.accessLevels);
            expect(accessLevels).to.include('user.default');
        });

        it('produces a valid invite URL from the created userName', async () => {
            if (skipTests) return;

            const user = await createTestUser();
            createdUserIds.push(user.id);

            const url = buildInviteUrl(user.userName);
            expect(url).to.match(/^\/invite\/[a-z0-9_]+$/i);
            expect(url).to.include(user.userName);
        });
    });

    describe('Duplicate userName rejection', () => {
        it('rejects duplicate userName inserts (unique constraint)', async () => {
            if (skipTests) return;

            const user = await createTestUser();
            createdUserIds.push(user.id);

            let insertError: Error | null = null;
            try {
                await createTestUser({ userName: user.userName, email: `dup${user.userName}@dup.com` });
            } catch (err) {
                insertError = err as Error;
            }
            expect(insertError).to.not.be.eq(null,
                'userName must be unique — duplicate signups would collide on /invite URLs');
        });
    });
});
