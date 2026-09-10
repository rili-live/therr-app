/**
 * Integration Tests for Users Service - Invites (magic invite links)
 *
 * Exercises the invite-token upsert against a real database. The bugs these
 * cover are all invisible to unit tests because they are Postgres constraint
 * behaviors (ON CONFLICT semantics, empty-statement rejection).
 *
 * Prerequisites:
 * - Start infrastructure: docker compose -f docker-compose.infra.yml up -d
 * - Run migrations: npm run migrations:run
 * - Run tests: npm run test:integration
 */
import { randomUUID } from 'crypto';
import { expect } from 'chai';
import bcrypt from 'bcrypt';
import { AccessLevels } from 'therr-js-utilities/constants';
import UsersStore, { ICreateUserParams } from '../../src/store/UsersStore';
import InvitesStore from '../../src/store/InvitesStore';
import {
    getTestConnection,
    closeTestConnection,
    checkConnection,
    cleanupTestData,
} from './testDbConnection';

describe('Integration Tests - Invites', () => {
    const TEST_EMAIL_PREFIX = 'invite-test-';
    const TEST_EMAIL_DOMAIN = '@example-test.com';
    let usersStore: UsersStore;
    let invitesStore: InvitesStore;
    let skipTests = false;
    let createdUserIds: string[] = [];
    let createdInviteEmails: string[] = [];

    before(async () => {
        const isConnected = await checkConnection();
        if (!isConnected) {
            console.log('\n⚠️  Database not available. Skipping integration tests.');
            console.log('   Start the database with: docker compose -f docker-compose.infra.yml up -d');
            console.log('   Run migrations with: npm run migrations:run\n');
            skipTests = true;
            return;
        }

        const connection = getTestConnection();
        usersStore = new UsersStore(connection);
        invitesStore = new InvitesStore(connection);
    });

    afterEach(async () => {
        if (skipTests) return;

        // Invites reference users, so clear them first
        await Promise.all(createdInviteEmails.map(async (email) => {
            try {
                await cleanupTestData('invites', { email });
            } catch {
                // Ignore cleanup errors
            }
        }));
        createdInviteEmails = [];

        await Promise.all(createdUserIds.map(async (userId) => {
            try {
                await cleanupTestData('users', { id: userId });
            } catch {
                // Ignore cleanup errors
            }
        }));
        createdUserIds = [];
    });

    after(async () => {
        await closeTestConnection();
    });

    const createTestUser = async (suffix: string): Promise<any> => {
        const testEmail = `${TEST_EMAIL_PREFIX}${suffix}${TEST_EMAIL_DOMAIN}`;
        const hashedPassword = await bcrypt.hash('TestPassword123!', 10);

        const testUser: ICreateUserParams = {
            email: testEmail,
            password: hashedPassword,
            firstName: `First${suffix}`,
            lastName: `Last${suffix}`,
            userName: `inviteuser${suffix}`,
            hasAgreedToTerms: true,
            accessLevels: JSON.stringify([AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED]),
            verificationCodes: JSON.stringify({ email: {} }),
        };

        const createdUsers = await usersStore.createUser(testUser);
        createdUserIds.push(createdUsers[0].id);
        return createdUsers[0];
    };

    describe('createIfNotExist', () => {
        // Regression: the bulk-invite handler passes only the *existing user* subset
        // here, which is empty whenever every invited contact is new to the platform
        // — the common case for an invite flow. knex emits an empty string for
        // `.insert([])` and pg rejects an empty query, which short-circuited the
        // handler's promise chain (no socialite achievement, and the in-flight
        // email/SMS promises were left without a rejection handler).
        it('resolves with an empty array instead of rejecting when given no invites', async () => {
            if (skipTests) return;

            const result = await invitesStore.createIfNotExist([]);

            expect(result).to.deep.equal([]);
        });
    });

    describe('upsertInvitesWithTokens', () => {
        it('persists a new invite and returns its token', async () => {
            if (skipTests) return;

            const inviter = await createTestUser('a');
            const inviteeEmail = `${TEST_EMAIL_PREFIX}invitee-a${TEST_EMAIL_DOMAIN}`;
            createdInviteEmails.push(inviteeEmail);
            const token = randomUUID();

            const persisted = await invitesStore.upsertInvitesWithTokens('email', [{
                requestingUserId: inviter.id,
                email: inviteeEmail,
                isAccepted: false,
                token,
            }]);

            expect(persisted.length).to.equal(1);
            expect(persisted[0].email).to.equal(inviteeEmail);
            expect(persisted[0].token).to.equal(token);
        });

        // Regression: email is globally unique on main.invites, so a contact already
        // invited by someone else owns the row. Merging only `token` refreshed the
        // link but left `requestingUserId` pointing at the *original* inviter — the
        // invitee would then be auto-connected to, and the coins credited to, the
        // wrong user. The refreshed token invalidates the older link, so the latest
        // inviter is the only one who can convert this invite and must own the row.
        it('transfers the invite to the latest inviter when the same contact is re-invited', async () => {
            if (skipTests) return;

            const inviterA = await createTestUser('b1');
            const inviterB = await createTestUser('b2');
            const inviteeEmail = `${TEST_EMAIL_PREFIX}invitee-b${TEST_EMAIL_DOMAIN}`;
            createdInviteEmails.push(inviteeEmail);

            await invitesStore.upsertInvitesWithTokens('email', [{
                requestingUserId: inviterA.id,
                email: inviteeEmail,
                isAccepted: false,
                token: randomUUID(),
            }]);

            const tokenB = randomUUID();
            await invitesStore.upsertInvitesWithTokens('email', [{
                requestingUserId: inviterB.id,
                email: inviteeEmail,
                isAccepted: false,
                token: tokenB,
            }]);

            // The link B actually sent must resolve to B as the inviter.
            const resolved = await invitesStore.getInviteByToken(tokenB);

            expect(resolved).to.not.equal(undefined);
            expect(resolved?.requestingUserId).to.equal(inviterB.id);
            expect(resolved?.email).to.equal(inviteeEmail);
        });

        // Regression: Postgres rejects an ON CONFLICT DO UPDATE that would touch the
        // same row twice ("cannot affect row a second time"). Address books routinely
        // carry the same email on multiple contact cards, so the handler de-duplicates
        // by channel before calling this. This test pins the constraint that makes the
        // de-duplication mandatory — a duplicated batch must not be passed in.
        it('rejects a batch containing the same contact twice (callers must dedupe)', async () => {
            if (skipTests) return;

            const inviter = await createTestUser('c');
            const inviteeEmail = `${TEST_EMAIL_PREFIX}invitee-c${TEST_EMAIL_DOMAIN}`;
            createdInviteEmails.push(inviteeEmail);

            let caughtError: any;
            try {
                await invitesStore.upsertInvitesWithTokens('email', [
                    {
                        requestingUserId: inviter.id, email: inviteeEmail, isAccepted: false, token: randomUUID(),
                    },
                    {
                        requestingUserId: inviter.id, email: inviteeEmail, isAccepted: false, token: randomUUID(),
                    },
                ]);
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError).to.not.equal(undefined);
            expect(caughtError.message).to.contain('cannot affect row a second time');
        });
    });

    describe('getInviteByToken', () => {
        it('resolves undefined for an unknown token', async () => {
            if (skipTests) return;

            const result = await invitesStore.getInviteByToken(randomUUID());

            expect(result).to.equal(undefined);
        });

        it('includes the inviter display fields for the landing page', async () => {
            if (skipTests) return;

            const inviter = await createTestUser('d');
            const inviteeEmail = `${TEST_EMAIL_PREFIX}invitee-d${TEST_EMAIL_DOMAIN}`;
            createdInviteEmails.push(inviteeEmail);
            const token = randomUUID();

            await invitesStore.upsertInvitesWithTokens('email', [{
                requestingUserId: inviter.id,
                email: inviteeEmail,
                isAccepted: false,
                token,
            }]);

            const resolved = await invitesStore.getInviteByToken(token);

            expect(resolved?.inviterFirstName).to.equal(inviter.firstName);
            expect(resolved?.inviterUserName).to.equal(inviter.userName);
            expect(resolved?.isAccepted).to.equal(false);
        });
    });
});
