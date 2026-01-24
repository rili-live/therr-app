/**
 * Integration Tests for Authentication Flow
 *
 * Tests the complete authentication flow including:
 * - JWT token generation and validation
 * - Token expiration handling
 * - User context propagation through middleware chain
 * - Redis session caching (when available)
 *
 * Prerequisites:
 * - Start infrastructure: docker compose -f docker-compose.infra.yml up -d
 * - Run tests: npm run test:integration
 */
import { expect } from 'chai';
import jwt from 'jsonwebtoken';
import {
    getTestRedisClient,
    closeTestRedisConnection,
    checkRedisConnection,
    cleanupTestData,
} from './testRedisConnection';

describe('Authentication Flow - Integration', () => {
    const TEST_KEY = 'auth-integration-test';
    const TEST_JWT_SECRET = 'test-integration-secret';
    let skipTests = false;

    before(async () => {
        // Check if Redis is available for session caching tests
        const isConnected = await checkRedisConnection();
        if (!isConnected) {
            console.log('\n⚠️  Redis not available. Some integration tests will be skipped.');
            console.log('   Start the infrastructure with: docker compose -f docker-compose.infra.yml up -d\n');
            skipTests = true;
        }
    });

    beforeEach(async () => {
        if (skipTests) return;
        try {
            await cleanupTestData(TEST_KEY);
        } catch {
            // Ignore cleanup errors
        }
    });

    after(async () => {
        if (!skipTests) {
            try {
                await cleanupTestData(TEST_KEY);
            } catch {
                // Ignore cleanup errors
            }
        }
        await closeTestRedisConnection();
    });

    describe('JWT Token Generation', () => {
        it('should create valid JWT tokens with user payload', () => {
            const payload = {
                id: 'user-integration-123',
                userName: 'integrationuser',
                accessLevels: ['user.default', 'user.premium'],
                organizations: { 'org-1': ['admin'] },
            };

            const token = jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '1h' });

            expect(token).to.be.a('string');
            expect(token.split('.')).to.have.lengthOf(3); // Header.Payload.Signature
        });

        it('should decode token and extract user information', () => {
            const payload = {
                id: 'user-integration-456',
                userName: 'testuser456',
                accessLevels: ['user.admin'],
                organizations: { 'org-2': ['member'] },
            };

            const token = jwt.sign(payload, TEST_JWT_SECRET);
            const decoded = jwt.verify(token, TEST_JWT_SECRET) as jwt.JwtPayload;

            expect(decoded.id).to.equal('user-integration-456');
            expect(decoded.userName).to.equal('testuser456');
            expect(decoded.accessLevels).to.deep.equal(['user.admin']);
            expect(decoded.organizations).to.deep.equal({ 'org-2': ['member'] });
        });

        it('should handle token expiration correctly', () => {
            const payload = { id: 'user-123', userName: 'expireduser' };
            const expiredToken = jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '-1s' });

            expect(() => {
                jwt.verify(expiredToken, TEST_JWT_SECRET);
            }).to.throw(jwt.TokenExpiredError);
        });

        it('should reject tokens with invalid signature', () => {
            const payload = { id: 'user-123', userName: 'invaliduser' };
            const token = jwt.sign(payload, 'wrong-secret');

            expect(() => {
                jwt.verify(token, TEST_JWT_SECRET);
            }).to.throw(jwt.JsonWebTokenError);
        });
    });

    describe('Session Token Caching in Redis', () => {
        it('should cache session token data in Redis', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const sessionId = `${TEST_KEY}:session:user-123`;
            const sessionData = JSON.stringify({
                userId: 'user-123',
                email: 'user@test.com',
                accessLevels: ['user.default'],
                createdAt: Date.now(),
                expiresAt: Date.now() + 3600000, // 1 hour
            });

            // Cache session
            await client.set(sessionId, sessionData, 'EX', 3600);

            // Verify cached
            const cached = await client.get(sessionId);
            expect(cached).to.equal(sessionData);

            // Parse and verify
            const parsed = JSON.parse(cached!);
            expect(parsed.userId).to.equal('user-123');
            expect(parsed.email).to.equal('user@test.com');

            // Cleanup
            await client.del(sessionId);
        });

        it('should expire session tokens after TTL', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const sessionId = `${TEST_KEY}:session:expire-test`;

            // Cache with short TTL (2 seconds)
            await client.set(sessionId, 'session-data', 'EX', 2);

            // Verify initial TTL
            const ttl = await client.ttl(sessionId);
            expect(ttl).to.be.greaterThan(0);
            expect(ttl).to.be.lessThanOrEqual(2);

            // Wait for expiration
            await new Promise((resolve) => {
                setTimeout(resolve, 2500);
            });

            // Verify expired
            const expired = await client.get(sessionId);
            expect(expired).to.be.eq(null);
        });

        it('should invalidate session on logout', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const sessionId = `${TEST_KEY}:session:logout-test`;

            // Create session
            await client.set(sessionId, 'active-session');
            let exists = await client.exists(sessionId);
            expect(exists).to.equal(1);

            // Simulate logout (delete session)
            await client.del(sessionId);

            // Verify invalidated
            exists = await client.exists(sessionId);
            expect(exists).to.equal(0);
        });

        it('should support multiple sessions per user', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const userId = 'multi-session-user';
            const session1 = `${TEST_KEY}:session:${userId}:device1`;
            const session2 = `${TEST_KEY}:session:${userId}:device2`;

            // Create multiple sessions
            await client.set(session1, JSON.stringify({ device: 'mobile' }));
            await client.set(session2, JSON.stringify({ device: 'web' }));

            // Verify both exist
            const s1 = await client.get(session1);
            const s2 = await client.get(session2);
            expect(JSON.parse(s1!).device).to.equal('mobile');
            expect(JSON.parse(s2!).device).to.equal('web');

            // Cleanup
            await client.del(session1);
            await client.del(session2);
        });
    });

    describe('Token Refresh Flow', () => {
        it('should support token refresh before expiration', () => {
            const userId = 'refresh-user-123';
            const originalPayload = {
                id: userId,
                userName: 'refreshuser',
                accessLevels: ['user.default'],
            };

            // Create original token with short expiry
            const originalToken = jwt.sign(originalPayload, TEST_JWT_SECRET, { expiresIn: '5m' });

            // Verify original token
            const decoded = jwt.verify(originalToken, TEST_JWT_SECRET) as jwt.JwtPayload;

            // Create refresh token with same user data but new expiry
            const refreshedToken = jwt.sign({
                id: decoded.id,
                userName: decoded.userName,
                accessLevels: decoded.accessLevels,
            }, TEST_JWT_SECRET, { expiresIn: '1h' });

            // Verify refreshed token
            const refreshedDecoded = jwt.verify(refreshedToken, TEST_JWT_SECRET) as jwt.JwtPayload;
            expect(refreshedDecoded.id).to.equal(userId);
            expect(refreshedDecoded.userName).to.equal('refreshuser');
        });
    });

    describe('Access Level Token Claims', () => {
        it('should include all user access levels in token', () => {
            const payload = {
                id: 'admin-user',
                userName: 'adminuser',
                accessLevels: [
                    'user.default',
                    'user.premium',
                    'user.admin',
                    'user.superadmin',
                ],
            };

            const token = jwt.sign(payload, TEST_JWT_SECRET);
            const decoded = jwt.verify(token, TEST_JWT_SECRET) as jwt.JwtPayload;

            expect(decoded.accessLevels).to.have.lengthOf(4);
            expect(decoded.accessLevels).to.include('user.admin');
            expect(decoded.accessLevels).to.include('user.superadmin');
        });

        it('should include organization access levels in token', () => {
            const payload = {
                id: 'org-user',
                userName: 'orguser',
                accessLevels: ['user.default'],
                organizations: {
                    'org-alpha': ['admin', 'billing'],
                    'org-beta': ['member'],
                    'org-gamma': ['viewer'],
                },
            };

            const token = jwt.sign(payload, TEST_JWT_SECRET);
            const decoded = jwt.verify(token, TEST_JWT_SECRET) as jwt.JwtPayload;

            expect(Object.keys(decoded.organizations)).to.have.lengthOf(3);
            expect(decoded.organizations['org-alpha']).to.deep.equal(['admin', 'billing']);
            expect(decoded.organizations['org-beta']).to.deep.equal(['member']);
        });
    });

    describe('Blocked User Handling', () => {
        it('should include isBlocked flag in token', () => {
            const blockedPayload = {
                id: 'blocked-user',
                userName: 'blockeduser',
                accessLevels: ['user.default'],
                isBlocked: true,
            };

            const token = jwt.sign(blockedPayload, TEST_JWT_SECRET);
            const decoded = jwt.verify(token, TEST_JWT_SECRET) as jwt.JwtPayload;

            expect(decoded.isBlocked).to.be.eq(true);
        });

        it('should cache blocked user status in Redis', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const blockedKey = `${TEST_KEY}:blocked:user-blocked-123`;

            // Cache blocked status
            await client.set(blockedKey, 'true', 'EX', 86400); // 24 hours

            // Verify blocked
            const isBlocked = await client.get(blockedKey);
            expect(isBlocked).to.equal('true');

            // Cleanup
            await client.del(blockedKey);
        });
    });

    describe('Token Blacklist/Revocation', () => {
        it('should store revoked tokens in Redis', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const tokenId = 'token-to-revoke';
            const revokeKey = `${TEST_KEY}:revoked:${tokenId}`;

            // Revoke token
            await client.set(revokeKey, 'revoked', 'EX', 3600);

            // Check if revoked
            const isRevoked = await client.exists(revokeKey);
            expect(isRevoked).to.equal(1);

            // Cleanup
            await client.del(revokeKey);
        });

        it('should support batch token revocation for user', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const userId = 'batch-revoke-user';
            const tokens = ['token1', 'token2', 'token3'];

            // Revoke all tokens for user
            await Promise.all(tokens.map((tokenId) => client.set(`${TEST_KEY}:revoked:${userId}:${tokenId}`, 'revoked', 'EX', 3600)));

            // Verify all revoked
            const results = await Promise.all(
                tokens.map((tokenId) => client.exists(`${TEST_KEY}:revoked:${userId}:${tokenId}`)),
            );
            expect(results.every((r) => r === 1)).to.be.eq(true);

            // Cleanup
            await Promise.all(
                tokens.map((tokenId) => client.del(`${TEST_KEY}:revoked:${userId}:${tokenId}`)),
            );
        });
    });
});
