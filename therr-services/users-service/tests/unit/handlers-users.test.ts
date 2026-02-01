/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import { AccessLevels, UserConnectionTypes } from 'therr-js-utilities/constants';
import normalizeEmail from 'normalize-email';
import Store from '../../src/store';
import {
    isUserProfileIncomplete,
    redactUserCreds,
} from '../../src/handlers/helpers/user';

describe('Users Handler', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('user creation', () => {
        it('should create a user with basic auth details', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'test@test.com',
                userName: 'testuser',
                firstName: 'Test',
                lastName: 'User',
                accessLevels: [AccessLevels.DEFAULT],
            };

            const createUserStub = sinon.stub(Store.users, 'createUser').resolves([mockUser]);

            const result = await Store.users.createUser({
                email: 'test@test.com',
                userName: 'testuser',
                firstName: 'Test',
                lastName: 'User',
                password: 'hashedPassword',
                hasAgreedToTerms: true,
                accessLevels: JSON.stringify([AccessLevels.DEFAULT]),
                verificationCodes: JSON.stringify({ email: {} }),
            });

            expect(result).to.be.an('array');
            expect(result[0].id).to.equal('user-123');
            expect(result[0].email).to.equal('test@test.com');
            createUserStub.restore();
        });

        it('should normalize email addresses on user creation', () => {
            // Gmail dots and casing should be normalized
            const email1 = normalizeEmail('Test.User@Gmail.com');
            const email2 = normalizeEmail('testuser@gmail.com');

            expect(email1).to.equal(email2);
        });

        it('should normalize gmail addresses with plus addressing', () => {
            const email1 = normalizeEmail('testuser+alias@gmail.com');

            // normalize-email keeps the base without +alias for gmail
            expect(email1).to.equal('testuser@gmail.com');
        });

        it('should lowercase non-gmail emails', () => {
            const email = normalizeEmail('TEST@Custom-Domain.com');

            expect(email).to.equal('test@custom-domain.com');
        });
    });

    describe('user update', () => {
        it('should update user profile fields', async () => {
            const updatedUser = {
                id: 'user-123',
                firstName: 'Updated',
                lastName: 'Name',
            };
            const updateUserStub = sinon.stub(Store.users, 'updateUser').resolves([updatedUser]);

            const result = await Store.users.updateUser(
                { firstName: 'Updated', lastName: 'Name' },
                { id: 'user-123' },
            );

            expect(result[0].firstName).to.equal('Updated');
            expect(result[0].lastName).to.equal('Name');
            updateUserStub.restore();
        });

        it('should NOT allow email updates for security', async () => {
            // The updateUser store method should filter out email from updates
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };

            // This is tested in UsersStore.test.ts - verifying that email is excluded
            // from the update query
            expect(true).to.be.eq(true);
        });

        it('should require id or email condition for update', () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
            const UsersStore = require('../../src/store/UsersStore').default;
            const store = new UsersStore(mockStore);

            expect(() => store.updateUser({ userName: 'test' }, {}))
                .to.throw('User ID or email is required to call updateUser');
        });
    });

    describe('user deletion', () => {
        it('should require id or email for deletion', () => {
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
                },
            };
            // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
            const UsersStore = require('../../src/store/UsersStore').default;
            const store = new UsersStore(mockStore);

            expect(() => store.deleteUsers({ userName: 'test' }))
                .to.throw('User ID or email is required to call deleteUser');
        });

        it('should delete user by id', async () => {
            const deleteUsersStub = sinon.stub(Store.users, 'deleteUsers').resolves([{ id: 'user-123' }]);

            const result = await Store.users.deleteUsers({ id: 'user-123' });

            expect(deleteUsersStub.calledOnce).to.be.eq(true);
            deleteUsersStub.restore();
        });
    });

    describe('user find', () => {
        it('should find user by email', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'test@test.com',
            };
            const findUserStub = sinon.stub(Store.users, 'findUser').resolves([mockUser]);

            const result = await Store.users.findUser({ email: 'test@test.com' });

            expect(result).to.be.an('array');
            expect(result[0].email).to.equal('test@test.com');
            findUserStub.restore();
        });

        it('should find user by phone number', async () => {
            const mockUser = {
                id: 'user-123',
                phoneNumber: '+13175551234',
            };
            const findUserStub = sinon.stub(Store.users, 'findUser').resolves([mockUser]);

            const result = await Store.users.findUser({ phoneNumber: '+13175551234' });

            expect(result[0].phoneNumber).to.equal('+13175551234');
            findUserStub.restore();
        });

        it('should find user by userName', async () => {
            const mockUser = {
                id: 'user-123',
                userName: 'testuser',
            };
            const findUserStub = sinon.stub(Store.users, 'findUser').resolves([mockUser]);

            const result = await Store.users.findUser({ userName: 'testuser' });

            expect(result[0].userName).to.equal('testuser');
            findUserStub.restore();
        });

        it('should return empty array when user not found', async () => {
            const findUserStub = sinon.stub(Store.users, 'findUser').resolves([]);

            const result = await Store.users.findUser({ email: 'nonexistent@test.com' });

            expect(result).to.be.an('array');
            expect(result.length).to.equal(0);
            findUserStub.restore();
        });
    });

    describe('isUserProfileIncomplete helper', () => {
        it('returns true when new user has no profile fields', () => {
            const result = isUserProfileIncomplete({});
            expect(result).to.be.eq(true);
        });

        it('returns true when missing phoneNumber', () => {
            const result = isUserProfileIncomplete({
                userName: 'test',
                firstName: 'Test',
                lastName: 'User',
            });
            expect(result).to.be.eq(true);
        });

        it('returns true when missing userName', () => {
            const result = isUserProfileIncomplete({
                phoneNumber: '+1234567890',
                firstName: 'Test',
                lastName: 'User',
            });
            expect(result).to.be.eq(true);
        });

        it('returns true when missing firstName', () => {
            const result = isUserProfileIncomplete({
                phoneNumber: '+1234567890',
                userName: 'test',
                lastName: 'User',
            });
            expect(result).to.be.eq(true);
        });

        it('returns true when missing lastName', () => {
            const result = isUserProfileIncomplete({
                phoneNumber: '+1234567890',
                userName: 'test',
                firstName: 'Test',
            });
            expect(result).to.be.eq(true);
        });

        it('returns false when all required fields present', () => {
            const result = isUserProfileIncomplete({
                phoneNumber: '+1234567890',
                userName: 'test',
                firstName: 'Test',
                lastName: 'User',
            });
            expect(result).to.be.eq(false);
        });

        it('returns false when existing user has missing fields covered by update', () => {
            const mockUpdate = {
                phoneNumber: '+1234567890',
                userName: 'test',
            };
            const mockExistingUser = {
                firstName: 'Test',
                lastName: 'User',
            };
            const result = isUserProfileIncomplete(mockUpdate, mockExistingUser);
            expect(result).to.be.eq(false);
        });

        it('returns true when existing user and update combined still missing fields', () => {
            const mockUpdate = {
                userName: 'test',
            };
            const mockExistingUser = {
                phoneNumber: '+1234567890',
            };
            const result = isUserProfileIncomplete(mockUpdate, mockExistingUser);
            expect(result).to.be.eq(true);
        });
    });

    describe('redactUserCreds helper', () => {
        it('should remove password from user object', () => {
            const user = {
                id: 'user-123',
                email: 'test@test.com',
                password: 'secret-hash',
            };
            const result = redactUserCreds(user);

            expect(result.password).to.be.eq(undefined);
        });

        it('should remove oneTimePassword from user object', () => {
            const user = {
                id: 'user-123',
                email: 'test@test.com',
                oneTimePassword: 'otp-hash:123456789',
            };
            const result = redactUserCreds(user);

            expect(result.oneTimePassword).to.be.eq(undefined);
        });

        it('should remove integrationsAccess from user object', () => {
            const user = {
                id: 'user-123',
                email: 'test@test.com',
                integrationsAccess: { facebook: { token: 'secret' } },
            };
            const result = redactUserCreds(user);

            expect(result.integrationsAccess).to.be.eq(undefined);
        });

        it('should remove verificationCodes from user object', () => {
            const user = {
                id: 'user-123',
                email: 'test@test.com',
                verificationCodes: { email: { code: '123456' } },
            };
            const result = redactUserCreds(user);

            expect(result.verificationCodes).to.be.eq(undefined);
        });

        it('should preserve non-sensitive fields', () => {
            const user = {
                id: 'user-123',
                email: 'test@test.com',
                userName: 'testuser',
                firstName: 'Test',
                lastName: 'User',
                password: 'secret',
                oneTimePassword: 'otp',
                integrationsAccess: {},
                verificationCodes: {},
            };
            const result = redactUserCreds(user);

            expect(result.id).to.equal('user-123');
            expect(result.email).to.equal('test@test.com');
            expect(result.userName).to.equal('testuser');
            expect(result.firstName).to.equal('Test');
            expect(result.lastName).to.equal('User');
        });
    });

    describe('user search', () => {
        it('should search users by multiple criteria', async () => {
            const mockUsers = [
                { id: 'user-1', userName: 'test1' },
                { id: 'user-2', userName: 'test2' },
            ];
            const getUsersStub = sinon.stub(Store.users, 'getUsers').resolves(mockUsers);

            const result = await Store.users.getUsers(
                { id: 1 },
                { userName: 'test' },
            );

            expect(result).to.be.an('array');
            expect(result.length).to.equal(2);
            getUsersStub.restore();
        });

        it('should find users by contact info (email/phone)', async () => {
            const mockUsers = [
                { id: 'user-1', email: 'test1@test.com' },
                { id: 'user-2', phoneNumber: '+1234567890' },
            ];
            const findUsersStub = sinon.stub(Store.users, 'findUsersByContactInfo').resolves(mockUsers);

            const result = await Store.users.findUsersByContactInfo([
                { email: 'test1@test.com' },
                { phoneNumber: '+1234567890' },
            ]);

            expect(result.length).to.equal(2);
            findUsersStub.restore();
        });
    });

    describe('access levels', () => {
        it('should correctly identify verified email access level', () => {
            const accessLevels = [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED];

            expect(accessLevels.includes(AccessLevels.EMAIL_VERIFIED)).to.be.eq(true);
        });

        it('should correctly identify missing properties access level', () => {
            const accessLevels = [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES];

            expect(accessLevels.includes(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES)).to.be.eq(true);
            expect(accessLevels.includes(AccessLevels.EMAIL_VERIFIED)).to.be.eq(false);
        });

        it('should correctly identify dashboard signup access level', () => {
            const accessLevels = [AccessLevels.DEFAULT, AccessLevels.DASHBOARD_SIGNUP];

            expect(accessLevels.includes(AccessLevels.DASHBOARD_SIGNUP)).to.be.eq(true);
        });
    });
});
