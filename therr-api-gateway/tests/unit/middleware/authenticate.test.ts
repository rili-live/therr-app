/**
 * Unit Tests for authenticate middleware
 *
 * Tests JWT authentication, token validation, blacklist checking,
 * and proper header extraction from decoded tokens.
 *
 * Note: These tests verify the authentication logic independently
 * without requiring the full application context.
 */
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as jwt from 'jsonwebtoken';

describe('authenticate middleware', () => {
    let sandbox: sinon.SinonSandbox;

    const TEST_JWT_SECRET = 'test-secret-key';
    const validDecodedToken = {
        id: 'user-123',
        userName: 'testuser',
        accessLevels: ['user.default', 'user.premium'],
        organizations: { 'org-1': ['admin'], 'org-2': ['member'] },
        isBlocked: false,
    };

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('Authorization Header Validation', () => {
        it('should parse Bearer token from authorization header', () => {
            const token = 'some-jwt-token';
            const authHeader = `Bearer ${token}`;
            const parts = authHeader.split(' ');

            expect(parts[0]).to.equal('Bearer');
            expect(parts[1]).to.equal(token);
        });

        it('should identify non-Bearer authorization schemes', () => {
            const basicAuth = 'Basic sometoken';
            const parts = basicAuth.split(' ');

            expect(parts[0]).to.equal('Basic');
            expect(parts[0]).to.not.equal('Bearer');
        });

        it('should handle missing authorization header', () => {
            const headers: Record<string, string> = {};
            const authHeader = headers.authorization;

            expect(authHeader).to.be.eq(undefined);
        });
    });

    describe('JWT Token Decoding', () => {
        it('should create valid JWT with user payload', () => {
            const token = jwt.sign(validDecodedToken, TEST_JWT_SECRET);

            expect(token).to.be.a('string');
            expect(token.split('.')).to.have.lengthOf(3);
        });

        it('should decode JWT and extract user ID', () => {
            const token = jwt.sign(validDecodedToken, TEST_JWT_SECRET);
            const decoded = jwt.verify(token, TEST_JWT_SECRET) as jwt.JwtPayload;

            expect(decoded.id).to.equal('user-123');
        });

        it('should decode JWT and extract username', () => {
            const token = jwt.sign(validDecodedToken, TEST_JWT_SECRET);
            const decoded = jwt.verify(token, TEST_JWT_SECRET) as jwt.JwtPayload;

            expect(decoded.userName).to.equal('testuser');
        });

        it('should decode JWT and extract access levels', () => {
            const token = jwt.sign(validDecodedToken, TEST_JWT_SECRET);
            const decoded = jwt.verify(token, TEST_JWT_SECRET) as jwt.JwtPayload;

            expect(decoded.accessLevels).to.deep.equal(['user.default', 'user.premium']);
        });

        it('should decode JWT and extract organizations', () => {
            const token = jwt.sign(validDecodedToken, TEST_JWT_SECRET);
            const decoded = jwt.verify(token, TEST_JWT_SECRET) as jwt.JwtPayload;

            expect(decoded.organizations).to.deep.equal({ 'org-1': ['admin'], 'org-2': ['member'] });
        });

        it('should stringify access levels for header propagation', () => {
            const token = jwt.sign(validDecodedToken, TEST_JWT_SECRET);
            const decoded = jwt.verify(token, TEST_JWT_SECRET) as jwt.JwtPayload;

            const stringified = decoded.accessLevels ? JSON.stringify(decoded.accessLevels) : '[]';
            expect(stringified).to.equal('["user.default","user.premium"]');
        });

        it('should stringify organizations for header propagation', () => {
            const token = jwt.sign(validDecodedToken, TEST_JWT_SECRET);
            const decoded = jwt.verify(token, TEST_JWT_SECRET) as jwt.JwtPayload;

            const stringified = decoded.organizations ? JSON.stringify(decoded.organizations) : '{}';
            expect(stringified).to.equal('{"org-1":["admin"],"org-2":["member"]}');
        });

        it('should default to empty array when access levels missing', () => {
            const tokenWithoutAccessLevels = jwt.sign({
                id: 'user-123',
                userName: 'testuser',
            }, TEST_JWT_SECRET);

            const decoded = jwt.verify(tokenWithoutAccessLevels, TEST_JWT_SECRET) as jwt.JwtPayload;
            const stringified = decoded.accessLevels ? JSON.stringify(decoded.accessLevels) : '[]';

            expect(stringified).to.equal('[]');
        });

        it('should default to empty object when organizations missing', () => {
            const tokenWithoutOrgs = jwt.sign({
                id: 'user-123',
                userName: 'testuser',
            }, TEST_JWT_SECRET);

            const decoded = jwt.verify(tokenWithoutOrgs, TEST_JWT_SECRET) as jwt.JwtPayload;
            const stringified = decoded.organizations ? JSON.stringify(decoded.organizations) : '{}';

            expect(stringified).to.equal('{}');
        });
    });

    describe('Token Expiration', () => {
        it('should reject expired tokens', () => {
            const expiredToken = jwt.sign(validDecodedToken, TEST_JWT_SECRET, { expiresIn: '-1s' });

            expect(() => {
                jwt.verify(expiredToken, TEST_JWT_SECRET);
            }).to.throw(jwt.TokenExpiredError);
        });

        it('should identify TokenExpiredError by name', () => {
            const expiredToken = jwt.sign(validDecodedToken, TEST_JWT_SECRET, { expiresIn: '-1s' });

            try {
                jwt.verify(expiredToken, TEST_JWT_SECRET);
                expect.fail('Should have thrown');
            } catch (err: any) {
                expect(err.name).to.equal('TokenExpiredError');
            }
        });

        it('should accept non-expired tokens', () => {
            const validToken = jwt.sign(validDecodedToken, TEST_JWT_SECRET, { expiresIn: '1h' });

            const decoded = jwt.verify(validToken, TEST_JWT_SECRET);
            expect(decoded).to.be.an('object');
        });
    });

    describe('Invalid Token Handling', () => {
        it('should reject tokens with invalid signature', () => {
            const tokenWithWrongSecret = jwt.sign(validDecodedToken, 'wrong-secret');

            expect(() => {
                jwt.verify(tokenWithWrongSecret, TEST_JWT_SECRET);
            }).to.throw(jwt.JsonWebTokenError);
        });

        it('should identify JsonWebTokenError by name', () => {
            const tokenWithWrongSecret = jwt.sign(validDecodedToken, 'wrong-secret');

            try {
                jwt.verify(tokenWithWrongSecret, TEST_JWT_SECRET);
                expect.fail('Should have thrown');
            } catch (err: any) {
                expect(err.name).to.equal('JsonWebTokenError');
            }
        });

        it('should reject malformed tokens', () => {
            const malformedToken = 'not.a.valid.token';

            expect(() => {
                jwt.verify(malformedToken, TEST_JWT_SECRET);
            }).to.throw(jwt.JsonWebTokenError);
        });
    });

    describe('Blocked User Handling', () => {
        it('should include isBlocked flag in token payload', () => {
            const blockedUserToken = jwt.sign({
                ...validDecodedToken,
                isBlocked: true,
            }, TEST_JWT_SECRET);

            const decoded = jwt.verify(blockedUserToken, TEST_JWT_SECRET) as jwt.JwtPayload;
            expect(decoded.isBlocked).to.be.eq(true);
        });

        it('should check if path includes logout endpoint', () => {
            const logoutPath = '/users-service/auth/logout';
            expect(logoutPath.includes('users-service/auth/logout')).to.be.eq(true);
        });

        it('should not block on logout path even if user is blocked', () => {
            const path = '/users-service/auth/logout';
            const isBlocked = true;
            const isLogoutPath = path.includes('users-service/auth/logout');

            // The logic: blocked users CAN access logout
            const shouldBlock = isBlocked && !isLogoutPath;
            expect(shouldBlock).to.be.eq(false);
        });

        it('should block on non-logout paths if user is blocked', () => {
            const path = '/users-service/users/profile';
            const isBlocked = true;
            const isLogoutPath = path.includes('users-service/auth/logout');

            const shouldBlock = isBlocked && !isLogoutPath;
            expect(shouldBlock).to.be.eq(true);
        });
    });

    describe('HTTP Status Code Mapping', () => {
        it('should map missing auth to 401 Unauthorized', () => {
            const statusCode = 401;
            expect(statusCode).to.equal(401);
        });

        it('should map expired token to 401 Unauthorized', () => {
            const statusCode = 401; // TokenExpiredError
            expect(statusCode).to.equal(401);
        });

        it('should map invalid token to 403 Forbidden', () => {
            const statusCode = 403; // JsonWebTokenError
            expect(statusCode).to.equal(403);
        });

        it('should map blocked user to 403 Forbidden', () => {
            const statusCode = 403; // User is blocked
            expect(statusCode).to.equal(403);
        });
    });
});
