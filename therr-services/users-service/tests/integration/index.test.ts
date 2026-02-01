/**
 * Integration Tests for Users Service
 *
 * These tests connect to a real PostgreSQL database to verify
 * that the data layer works correctly.
 *
 * Prerequisites:
 * - Start infrastructure: docker compose -f docker-compose.infra.yml up -d
 * - Run migrations: npm run migrations:run
 * - Run tests: npm run test:integration
 */
import { expect } from 'chai';
import UsersStore, { ICreateUserParams } from '../../src/store/UsersStore';
import {
    getTestConnection,
    closeTestConnection,
    checkConnection,
    cleanupTestData,
} from './testDbConnection';

describe('Integration Tests', () => {
    const TEST_EMAIL = 'integration-test-user@example.com';
    let usersStore: UsersStore;
    let skipTests = false;

    before(async () => {
        // Check if database is available
        const isConnected = await checkConnection();
        if (!isConnected) {
            console.log('\n⚠️  Database not available. Skipping integration tests.');
            console.log('   Start the database with: docker compose -f docker-compose.infra.yml up -d');
            console.log('   Run migrations with: npm run migrations:run\n');
            skipTests = true;
            return;
        }

        // Initialize store with real connection
        const connection = getTestConnection();
        usersStore = new UsersStore(connection);
    });

    beforeEach(async () => {
        if (skipTests) return;
        // Clean up any leftover test data
        try {
            await cleanupTestData('users', { email: TEST_EMAIL });
        } catch {
            // Ignore cleanup errors
        }
    });

    after(async () => {
        // Clean up test data
        try {
            await cleanupTestData('users', { email: TEST_EMAIL });
        } catch {
            // Ignore cleanup errors
        }
        // Close database connections
        await closeTestConnection();
    });

    describe('UsersStore - Database Integration', () => {
        it('should create a new user in the database', async () => {
            if (skipTests) return;

            const testUser: ICreateUserParams = {
                email: TEST_EMAIL,
                password: 'hashedPassword123',
                firstName: 'Integration',
                lastName: 'Test',
                userName: 'integrationtestuser',
                hasAgreedToTerms: true,
                accessLevels: JSON.stringify(['user.default']),
                verificationCodes: JSON.stringify({ email: {}, mobile: {} }),
            };

            // Create the user
            const createdUsers = await usersStore.createUser(testUser);

            // Verify the user was created
            expect(createdUsers).to.be.an('array');
            expect(createdUsers.length).to.equal(1);

            const createdUser = createdUsers[0];
            expect(createdUser.id).to.be.a('string');
            expect(createdUser.email).to.equal(TEST_EMAIL);
            expect(createdUser.firstName).to.equal('Integration');
            expect(createdUser.lastName).to.equal('Test');
            expect(createdUser.userName).to.equal('integrationtestuser');
        });

        it('should find a user by email', async () => {
            if (skipTests) return;

            // First create a user
            const testUser: ICreateUserParams = {
                email: TEST_EMAIL,
                password: 'hashedPassword123',
                firstName: 'Find',
                lastName: 'Test',
                userName: 'findtestuser',
                hasAgreedToTerms: true,
                accessLevels: JSON.stringify(['user.default']),
                verificationCodes: JSON.stringify({ email: {}, mobile: {} }),
            };
            await usersStore.createUser(testUser);

            // Now find the user
            const foundUsers = await usersStore.findUser({ email: TEST_EMAIL });

            expect(foundUsers).to.be.an('array');
            expect(foundUsers.length).to.equal(1);
            expect(foundUsers[0].email).to.equal(TEST_EMAIL);
            expect(foundUsers[0].firstName).to.equal('Find');
        });

        it('should update a user', async () => {
            if (skipTests) return;

            // First create a user
            const testUser: ICreateUserParams = {
                email: TEST_EMAIL,
                password: 'hashedPassword123',
                firstName: 'Update',
                lastName: 'Test',
                userName: 'updatetestuser',
                hasAgreedToTerms: true,
                accessLevels: JSON.stringify(['user.default']),
                verificationCodes: JSON.stringify({ email: {}, mobile: {} }),
            };
            const createdUsers = await usersStore.createUser(testUser);
            const userId = createdUsers[0].id;

            // Update the user
            const updatedUsers = await usersStore.updateUser(
                { firstName: 'Updated', lastName: 'User' },
                { id: userId },
            );

            expect(updatedUsers).to.be.an('array');
            expect(updatedUsers.length).to.equal(1);
            expect(updatedUsers[0].firstName).to.equal('Updated');
            expect(updatedUsers[0].lastName).to.equal('User');
        });

        it('should return empty array when user is not found', async () => {
            if (skipTests) return;

            const foundUsers = await usersStore.findUser({
                email: 'nonexistent-user@example.com',
            });

            expect(foundUsers).to.be.an('array');
            expect(foundUsers.length).to.equal(0);
        });
    });
});
