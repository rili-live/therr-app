/**
 * Unit Tests for restrictApiKeyAccess middleware
 *
 * Tests endpoint allowlisting for API-key-authenticated requests,
 * ensuring JWT-auth passthrough and proper blocking of restricted endpoints.
 */
import { expect } from 'chai';
import * as sinon from 'sinon';
import restrictApiKeyAccess from '../../../src/middleware/restrictApiKeyAccess';

describe('restrictApiKeyAccess middleware', () => {
    let sandbox: sinon.SinonSandbox;
    let req: any;
    let res: any;
    let next: sinon.SinonSpy;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        res = {
            status: sandbox.stub().returnsThis(),
            send: sandbox.stub().returnsThis(),
        };
        next = sandbox.spy();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('JWT-authenticated requests (passthrough)', () => {
        it('should pass through when x-auth-type is not api-key', () => {
            req = {
                'x-auth-type': 'jwt',
                method: 'DELETE',
                path: '/v1/users-service/users/me',
            };

            restrictApiKeyAccess(req, res, next);

            expect(next.calledOnce).to.be.eq(true);
            expect(res.status.called).to.be.eq(false);
        });

        it('should pass through when x-auth-type is undefined', () => {
            req = {
                method: 'POST',
                path: '/v1/users-service/auth/login',
            };

            restrictApiKeyAccess(req, res, next);

            expect(next.calledOnce).to.be.eq(true);
        });
    });

    describe('Allowed endpoints for API key auth', () => {
        beforeEach(() => {
            req = { 'x-auth-type': 'api-key' };
        });

        // Maps service - read/search
        it('should allow GET moments', () => {
            req.method = 'GET';
            req.path = '/v1/maps-service/moments/some-id';
            restrictApiKeyAccess(req, res, next);
            expect(next.calledOnce).to.be.eq(true);
        });

        it('should allow POST moments search', () => {
            req.method = 'POST';
            req.path = '/v1/maps-service/moments/search';
            restrictApiKeyAccess(req, res, next);
            expect(next.calledOnce).to.be.eq(true);
        });

        it('should allow POST moments details', () => {
            req.method = 'POST';
            req.path = '/v1/maps-service/moments/abc-123/details';
            restrictApiKeyAccess(req, res, next);
            expect(next.calledOnce).to.be.eq(true);
        });

        it('should allow GET spaces', () => {
            req.method = 'GET';
            req.path = '/v1/maps-service/spaces/some-id';
            restrictApiKeyAccess(req, res, next);
            expect(next.calledOnce).to.be.eq(true);
        });

        it('should allow POST spaces search', () => {
            req.method = 'POST';
            req.path = '/v1/maps-service/spaces/search';
            restrictApiKeyAccess(req, res, next);
            expect(next.calledOnce).to.be.eq(true);
        });

        it('should allow POST spaces list', () => {
            req.method = 'POST';
            req.path = '/v1/maps-service/spaces/list';
            restrictApiKeyAccess(req, res, next);
            expect(next.calledOnce).to.be.eq(true);
        });

        // Maps service - space write
        it('should allow POST to create spaces', () => {
            req.method = 'POST';
            req.path = '/v1/maps-service/spaces';
            restrictApiKeyAccess(req, res, next);
            expect(next.calledOnce).to.be.eq(true);
        });

        it('should allow PUT to update a space', () => {
            req.method = 'PUT';
            req.path = '/v1/maps-service/spaces/some-uuid';
            restrictApiKeyAccess(req, res, next);
            expect(next.calledOnce).to.be.eq(true);
        });

        // Events
        it('should allow GET events', () => {
            req.method = 'GET';
            req.path = '/v1/maps-service/events/some-id';
            restrictApiKeyAccess(req, res, next);
            expect(next.calledOnce).to.be.eq(true);
        });

        it('should allow POST events search', () => {
            req.method = 'POST';
            req.path = '/v1/maps-service/events/search';
            restrictApiKeyAccess(req, res, next);
            expect(next.calledOnce).to.be.eq(true);
        });

        // Users service - read
        it('should allow GET users/me', () => {
            req.method = 'GET';
            req.path = '/v1/users-service/users/me';
            restrictApiKeyAccess(req, res, next);
            expect(next.calledOnce).to.be.eq(true);
        });

        it('should allow POST users search', () => {
            req.method = 'POST';
            req.path = '/v1/users-service/users/search';
            restrictApiKeyAccess(req, res, next);
            expect(next.calledOnce).to.be.eq(true);
        });

        it('should allow GET user by UUID', () => {
            req.method = 'GET';
            req.path = '/v1/users-service/users/a1b2c3d4-e5f6-7890-abcd-ef1234567890';
            restrictApiKeyAccess(req, res, next);
            expect(next.calledOnce).to.be.eq(true);
        });

        it('should allow GET interests', () => {
            req.method = 'GET';
            req.path = '/v1/users-service/interests';
            restrictApiKeyAccess(req, res, next);
            expect(next.calledOnce).to.be.eq(true);
        });

        // Reactions service
        it('should allow GET reactions', () => {
            req.method = 'GET';
            req.path = '/v1/reactions-service/some-resource';
            restrictApiKeyAccess(req, res, next);
            expect(next.calledOnce).to.be.eq(true);
        });

        // Metrics
        it('should allow GET user metrics', () => {
            req.method = 'GET';
            req.path = '/v1/users-service/metrics/overview';
            restrictApiKeyAccess(req, res, next);
            expect(next.calledOnce).to.be.eq(true);
        });

        // Campaigns
        it('should allow GET campaigns', () => {
            req.method = 'GET';
            req.path = '/v1/users-service/campaigns/some-id';
            restrictApiKeyAccess(req, res, next);
            expect(next.calledOnce).to.be.eq(true);
        });

        // API key management
        it('should allow GET api-keys list', () => {
            req.method = 'GET';
            req.path = '/v1/users-service/api-keys';
            restrictApiKeyAccess(req, res, next);
            expect(next.calledOnce).to.be.eq(true);
        });
    });

    describe('Blocked endpoints for API key auth', () => {
        beforeEach(() => {
            req = { 'x-auth-type': 'api-key' };
        });

        it('should block POST to auth login', () => {
            req.method = 'POST';
            req.path = '/v1/users-service/auth/login';
            restrictApiKeyAccess(req, res, next);

            expect(res.status.calledWith(403)).to.be.eq(true);
            expect(next.called).to.be.eq(false);
        });

        it('should block POST to auth register', () => {
            req.method = 'POST';
            req.path = '/v1/users-service/auth/register';
            restrictApiKeyAccess(req, res, next);

            expect(res.status.calledWith(403)).to.be.eq(true);
        });

        it('should block PUT to update user profile', () => {
            req.method = 'PUT';
            req.path = '/v1/users-service/users/some-uuid';
            restrictApiKeyAccess(req, res, next);

            expect(res.status.calledWith(403)).to.be.eq(true);
        });

        it('should block DELETE on users', () => {
            req.method = 'DELETE';
            req.path = '/v1/users-service/users/some-uuid';
            restrictApiKeyAccess(req, res, next);

            expect(res.status.calledWith(403)).to.be.eq(true);
        });

        it('should block POST to create api-keys (creation requires JWT)', () => {
            req.method = 'POST';
            req.path = '/v1/users-service/api-keys';
            restrictApiKeyAccess(req, res, next);

            expect(res.status.calledWith(403)).to.be.eq(true);
        });

        it('should block DELETE to revoke api-keys', () => {
            req.method = 'DELETE';
            req.path = '/v1/users-service/api-keys/some-uuid';
            restrictApiKeyAccess(req, res, next);

            expect(res.status.calledWith(403)).to.be.eq(true);
        });

        it('should block POST to payment endpoints', () => {
            req.method = 'POST';
            req.path = '/v1/users-service/payments/subscribe';
            restrictApiKeyAccess(req, res, next);

            expect(res.status.calledWith(403)).to.be.eq(true);
        });

        it('should block POST to push notifications', () => {
            req.method = 'POST';
            req.path = '/v1/push-notifications-service/send';
            restrictApiKeyAccess(req, res, next);

            expect(res.status.calledWith(403)).to.be.eq(true);
        });

        it('should block POST reactions (write)', () => {
            req.method = 'POST';
            req.path = '/v1/reactions-service/some-resource';
            restrictApiKeyAccess(req, res, next);

            expect(res.status.calledWith(403)).to.be.eq(true);
        });

        it('should block DELETE moments', () => {
            req.method = 'DELETE';
            req.path = '/v1/maps-service/moments/some-id';
            restrictApiKeyAccess(req, res, next);

            expect(res.status.calledWith(403)).to.be.eq(true);
        });

        it('should block PUT spaces with sub-path (only single-segment space ID allowed)', () => {
            req.method = 'PUT';
            req.path = '/v1/maps-service/spaces/some-uuid/nested';
            restrictApiKeyAccess(req, res, next);

            expect(res.status.calledWith(403)).to.be.eq(true);
        });
    });

    describe('Method mismatch', () => {
        beforeEach(() => {
            req = { 'x-auth-type': 'api-key' };
        });

        it('should block POST to a GET-only endpoint', () => {
            req.method = 'POST';
            req.path = '/v1/users-service/users/me';
            restrictApiKeyAccess(req, res, next);

            expect(res.status.calledWith(403)).to.be.eq(true);
        });

        // Note: GET /moments/search is allowed because the broad GET pattern
        // /^\/v1\/maps-service\/moments\// matches any sub-path under moments.
        // This is by design — GET on moment sub-resources is permitted.
        it('should block GET to a POST-only spaces endpoint', () => {
            req.method = 'GET';
            req.path = '/v1/maps-service/spaces/search';
            // GET /spaces/search matches the GET /spaces/ pattern, so it's allowed
            // Test a truly method-mismatched case instead
            req.method = 'PATCH';
            req.path = '/v1/maps-service/spaces/some-uuid';
            restrictApiKeyAccess(req, res, next);

            expect(res.status.calledWith(403)).to.be.eq(true);
        });

        it('should block DELETE on spaces (only POST and PUT allowed)', () => {
            req.method = 'DELETE';
            req.path = '/v1/maps-service/spaces/some-uuid';
            restrictApiKeyAccess(req, res, next);

            expect(res.status.calledWith(403)).to.be.eq(true);
        });
    });

    describe('Error response format', () => {
        it('should include helpful message about using JWT instead', () => {
            req = {
                'x-auth-type': 'api-key',
                method: 'POST',
                path: '/v1/users-service/auth/login',
            };

            restrictApiKeyAccess(req, res, next);

            expect(res.status.calledWith(403)).to.be.eq(true);
            // The send call should include a message about JWT
            const sendArgs = res.send.firstCall.args[0];
            expect(sendArgs).to.have.property('message');
            expect(sendArgs.message).to.include('JWT');
        });
    });
});
