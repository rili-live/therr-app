/**
 * Unit tests for the route-ordering assertion.
 *
 * Two halves:
 *   1. The detector itself, against hand-built routers — including the cases it
 *      must NOT flag, since a false positive here crash-loops the gateway.
 *   2. The real gateway router. This is the regression test that matters: it
 *      caught eight shadowed routes when it was written (2026-08-14), and it is
 *      what stops a new `:param` route from silently swallowing a literal one.
 */
import { expect } from 'chai';
import express from 'express';
import {
    collectRoutes,
    findShadowedRoutes,
    assertNoShadowedRoutes,
} from '../../../src/utilities/routeOrdering';

const noop = (req: any, res: any) => res.end();

describe('routeOrdering utility', () => {
    describe('findShadowedRoutes', () => {
        it('flags a literal route registered after a :param sibling', () => {
            const router = express.Router();
            router.put('/users/:id', noop);
            router.put('/users/change-password', noop);

            const shadowed = findShadowedRoutes(collectRoutes(router));

            expect(shadowed).to.have.lengthOf(1);
            expect(shadowed[0]).to.deep.eq({
                method: 'PUT',
                shadowedBy: '/users/:id',
                unreachable: '/users/change-password',
            });
        });

        it('does not flag a literal route registered BEFORE its :param sibling', () => {
            const router = express.Router();
            router.get('/users/me', noop);
            router.get('/users/:id', noop);

            expect(findShadowedRoutes(collectRoutes(router))).to.have.lengthOf(0);
        });

        it('does not flag routes that differ in segment count', () => {
            const router = express.Router();
            router.get('/users/:id', noop);
            router.get('/users/by-phone/:phoneNumber', noop);
            router.get('/users/notifications/:notificationId', noop);

            expect(findShadowedRoutes(collectRoutes(router))).to.have.lengthOf(0);
        });

        it('does not flag same-path routes on different methods', () => {
            const router = express.Router();
            router.get('/users/:id', noop);
            router.post('/users/search', noop);
            router.put('/users/change-password', noop);

            expect(findShadowedRoutes(collectRoutes(router))).to.have.lengthOf(0);
        });

        it('reports each unreachable route once, naming the first route that shadows it', () => {
            const router = express.Router();
            router.get('/social-sync/:userId', noop);
            router.get('/social-sync/:otherId', noop);
            router.get('/social-sync/oauth2-tiktok', noop);

            const shadowed = findShadowedRoutes(collectRoutes(router));

            // /:otherId is itself shadowed by /:userId, and oauth2-tiktok by both --
            // but each is listed once, against the earliest route that claims it.
            expect(shadowed).to.have.lengthOf(2);
            expect(shadowed.map((entry) => entry.unreachable)).to.deep.eq([
                '/social-sync/:otherId',
                '/social-sync/oauth2-tiktok',
            ]);
            expect(shadowed.every((entry) => entry.shadowedBy === '/social-sync/:userId')).to.eq(true);
        });

        it('treats a trailing wildcard as matching the rest of the path', () => {
            const router = express.Router();
            router.get('/place/*', noop);
            router.get('/place/details/nearby', noop);

            expect(findShadowedRoutes(collectRoutes(router))).to.have.lengthOf(1);
        });
    });

    describe('collectRoutes', () => {
        it('walks mounted sub-routers and prefixes their paths', () => {
            const sub = express.Router();
            sub.get('/categories', noop);

            const router = express.Router();
            router.use('/messages-service/forums', sub);

            expect(collectRoutes(router)).to.deep.eq([
                { method: 'get', path: '/messages-service/forums/categories' },
            ]);
        });

        it('detects shadowing across a mount boundary', () => {
            const forums = express.Router();
            forums.get('/:forumId', noop);

            const categories = express.Router();
            categories.get('/', noop);

            const router = express.Router();
            router.use('/forums', forums);
            router.use('/forums/categories', categories);

            const shadowed = findShadowedRoutes(collectRoutes(router));

            expect(shadowed).to.have.lengthOf(1);
            expect(shadowed[0].unreachable).to.eq('/forums/categories');
        });

        it('preserves registration order across nesting', () => {
            const sub = express.Router();
            sub.get('/b', noop);

            const router = express.Router();
            router.get('/a', noop);
            router.use('/nested', sub);
            router.get('/c', noop);

            expect(collectRoutes(router).map((route) => route.path)).to.deep.eq(['/a', '/nested/b', '/c']);
        });
    });

    describe('the real gateway router', () => {
        let gatewayRouter: any;

        // Required lazily: the service routers read config and construct
        // limiters at module load, so importing them is a side effect that
        // should not run for the pure tests above.
        //
        // In a hook, with its own budget, because the first require in the run
        // compiles the whole route tree through ts-node and mocha charges that
        // to the test that triggers it -- past the 2s default in CI. Today this
        // file runs after tests/unit/routes/validationWiring.test.ts and hits a
        // warm require cache; that ordering is not something to depend on.
        before(function loadGatewayRouter(this: Mocha.Context) {
            this.timeout(30000);
            // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
            gatewayRouter = require('../../../src/routes').default;
        });

        // The gateway names every route it proxies and has no wildcard, so a
        // users-service route with no entry here 404s at the edge while the
        // service, the shared client and their tests are all green. That is how
        // `GET /habits/checkins/:id/proofs` shipped unreachable: the handler,
        // the router entry, the therr-react service method and the redux action
        // all existed, and nothing that ran could see the missing hop.
        it('proxies every habits check-in route the shared client calls', () => {
            const paths = collectRoutes(gatewayRouter)
                .filter((route) => route.method === 'get')
                .map((route) => route.path);

            expect(paths).to.include('/users-service/habits/checkins/:id/proofs');
            expect(paths).to.include('/users-service/habits/checkins/:id');
        });

        it('exposes no unreachable routes', () => {
            const routes = collectRoutes(gatewayRouter);

            // Guards against the check silently passing because it collected nothing.
            expect(routes.length).to.be.greaterThan(100);

            expect(() => assertNoShadowedRoutes(gatewayRouter)).to.not.throw();
        });
    });
});
