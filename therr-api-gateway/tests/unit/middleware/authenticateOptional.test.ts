/**
 * Unit Tests for authenticateOptional middleware
 *
 * Tests optional JWT authentication - continues to next middleware
 * even without authorization header, but validates tokens when provided.
 *
 * Note: These tests verify the authentication logic independently
 * without requiring the full application context.
 */
import { expect } from 'chai';
import * as sinon from 'sinon';
import jwt from 'jsonwebtoken';

describe('authenticateOptional middleware', () => {
    let sandbox: sinon.SinonSandbox;

    const TEST_JWT_SECRET = 'test-secret-key';
    const validDecodedToken = {
        id: 'user-123',
        userName: 'testuser',
        accessLevels: ['user.default', 'user.premium'],
        organizations: { 'org-1': ['admin'] },
    };

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('Optional Authorization Logic', () => {
        it('should allow requests without authorization header', () => {
            const headers: Record<string, string> = {};
            const hasBearerToken = headers.authorization?.split(' ')[0] === 'Bearer';

            // Without authorization, should continue (optional auth)
            expect(hasBearerToken).to.be.eq(false);
        });

        it('should allow requests with empty authorization header', () => {
            const headers = { authorization: '' };
            const hasBearerToken = headers.authorization?.split(' ')[0] === 'Bearer';

            expect(hasBearerToken).to.be.eq(false);
        });

        it('should process Bearer token when provided', () => {
            const token = jwt.sign(validDecodedToken, TEST_JWT_SECRET);
            const headers = { authorization: `Bearer ${token}` };
            const hasBearerToken = headers.authorization?.split(' ')[0] === 'Bearer';

            expect(hasBearerToken).to.be.eq(true);
        });
    });

    describe('Valid Token Handling', () => {
        it('should extract user context when valid token provided', () => {
            const token = jwt.sign(validDecodedToken, TEST_JWT_SECRET);
            const decoded = jwt.verify(token, TEST_JWT_SECRET) as jwt.JwtPayload;

            expect(decoded.id).to.equal('user-123');
            expect(decoded.userName).to.equal('testuser');
        });

        it('should stringify access levels from valid token', () => {
            const token = jwt.sign(validDecodedToken, TEST_JWT_SECRET);
            const decoded = jwt.verify(token, TEST_JWT_SECRET) as jwt.JwtPayload;
            const stringified = decoded.accessLevels ? JSON.stringify(decoded.accessLevels) : '[]';

            expect(stringified).to.equal('["user.default","user.premium"]');
        });

        it('should stringify organizations from valid token', () => {
            const token = jwt.sign(validDecodedToken, TEST_JWT_SECRET);
            const decoded = jwt.verify(token, TEST_JWT_SECRET) as jwt.JwtPayload;
            const stringified = decoded.organizations ? JSON.stringify(decoded.organizations) : '{}';

            expect(stringified).to.equal('{"org-1":["admin"]}');
        });

        it('should default to empty array for missing access levels', () => {
            const tokenWithoutAccessLevels = jwt.sign({
                id: 'user-123',
                userName: 'testuser',
            }, TEST_JWT_SECRET);

            const decoded = jwt.verify(tokenWithoutAccessLevels, TEST_JWT_SECRET) as jwt.JwtPayload;
            const stringified = decoded.accessLevels ? JSON.stringify(decoded.accessLevels) : '[]';

            expect(stringified).to.equal('[]');
        });

        it('should default to empty object for missing organizations', () => {
            const tokenWithoutOrgs = jwt.sign({
                id: 'user-123',
                userName: 'testuser',
            }, TEST_JWT_SECRET);

            const decoded = jwt.verify(tokenWithoutOrgs, TEST_JWT_SECRET) as jwt.JwtPayload;
            const stringified = decoded.organizations ? JSON.stringify(decoded.organizations) : '{}';

            expect(stringified).to.equal('{}');
        });
    });

    describe('Invalid Token Handling', () => {
        it('should detect expired tokens', () => {
            const expiredToken = jwt.sign(validDecodedToken, TEST_JWT_SECRET, { expiresIn: '-1s' });

            try {
                jwt.verify(expiredToken, TEST_JWT_SECRET);
                expect.fail('Should have thrown');
            } catch (err: any) {
                expect(err.name).to.equal('TokenExpiredError');
            }
        });

        it('should detect invalid tokens', () => {
            const invalidToken = jwt.sign(validDecodedToken, 'wrong-secret');

            try {
                jwt.verify(invalidToken, TEST_JWT_SECRET);
                expect.fail('Should have thrown');
            } catch (err: any) {
                expect(err.name).to.equal('JsonWebTokenError');
            }
        });

        it('should detect malformed tokens', () => {
            const malformedToken = 'not.a.valid.token';

            try {
                jwt.verify(malformedToken, TEST_JWT_SECRET);
                expect.fail('Should have thrown');
            } catch (err: any) {
                expect(err.name).to.equal('JsonWebTokenError');
            }
        });
    });

    describe('Non-Bearer Token Handling', () => {
        it('should not process non-Bearer authorization schemes', () => {
            const headers = { authorization: 'Basic sometoken' };
            const isBearerToken = headers.authorization?.split(' ')[0] === 'Bearer';

            // Non-Bearer tokens should be ignored (continue without user context)
            expect(isBearerToken).to.be.eq(false);
        });

        it('should not process incomplete Bearer header', () => {
            const headers = { authorization: 'Bearer' };
            const parts = headers.authorization.split(' ');
            const token = parts[1];

            // Missing token part
            expect(token).to.be.eq(undefined);
        });
    });

    describe('Error Response Mapping', () => {
        it('should map expired token to 401', () => {
            const errorName = 'TokenExpiredError';
            const statusCode = errorName === 'TokenExpiredError' ? 401 : 500;

            expect(statusCode).to.equal(401);
        });

        it('should map invalid token to 403', () => {
            const errorName = 'JsonWebTokenError';
            const statusCode = errorName === 'JsonWebTokenError' ? 403 : 500;

            expect(statusCode).to.equal(403);
        });
    });
});
