/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import jwt from 'jsonwebtoken';
import { createRefreshToken, createUserToken } from '../../src/utilities/userHelpers';

describe('userHelpers', () => {
    const originalSecret = process.env.JWT_SECRET;

    before(() => {
        process.env.JWT_SECRET = 'test-secret-key';
    });

    after(() => {
        process.env.JWT_SECRET = originalSecret;
    });

    describe('createRefreshToken', () => {
        it('returns a token and jti', () => {
            const result = createRefreshToken('user-123');

            expect(result).to.have.property('token').that.is.a('string');
            expect(result).to.have.property('jti').that.is.a('string');
        });

        it('includes jti, id, and type in the token payload', () => {
            const result = createRefreshToken('user-123');
            const decoded = jwt.decode(result.token) as any;

            expect(decoded.jti).to.equal(result.jti);
            expect(decoded.id).to.equal('user-123');
            expect(decoded.type).to.equal('refresh');
        });

        it('sets 30d expiry for standard (non-rememberMe) tokens', () => {
            const result = createRefreshToken('user-123', false);
            const decoded = jwt.decode(result.token) as any;

            const expectedDuration = 30 * 24 * 60 * 60; // 30 days in seconds
            const actualDuration = decoded.exp - decoded.iat;

            expect(actualDuration).to.equal(expectedDuration);
        });

        it('sets 90d expiry for rememberMe tokens', () => {
            const result = createRefreshToken('user-123', true);
            const decoded = jwt.decode(result.token) as any;

            const expectedDuration = 90 * 24 * 60 * 60; // 90 days in seconds
            const actualDuration = decoded.exp - decoded.iat;

            expect(actualDuration).to.equal(expectedDuration);
        });

        it('generates unique JTI per invocation', () => {
            const result1 = createRefreshToken('user-123');
            const result2 = createRefreshToken('user-123');

            expect(result1.jti).to.not.equal(result2.jti);
        });
    });

    describe('createUserToken', () => {
        const mockUser = {
            id: 'user-123',
            userName: 'testuser',
            email: 'test@example.com',
            phoneNumber: '+1234567890',
            integrations: {},
            isBlocked: false,
            isSSO: false,
            accessLevels: ['user.default'],
        };

        it('sets 1d expiry for standard tokens', () => {
            const token = createUserToken(mockUser, [], false);
            const decoded = jwt.decode(token) as any;

            const expectedDuration = 1 * 24 * 60 * 60; // 1 day in seconds
            const actualDuration = decoded.exp - decoded.iat;

            expect(actualDuration).to.equal(expectedDuration);
        });

        it('sets 7d expiry for rememberMe tokens', () => {
            const token = createUserToken(mockUser, [], true);
            const decoded = jwt.decode(token) as any;

            const expectedDuration = 7 * 24 * 60 * 60; // 7 days in seconds
            const actualDuration = decoded.exp - decoded.iat;

            expect(actualDuration).to.equal(expectedDuration);
        });

        it('includes user identity fields in the token payload', () => {
            const token = createUserToken(mockUser, [], false);
            const decoded = jwt.decode(token) as any;

            expect(decoded.id).to.equal('user-123');
            expect(decoded.userName).to.equal('testuser');
            expect(decoded.email).to.equal('test@example.com');
            expect(decoded.isBlocked).to.equal(false);
        });

        it('maps accepted org memberships into organizations claim', () => {
            const orgs = [
                { organizationId: 'org-1', inviteStatus: 'accepted', isEnabled: true, accessLevels: ['admin'] },
                { organizationId: 'org-2', inviteStatus: 'pending', isEnabled: true, accessLevels: ['member'] },
                { organizationId: 'org-3', inviteStatus: 'accepted', isEnabled: false, accessLevels: ['admin'] },
            ];
            const token = createUserToken(mockUser, orgs, false);
            const decoded = jwt.decode(token) as any;

            // Only org-1 should be included (accepted + enabled)
            expect(decoded.organizations).to.deep.equal({ 'org-1': ['admin'] });
        });

        it('includes a unique jti claim', () => {
            const token1 = createUserToken(mockUser, [], false);
            const token2 = createUserToken(mockUser, [], false);
            const decoded1 = jwt.decode(token1) as any;
            const decoded2 = jwt.decode(token2) as any;

            expect(decoded1.jti).to.be.a('string');
            expect(decoded1.jti).to.not.equal(decoded2.jti);
        });
    });
});
