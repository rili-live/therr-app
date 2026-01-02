/**
 * Integration Tests for Users Service - User Flows
 *
 * These tests verify complete user workflows against a real database.
 *
 * Prerequisites:
 * - Start infrastructure: docker compose -f docker-compose.infra.yml up -d
 * - Run migrations: npm run migrations:run
 * - Run tests: npm run test:integration
 */
import { expect } from 'chai';
import bcrypt from 'bcrypt';
import { AccessLevels } from 'therr-js-utilities/constants';
import UsersStore, { ICreateUserParams } from '../../src/store/UsersStore';
import VerificationCodesStore from '../../src/store/VerificationCodesStore';
import {
    getTestConnection,
    closeTestConnection,
    checkConnection,
    cleanupTestData,
} from './testDbConnection';

describe('Integration Tests - User Flows', () => {
    const TEST_EMAIL_PREFIX = 'integration-test-';
    const TEST_EMAIL_DOMAIN = '@example-test.com';
    let usersStore: UsersStore;
    let verificationCodesStore: VerificationCodesStore;
    let skipTests = false;
    let createdUserIds: string[] = [];

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
        verificationCodesStore = new VerificationCodesStore(connection);
    });

    afterEach(async () => {
        if (skipTests) return;
        // Clean up created users after each test
        await Promise.all(createdUserIds.map(
            async (userId) => {
                try {
                    await cleanupTestData('users', { id: userId });
                } catch {
                    // Ignore cleanup errors
                }
            },
        ));
        createdUserIds = [];
    });

    after(async () => {
        await closeTestConnection();
    });

    describe('User Registration Flow', () => {
        it('should create a new user with all required fields', async () => {
            if (skipTests) return;

            const testEmail = `${TEST_EMAIL_PREFIX}create-user${TEST_EMAIL_DOMAIN}`;
            const hashedPassword = await bcrypt.hash('TestPassword123!', 10);

            const testUser: ICreateUserParams = {
                email: testEmail,
                password: hashedPassword,
                firstName: 'Integration',
                lastName: 'TestUser',
                userName: 'integrationuser1',
                hasAgreedToTerms: true,
                accessLevels: JSON.stringify([AccessLevels.DEFAULT]),
                verificationCodes: JSON.stringify({ email: { code: '123456' } }),
            };

            const createdUsers = await usersStore.createUser(testUser);
            createdUserIds.push(createdUsers[0].id);

            expect(createdUsers).to.be.an('array');
            expect(createdUsers.length).to.equal(1);
            expect(createdUsers[0].id).to.be.a('string');
            expect(createdUsers[0].email).to.equal(testEmail);
            expect(createdUsers[0].firstName).to.equal('Integration');
            expect(createdUsers[0].lastName).to.equal('TestUser');
            expect(createdUsers[0].userName).to.equal('integrationuser1');
        });

        it('should normalize email on user creation (lowercase)', async () => {
            if (skipTests) return;

            const testEmail = `${TEST_EMAIL_PREFIX}UPPERCASE${TEST_EMAIL_DOMAIN}`;
            const hashedPassword = await bcrypt.hash('TestPassword123!', 10);

            const testUser: ICreateUserParams = {
                email: testEmail,
                password: hashedPassword,
                firstName: 'Email',
                lastName: 'Normalize',
                userName: 'emailnormalize',
                hasAgreedToTerms: true,
                accessLevels: JSON.stringify([AccessLevels.DEFAULT]),
                verificationCodes: JSON.stringify({ email: {} }),
            };

            const createdUsers = await usersStore.createUser(testUser);
            createdUserIds.push(createdUsers[0].id);

            // UsersStore normalizes email to lowercase on creation
            expect(createdUsers[0].email).to.equal(testEmail.toLowerCase());
        });

        it('should find user by email after registration', async () => {
            if (skipTests) return;

            const testEmail = `${TEST_EMAIL_PREFIX}findbyemail${TEST_EMAIL_DOMAIN}`;
            const hashedPassword = await bcrypt.hash('TestPassword123!', 10);

            // Create user
            const testUser: ICreateUserParams = {
                email: testEmail,
                password: hashedPassword,
                firstName: 'Find',
                lastName: 'ByEmail',
                userName: 'findbyemailuser',
                hasAgreedToTerms: true,
                accessLevels: JSON.stringify([AccessLevels.DEFAULT]),
                verificationCodes: JSON.stringify({ email: {} }),
            };

            const createdUsers = await usersStore.createUser(testUser);
            createdUserIds.push(createdUsers[0].id);

            // Find user
            const foundUsers = await usersStore.findUser({ email: testEmail });

            expect(foundUsers.length).to.equal(1);
            expect(foundUsers[0].email).to.equal(testEmail);
            expect(foundUsers[0].firstName).to.equal('Find');
        });

        it('should find user by userName after registration', async () => {
            if (skipTests) return;

            const testEmail = `${TEST_EMAIL_PREFIX}findbyusername${TEST_EMAIL_DOMAIN}`;
            const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
            const testUserName = 'uniqueusername123';

            // Create user
            const testUser: ICreateUserParams = {
                email: testEmail,
                password: hashedPassword,
                firstName: 'Find',
                lastName: 'ByUserName',
                userName: testUserName,
                hasAgreedToTerms: true,
                accessLevels: JSON.stringify([AccessLevels.DEFAULT]),
                verificationCodes: JSON.stringify({ email: {} }),
            };

            const createdUsers = await usersStore.createUser(testUser);
            createdUserIds.push(createdUsers[0].id);

            // Find user by userName
            const foundUsers = await usersStore.findUser({ userName: testUserName });

            expect(foundUsers.length).to.equal(1);
            expect(foundUsers[0].userName).to.equal(testUserName);
        });

        it('should find user by phoneNumber after registration', async () => {
            if (skipTests) return;

            const testEmail = `${TEST_EMAIL_PREFIX}findbyphone${TEST_EMAIL_DOMAIN}`;
            const testPhone = '+13175559999';
            const hashedPassword = await bcrypt.hash('TestPassword123!', 10);

            // Create user with phone
            const testUser: ICreateUserParams = {
                email: testEmail,
                password: hashedPassword,
                firstName: 'Find',
                lastName: 'ByPhone',
                userName: 'findbyphone',
                phoneNumber: testPhone,
                hasAgreedToTerms: true,
                accessLevels: JSON.stringify([AccessLevels.DEFAULT]),
                verificationCodes: JSON.stringify({ email: {} }),
            };

            const createdUsers = await usersStore.createUser(testUser);
            createdUserIds.push(createdUsers[0].id);

            // Find user by phone
            const foundUsers = await usersStore.findUser({ phoneNumber: testPhone });

            expect(foundUsers.length).to.equal(1);
            expect(foundUsers[0].phoneNumber).to.equal(testPhone);
        });
    });

    describe('User Update Flow', () => {
        it('should update user profile fields', async () => {
            if (skipTests) return;

            const testEmail = `${TEST_EMAIL_PREFIX}update-profile${TEST_EMAIL_DOMAIN}`;
            const hashedPassword = await bcrypt.hash('TestPassword123!', 10);

            // Create user
            const testUser: ICreateUserParams = {
                email: testEmail,
                password: hashedPassword,
                firstName: 'Original',
                lastName: 'Name',
                userName: 'updateprofile',
                hasAgreedToTerms: true,
                accessLevels: JSON.stringify([AccessLevels.DEFAULT]),
                verificationCodes: JSON.stringify({ email: {} }),
            };

            const createdUsers = await usersStore.createUser(testUser);
            createdUserIds.push(createdUsers[0].id);

            // Update user
            const updatedUsers = await usersStore.updateUser(
                { firstName: 'Updated', lastName: 'UserName' },
                { id: createdUsers[0].id },
            );

            expect(updatedUsers.length).to.equal(1);
            expect(updatedUsers[0].firstName).to.equal('Updated');
            expect(updatedUsers[0].lastName).to.equal('UserName');
        });

        it('should update user access levels (email verification)', async () => {
            if (skipTests) return;

            const testEmail = `${TEST_EMAIL_PREFIX}verify-email${TEST_EMAIL_DOMAIN}`;
            const hashedPassword = await bcrypt.hash('TestPassword123!', 10);

            // Create user with default access
            const testUser: ICreateUserParams = {
                email: testEmail,
                password: hashedPassword,
                firstName: 'Verify',
                lastName: 'Email',
                userName: 'verifyemail',
                hasAgreedToTerms: true,
                accessLevels: JSON.stringify([AccessLevels.DEFAULT]),
                verificationCodes: JSON.stringify({ email: { code: '123456' } }),
            };

            const createdUsers = await usersStore.createUser(testUser);
            createdUserIds.push(createdUsers[0].id);

            // Simulate email verification by adding EMAIL_VERIFIED access level
            const newAccessLevels = [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED];
            const updatedUsers = await usersStore.updateUser(
                { accessLevels: JSON.stringify(newAccessLevels) },
                { id: createdUsers[0].id },
            );

            expect(updatedUsers[0].accessLevels).to.include(AccessLevels.EMAIL_VERIFIED);
        });

        it('should increment login count on user update', async () => {
            if (skipTests) return;

            const testEmail = `${TEST_EMAIL_PREFIX}login-count${TEST_EMAIL_DOMAIN}`;
            const hashedPassword = await bcrypt.hash('TestPassword123!', 10);

            // Create user
            const testUser: ICreateUserParams = {
                email: testEmail,
                password: hashedPassword,
                firstName: 'Login',
                lastName: 'Counter',
                userName: 'logincounter',
                hasAgreedToTerms: true,
                accessLevels: JSON.stringify([AccessLevels.DEFAULT]),
                verificationCodes: JSON.stringify({ email: {} }),
            };

            const createdUsers = await usersStore.createUser(testUser);
            createdUserIds.push(createdUsers[0].id);

            // Initial login count should be 0 or 1
            expect(createdUsers[0].loginCount).to.be.at.most(1);

            // Simulate login by incrementing count
            const updatedUsers = await usersStore.updateUser(
                { loginCount: (createdUsers[0].loginCount || 0) + 1 },
                { id: createdUsers[0].id },
            );

            expect(updatedUsers[0].loginCount).to.equal((createdUsers[0].loginCount || 0) + 1);
        });
    });

    describe('User Search Flow', () => {
        it('should search for users with OR conditions', async () => {
            if (skipTests) return;

            const testEmail = `${TEST_EMAIL_PREFIX}search-or${TEST_EMAIL_DOMAIN}`;
            const hashedPassword = await bcrypt.hash('TestPassword123!', 10);

            // Create user
            const testUser: ICreateUserParams = {
                email: testEmail,
                password: hashedPassword,
                firstName: 'Search',
                lastName: 'OrTest',
                userName: 'searchortest',
                hasAgreedToTerms: true,
                accessLevels: JSON.stringify([AccessLevels.DEFAULT]),
                verificationCodes: JSON.stringify({ email: {} }),
            };

            const createdUsers = await usersStore.createUser(testUser);
            createdUserIds.push(createdUsers[0].id);

            // Search with OR conditions (by id or userName)
            const foundUsers = await usersStore.getUsers(
                { id: createdUsers[0].id },
                { userName: 'nonexistent' }, // This shouldn't match but OR should still find by id
            );

            expect(foundUsers.length).to.be.at.least(1);
            expect(foundUsers.some((u) => u.id === createdUsers[0].id)).to.be.eq(true);
        });

        it('should return empty array when user not found', async () => {
            if (skipTests) return;

            const foundUsers = await usersStore.findUser({
                email: 'definitely-does-not-exist-12345@nonexistent.com',
            });

            expect(foundUsers).to.be.an('array');
            expect(foundUsers.length).to.equal(0);
        });
    });

    describe('User Deletion Flow', () => {
        it('should delete user by id', async () => {
            if (skipTests) return;

            const testEmail = `${TEST_EMAIL_PREFIX}delete-user${TEST_EMAIL_DOMAIN}`;
            const hashedPassword = await bcrypt.hash('TestPassword123!', 10);

            // Create user
            const testUser: ICreateUserParams = {
                email: testEmail,
                password: hashedPassword,
                firstName: 'Delete',
                lastName: 'Me',
                userName: 'deleteuser',
                hasAgreedToTerms: true,
                accessLevels: JSON.stringify([AccessLevels.DEFAULT]),
                verificationCodes: JSON.stringify({ email: {} }),
            };

            const createdUsers = await usersStore.createUser(testUser);
            const userId = createdUsers[0].id;

            // Delete user
            await usersStore.deleteUsers({ id: userId });

            // Verify user is deleted
            const foundUsers = await usersStore.findUser({ email: testEmail });
            expect(foundUsers.length).to.equal(0);

            // Don't add to cleanup since already deleted
        });
    });

    describe('Password Verification Flow', () => {
        it('should store and verify hashed password', async () => {
            if (skipTests) return;

            const testEmail = `${TEST_EMAIL_PREFIX}password-verify${TEST_EMAIL_DOMAIN}`;
            const plainPassword = 'SecurePassword123!';
            const hashedPassword = await bcrypt.hash(plainPassword, 10);

            // Create user with hashed password
            const testUser: ICreateUserParams = {
                email: testEmail,
                password: hashedPassword,
                firstName: 'Password',
                lastName: 'Test',
                userName: 'passwordtest',
                hasAgreedToTerms: true,
                accessLevels: JSON.stringify([AccessLevels.DEFAULT]),
                verificationCodes: JSON.stringify({ email: {} }),
            };

            const createdUsers = await usersStore.createUser(testUser);
            createdUserIds.push(createdUsers[0].id);

            // Retrieve user and verify password
            const foundUsers = await usersStore.findUser({ email: testEmail });
            const storedHash = foundUsers[0].password;

            const isPasswordValid = await bcrypt.compare(plainPassword, storedHash);
            expect(isPasswordValid).to.be.eq(true);

            const isWrongPasswordValid = await bcrypt.compare('wrongpassword', storedHash);
            expect(isWrongPasswordValid).to.be.eq(false);
        });
    });
});
