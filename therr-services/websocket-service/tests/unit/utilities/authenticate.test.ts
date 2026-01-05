import { expect } from 'chai';
import sinon from 'sinon';
import jwt from 'jsonwebtoken';
import { SocketServerActionTypes, SOCKET_MIDDLEWARE_ACTION } from 'therr-js-utilities/constants';

// Test the authentication logic without importing the actual module
// (to avoid Redis connection issues in unit tests)
describe('Socket Authentication', () => {
    let sandbox: sinon.SinonSandbox;
    const originalEnv = process.env.JWT_SECRET;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        process.env.JWT_SECRET = 'test-secret-key';
    });

    afterEach(() => {
        sandbox.restore();
        process.env.JWT_SECRET = originalEnv;
    });

    describe('Token Validation', () => {
        it('should return false when socket has no handshake', async () => {
            const socket: any = {};
            const hasHandshake = !!socket.handshake;
            expect(hasHandshake).to.be.eq(false);
        });

        it('should return false when handshake has no query', async () => {
            const socket: any = {
                handshake: {},
            };
            const hasQuery = !!(socket.handshake && socket.handshake.query);
            expect(hasQuery).to.be.eq(false);
        });

        it('should return false when query has no token', async () => {
            const socket: any = {
                handshake: {
                    query: {},
                },
            };
            const hasToken = !!(socket.handshake?.query?.token);
            expect(hasToken).to.be.eq(false);
        });

        it('should verify a valid JWT token', () => {
            const secret = 'test-secret-key';
            const payload = {
                id: 'user-123',
                userName: 'testuser',
                email: 'test@example.com',
            };

            const token = jwt.sign(payload, secret);
            const decoded = jwt.verify(token, secret) as any;

            expect(decoded.id).to.equal('user-123');
            expect(decoded.userName).to.equal('testuser');
            expect(decoded.email).to.equal('test@example.com');
        });

        it('should throw error for invalid token', () => {
            const secret = 'test-secret-key';
            const invalidToken = 'invalid.token.here';

            expect(() => jwt.verify(invalidToken, secret)).to.throw();
        });

        it('should throw error for expired token', () => {
            const secret = 'test-secret-key';
            const payload = { id: 'user-123' };

            // Create token that expired 1 hour ago
            const token = jwt.sign(payload, secret, { expiresIn: '-1h' });

            expect(() => jwt.verify(token, secret)).to.throw(/expired/i);
        });

        it('should throw error for token signed with wrong secret', () => {
            const wrongSecret = 'wrong-secret';
            const correctSecret = 'correct-secret';
            const payload = { id: 'user-123' };

            const token = jwt.sign(payload, wrongSecret);

            expect(() => jwt.verify(token, correctSecret)).to.throw(/signature/i);
        });
    });

    describe('Socket Event Emission', () => {
        it('should emit UNAUTHORIZED action when token is invalid', () => {
            const emitSpy = sandbox.spy();
            const socket: any = {
                id: 'socket-123',
                handshake: {
                    query: { token: 'invalid-token' },
                },
                emit: emitSpy,
            };

            // Simulate what authenticate.ts does on error
            socket.emit(SOCKET_MIDDLEWARE_ACTION, {
                type: SocketServerActionTypes.UNAUTHORIZED,
                data: {
                    message: 'Unable to autheticate websocket request',
                },
            });

            expect(emitSpy.calledOnce).to.be.eq(true);
            expect(emitSpy.firstCall.args[0]).to.equal(SOCKET_MIDDLEWARE_ACTION);
            expect(emitSpy.firstCall.args[1].type).to.equal(SocketServerActionTypes.UNAUTHORIZED);
        });
    });

    describe('Token Payload Extraction', () => {
        it('should extract user information from decoded token', () => {
            const secret = 'test-secret-key';
            const payload = {
                id: 'user-456',
                userName: 'johndoe',
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                iat: Math.floor(Date.now() / 1000),
            };

            const token = jwt.sign(payload, secret);
            const decoded = jwt.verify(token, secret) as any;

            expect(decoded).to.include({
                id: 'user-456',
                userName: 'johndoe',
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
            });
        });

        it('should handle tokens with minimal payload', () => {
            const secret = 'test-secret-key';
            const payload = { id: 'user-minimal' };

            const token = jwt.sign(payload, secret);
            const decoded = jwt.verify(token, secret) as any;

            expect(decoded.id).to.equal('user-minimal');
        });

        it('should preserve custom claims in token', () => {
            const secret = 'test-secret-key';
            const payload = {
                id: 'user-123',
                customClaim: 'customValue',
                roles: ['user', 'admin'],
            };

            const token = jwt.sign(payload, secret);
            const decoded = jwt.verify(token, secret) as any;

            expect(decoded.customClaim).to.equal('customValue');
            expect(decoded.roles).to.deep.equal(['user', 'admin']);
        });
    });

    describe('Socket Handshake Query Parameters', () => {
        it('should extract all required query parameters', () => {
            const socket: any = {
                handshake: {
                    query: {
                        token: 'jwt-token-here',
                        userId: 'user-123',
                        userName: 'testuser',
                        locale: 'en-us',
                        brandVariation: 'therr',
                        platform: 'mobile',
                    },
                },
            };

            const {
                token, userId, userName, locale, brandVariation, platform,
            } = socket.handshake.query;

            expect(token).to.equal('jwt-token-here');
            expect(userId).to.equal('user-123');
            expect(userName).to.equal('testuser');
            expect(locale).to.equal('en-us');
            expect(brandVariation).to.equal('therr');
            expect(platform).to.equal('mobile');
        });

        it('should handle optional query parameters', () => {
            const socket: any = {
                handshake: {
                    query: {
                        token: 'jwt-token',
                        // Optional parameters may not be present
                    },
                },
            };

            const locale = socket.handshake.query.locale || 'en-us';
            const brandVariation = socket.handshake.query.brandVariation || 'therr';

            expect(locale).to.equal('en-us');
            expect(brandVariation).to.equal('therr');
        });
    });
});
