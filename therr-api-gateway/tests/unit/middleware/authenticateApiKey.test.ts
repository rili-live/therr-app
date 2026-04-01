/**
 * Unit Tests for authenticateApiKey middleware
 *
 * Tests API key format validation, prefix parsing, cache/service validation flow,
 * and request context population.
 *
 * Note: parseApiKeyPrefix and validateApiKeyWithService are exported for testability.
 * The axios call to users-service is tested indirectly via the middleware behavior
 * with cache stubs (cache hit path), and format validation is tested directly.
 */
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as redisClient from '../../../src/store/redisClient';

describe('authenticateApiKey middleware', () => {
    let sandbox: sinon.SinonSandbox;

    // We must set NODE_ENV before importing the middleware so globalConfig resolves
    let parseApiKeyPrefix: (rawKey: string) => string | null;
    let authenticateApiKey: any;

    const validApiKey = 'therr_sk_a1b2c3d4_dGhpcyBpcyBhIHRlc3Qga2V5IHdpdGggMzIgYnl0ZXM';
    const validKeyPrefix = 'a1b2c3d4';

    const validContext: redisClient.ICachedApiKeyContext = {
        userId: 'user-123',
        userName: 'testuser',
        accessLevels: ['user.default'],
        organizations: { 'org-1': ['admin'] },
        keyPrefix: validKeyPrefix,
    };

    before(() => {
        process.env.NODE_ENV = 'development';
        const mod = require('../../../src/middleware/authenticateApiKey'); // eslint-disable-line @typescript-eslint/no-var-requires, global-require
        parseApiKeyPrefix = mod.parseApiKeyPrefix;
        authenticateApiKey = mod.default;
    });

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('parseApiKeyPrefix', () => {
        it('should extract 8-char hex prefix from valid key', () => {
            const result = parseApiKeyPrefix(validApiKey);
            expect(result).to.equal('a1b2c3d4');
        });

        it('should return null for empty string', () => {
            expect(parseApiKeyPrefix('')).to.be.eq(null);
        });

        it('should return null for null/undefined input', () => {
            expect(parseApiKeyPrefix(null as any)).to.be.eq(null);
            expect(parseApiKeyPrefix(undefined as any)).to.be.eq(null);
        });

        it('should return null for keys without therr_sk_ prefix', () => {
            expect(parseApiKeyPrefix('invalid_a1b2c3d4_someRandomData')).to.be.eq(null);
        });

        it('should return null for keys with wrong prefix', () => {
            expect(parseApiKeyPrefix('therr_pk_a1b2c3d4_someRandomData')).to.be.eq(null);
        });

        it('should return null for keys with non-hex prefix characters', () => {
            expect(parseApiKeyPrefix('therr_sk_ZZZZZZZZ_someRandomData')).to.be.eq(null);
        });

        it('should return null for keys with uppercase hex in prefix', () => {
            expect(parseApiKeyPrefix('therr_sk_A1B2C3D4_someRandomData')).to.be.eq(null);
        });

        it('should return null for keys with prefix shorter than 8 chars', () => {
            expect(parseApiKeyPrefix('therr_sk_a1b2c3_someRandomData')).to.be.eq(null);
        });

        it('should return null for keys with prefix longer than 8 chars', () => {
            expect(parseApiKeyPrefix('therr_sk_a1b2c3d4e5_someRandomData')).to.be.eq(null);
        });

        it('should return null for keys without underscore after prefix', () => {
            // After therr_sk_ there are 8 hex chars but no underscore at position 8
            expect(parseApiKeyPrefix('therr_sk_a1b2c3d4someRandomData')).to.be.eq(null);
        });

        it('should return null for keys that are just the prefix', () => {
            expect(parseApiKeyPrefix('therr_sk_')).to.be.eq(null);
        });

        it('should accept valid hex characters 0-9 and a-f', () => {
            expect(parseApiKeyPrefix('therr_sk_01234567_rest')).to.equal('01234567');
            expect(parseApiKeyPrefix('therr_sk_89abcdef_rest')).to.equal('89abcdef');
        });
    });

    describe('authenticateApiKey middleware - missing key', () => {
        it('should return 401 when x-api-key header is missing', async () => {
            const req: any = { headers: {} };
            const res: any = { status: sandbox.stub().returnsThis(), send: sandbox.stub().returnsThis() };
            const next = sandbox.spy();

            await authenticateApiKey(req, res, next);

            expect(res.status.calledWith(401)).to.be.eq(true);
            expect(next.called).to.be.eq(false);
        });

        it('should return 401 when x-api-key header is empty string', async () => {
            const req: any = { headers: { 'x-api-key': '' } };
            const res: any = { status: sandbox.stub().returnsThis(), send: sandbox.stub().returnsThis() };
            const next = sandbox.spy();

            await authenticateApiKey(req, res, next);

            expect(res.status.calledWith(401)).to.be.eq(true);
            expect(next.called).to.be.eq(false);
        });

        it('should include descriptive error message for missing key', async () => {
            const req: any = { headers: {} };
            const res: any = { status: sandbox.stub().returnsThis(), send: sandbox.stub().returnsThis() };
            const next = sandbox.spy();

            await authenticateApiKey(req, res, next);

            const body = res.send.firstCall.args[0];
            expect(body.message).to.include('API key');
        });
    });

    describe('authenticateApiKey middleware - invalid format', () => {
        it('should return 401 for keys with invalid prefix format', async () => {
            const req: any = { headers: { 'x-api-key': 'bad_key_format' } };
            const res: any = { status: sandbox.stub().returnsThis(), send: sandbox.stub().returnsThis() };
            const next = sandbox.spy();

            await authenticateApiKey(req, res, next);

            expect(res.status.calledWith(401)).to.be.eq(true);
            expect(next.called).to.be.eq(false);
        });

        it('should return 401 for keys with uppercase hex prefix', async () => {
            const req: any = { headers: { 'x-api-key': 'therr_sk_AABBCCDD_somedata' } };
            const res: any = { status: sandbox.stub().returnsThis(), send: sandbox.stub().returnsThis() };
            const next = sandbox.spy();

            await authenticateApiKey(req, res, next);

            expect(res.status.calledWith(401)).to.be.eq(true);
        });
    });

    describe('authenticateApiKey middleware - cache hit flow', () => {
        let getCachedStub: sinon.SinonStub;

        beforeEach(() => {
            getCachedStub = sandbox.stub(redisClient, 'getCachedApiKeyContext');
        });

        it('should call next on valid cached context', async () => {
            getCachedStub.resolves(validContext);
            const req: any = { headers: { 'x-api-key': validApiKey } };
            const res: any = { status: sandbox.stub().returnsThis(), send: sandbox.stub().returnsThis() };
            const next = sandbox.spy();

            await authenticateApiKey(req, res, next);

            expect(next.calledOnce).to.be.eq(true);
            expect(res.status.called).to.be.eq(false);
        });

        it('should populate x-userid from cached context', async () => {
            getCachedStub.resolves(validContext);
            const req: any = { headers: { 'x-api-key': validApiKey } };
            const res: any = { status: sandbox.stub().returnsThis(), send: sandbox.stub().returnsThis() };
            const next = sandbox.spy();

            await authenticateApiKey(req, res, next);

            expect(req['x-userid']).to.equal('user-123');
        });

        it('should populate x-username from cached context', async () => {
            getCachedStub.resolves(validContext);
            const req: any = { headers: { 'x-api-key': validApiKey } };
            const res: any = { status: sandbox.stub().returnsThis(), send: sandbox.stub().returnsThis() };
            const next = sandbox.spy();

            await authenticateApiKey(req, res, next);

            expect(req['x-username']).to.equal('testuser');
        });

        it('should set x-auth-type to api-key', async () => {
            getCachedStub.resolves(validContext);
            const req: any = { headers: { 'x-api-key': validApiKey } };
            const res: any = { status: sandbox.stub().returnsThis(), send: sandbox.stub().returnsThis() };
            const next = sandbox.spy();

            await authenticateApiKey(req, res, next);

            expect(req['x-auth-type']).to.equal('api-key');
        });

        it('should set x-api-key-prefix from cached context', async () => {
            getCachedStub.resolves(validContext);
            const req: any = { headers: { 'x-api-key': validApiKey } };
            const res: any = { status: sandbox.stub().returnsThis(), send: sandbox.stub().returnsThis() };
            const next = sandbox.spy();

            await authenticateApiKey(req, res, next);

            expect(req['x-api-key-prefix']).to.equal(validKeyPrefix);
        });

        it('should JSON-stringify access levels for header propagation', async () => {
            getCachedStub.resolves({
                ...validContext,
                accessLevels: ['user.default', 'user.premium', 'dashboard.basic'],
            });
            const req: any = { headers: { 'x-api-key': validApiKey } };
            const res: any = { status: sandbox.stub().returnsThis(), send: sandbox.stub().returnsThis() };
            const next = sandbox.spy();

            await authenticateApiKey(req, res, next);

            const parsed = JSON.parse(req['x-user-access-levels']);
            expect(parsed).to.deep.equal(['user.default', 'user.premium', 'dashboard.basic']);
        });

        it('should JSON-stringify organizations for header propagation', async () => {
            getCachedStub.resolves({
                ...validContext,
                organizations: { 'org-1': ['admin'], 'org-2': ['member', 'editor'] },
            });
            const req: any = { headers: { 'x-api-key': validApiKey } };
            const res: any = { status: sandbox.stub().returnsThis(), send: sandbox.stub().returnsThis() };
            const next = sandbox.spy();

            await authenticateApiKey(req, res, next);

            const parsed = JSON.parse(req['x-organizations']);
            expect(parsed).to.deep.equal({ 'org-1': ['admin'], 'org-2': ['member', 'editor'] });
        });

        it('should handle empty organizations', async () => {
            getCachedStub.resolves({
                ...validContext,
                organizations: {},
            });
            const req: any = { headers: { 'x-api-key': validApiKey } };
            const res: any = { status: sandbox.stub().returnsThis(), send: sandbox.stub().returnsThis() };
            const next = sandbox.spy();

            await authenticateApiKey(req, res, next);

            expect(JSON.parse(req['x-organizations'])).to.deep.equal({});
        });

        it('should handle empty access levels', async () => {
            getCachedStub.resolves({
                ...validContext,
                accessLevels: [],
            });
            const req: any = { headers: { 'x-api-key': validApiKey } };
            const res: any = { status: sandbox.stub().returnsThis(), send: sandbox.stub().returnsThis() };
            const next = sandbox.spy();

            await authenticateApiKey(req, res, next);

            expect(JSON.parse(req['x-user-access-levels'])).to.deep.equal([]);
        });
    });

    describe('authenticateApiKey middleware - cache miss, service error', () => {
        beforeEach(() => {
            sandbox.stub(redisClient, 'getCachedApiKeyContext').resolves(null);
            sandbox.stub(redisClient, 'cacheApiKeyContext').resolves();
        });

        it('should return 503 when users-service is unreachable (no cache)', async () => {
            // With no cache and service down (globalConfig points to unreachable host in test),
            // the middleware should return 503 for service errors
            const req: any = { headers: { 'x-api-key': validApiKey } };
            const res: any = { status: sandbox.stub().returnsThis(), send: sandbox.stub().returnsThis() };
            const next = sandbox.spy();

            await authenticateApiKey(req, res, next);

            // Service call will fail (no actual service running) → should be 503
            expect(res.status.calledWith(503)).to.be.eq(true);
            expect(next.called).to.be.eq(false);
        });

        it('should include retry message for service errors', async () => {
            const req: any = { headers: { 'x-api-key': validApiKey } };
            const res: any = { status: sandbox.stub().returnsThis(), send: sandbox.stub().returnsThis() };
            const next = sandbox.spy();

            await authenticateApiKey(req, res, next);

            const body = res.send.firstCall.args[0];
            expect(body.message).to.include('try again');
        });

        it('should not call next on service error', async () => {
            const req: any = { headers: { 'x-api-key': validApiKey } };
            const res: any = { status: sandbox.stub().returnsThis(), send: sandbox.stub().returnsThis() };
            const next = sandbox.spy();

            await authenticateApiKey(req, res, next);

            expect(next.called).to.be.eq(false);
        });
    });
});
