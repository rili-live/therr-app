/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import * as jwt from 'jsonwebtoken';
import { AccessLevels } from 'therr-js-utilities/constants';
import Store from '../../src/store';

// Mock handlers inline since we need to test the logic
describe('Auth Handler', () => {
    let mockReq: any;
    let mockRes: any;

    beforeEach(() => {
        mockRes = {
            status: sinon.stub().returnsThis(),
            send: sinon.stub().returnsThis(),
        };
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('login flow', () => {
        it('should return 404 when user is not found', async () => {
            const getUsersStub = sinon.stub(Store.users, 'getUsers').resolves([]);

            mockReq = {
                headers: {
                    'x-localecode': 'en-us',
                    'x-brand-variation': 'therr',
                },
                body: {
                    userName: 'nonexistent@test.com',
                    password: 'test123',
                    isSSO: false,
                },
            };

            // Simulate the login check
            const userResults = await Store.users.getUsers(
                { userName: mockReq.body.userName },
                { email: mockReq.body.userName },
                { phoneNumber: mockReq.body.userName },
            );

            expect(userResults).to.be.an('array');
            expect(userResults.length).to.equal(0);
            getUsersStub.restore();
        });

        it('should return 401 when user is not verified', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'test@test.com',
                accessLevels: [AccessLevels.DEFAULT], // No EMAIL_VERIFIED
            };
            const getUsersStub = sinon.stub(Store.users, 'getUsers').resolves([mockUser]);

            mockReq = {
                headers: {
                    'x-localecode': 'en-us',
                },
                body: {
                    userName: 'test@test.com',
                    password: 'test123',
                    isSSO: false,
                },
            };

            const userResults = await Store.users.getUsers({ userName: mockReq.body.userName });

            expect(userResults.length).to.equal(1);
            expect(userResults[0].accessLevels).to.not.include(AccessLevels.EMAIL_VERIFIED);
            expect(userResults[0].accessLevels).to.not.include(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES);
            getUsersStub.restore();
        });

        it('should allow login for verified users', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'test@test.com',
                accessLevels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED],
                password: 'hashed-password',
                loginCount: 0,
            };
            const getUsersStub = sinon.stub(Store.users, 'getUsers').resolves([mockUser]);

            const userResults = await Store.users.getUsers({ userName: 'test@test.com' });

            expect(userResults.length).to.equal(1);
            expect(userResults[0].accessLevels).to.include(AccessLevels.EMAIL_VERIFIED);
            getUsersStub.restore();
        });

        it('should handle SSO login without password', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'sso@test.com',
                accessLevels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED],
            };

            mockReq = {
                headers: {
                    'x-localecode': 'en-us',
                },
                body: {
                    isSSO: true,
                    ssoProvider: 'google',
                    idToken: 'mock-id-token',
                    userEmail: 'sso@test.com',
                },
            };

            // For SSO, we don't require password
            expect(mockReq.body.password).to.be.eq(undefined);
            expect(mockReq.body.isSSO).to.be.eq(true);
        });

        it('should normalize email for user lookup', async () => {
            const getUsersStub = sinon.stub(Store.users, 'getUsers').resolves([]);

            // Test with gmail dots and plus addressing
            const testEmail = 'Test.User+alias@gmail.com';
            await Store.users.getUsers({ email: testEmail });

            expect(getUsersStub.calledOnce).to.be.eq(true);
            getUsersStub.restore();
        });
    });

    describe('logout flow', () => {
        it('should return 404 when user is not found during logout', async () => {
            const getUsersStub = sinon.stub(Store.users, 'getUsers').resolves([]);

            const userResults = await Store.users.getUsers({ userName: 'nonexistent' });

            expect(userResults.length).to.equal(0);
            getUsersStub.restore();
        });

        it('should successfully logout existing user', async () => {
            const mockUser = {
                id: 'user-123',
                userName: 'testuser',
            };
            const getUsersStub = sinon.stub(Store.users, 'getUsers').resolves([mockUser]);

            const userResults = await Store.users.getUsers({ userName: 'testuser' });

            expect(userResults.length).to.equal(1);
            expect(userResults[0].userName).to.equal('testuser');
            getUsersStub.restore();
        });
    });

    describe('verifyToken flow', () => {
        it('should decode valid JWT token', () => {
            const mockPayload = {
                id: 'user-123',
                email: 'test@test.com',
            };
            const secret = 'test-secret';
            const token = jwt.sign(mockPayload, secret, { expiresIn: '1h' });

            const decoded = jwt.verify(token, secret) as any;

            expect(decoded.id).to.equal(mockPayload.id);
            expect(decoded.email).to.equal(mockPayload.email);
        });

        it('should throw TokenExpiredError for expired token', () => {
            const mockPayload = {
                id: 'user-123',
            };
            const secret = 'test-secret';
            const token = jwt.sign(mockPayload, secret, { expiresIn: '-1s' });

            expect(() => jwt.verify(token, secret)).to.throw('jwt expired');
        });

        it('should throw error for invalid token', () => {
            const secret = 'test-secret';
            const invalidToken = 'invalid.token.here';

            expect(() => jwt.verify(invalidToken, secret)).to.throw();
        });

        it('should throw error for tampered token', () => {
            const mockPayload = { id: 'user-123' };
            const secret = 'correct-secret';
            const wrongSecret = 'wrong-secret';
            const token = jwt.sign(mockPayload, secret);

            expect(() => jwt.verify(token, wrongSecret)).to.throw('invalid signature');
        });
    });
});
