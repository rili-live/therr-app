import { expect } from 'chai';
import unless from 'express-unless';
import unauthenticatedPaths, { isUnauthenticatedPath } from '../../../src/config/unauthenticatedPaths';

/**
 * These guard a failure mode that already shipped once.
 *
 * `express-unless` matches each entry with a bare `RegExp.exec()`, so an unanchored
 * pattern swallows every sub-path beneath it. When that happens the route does not
 * become "public" — `authenticate` never populates `x-user-access-levels`, so a
 * downstream `authorize()` sees an empty list and returns 403 "Invalid Access
 * Levels" to everyone, SUPER_ADMIN included.
 *
 * `GET /users/:id/push-diagnostics` was unreachable for exactly this reason.
 */
describe('unauthenticatedPaths', () => {
    const USER_ID = '568bf5d2-8595-4fd6-95da-32cc318618d3';

    describe('public profile by id', () => {
        it('skips auth for the profile route itself', () => {
            expect(isUnauthenticatedPath(`/v1/users-service/users/${USER_ID}`, 'GET')).to.equal(true);
        });

        it('skips auth with a trailing slash', () => {
            expect(isUnauthenticatedPath(`/v1/users-service/users/${USER_ID}/`, 'GET')).to.equal(true);
        });

        it('does NOT skip auth for sub-paths under /users/:id', () => {
            expect(isUnauthenticatedPath(`/v1/users-service/users/${USER_ID}/push-diagnostics`, 'GET')).to.equal(false);
            expect(isUnauthenticatedPath(`/v1/users-service/users/${USER_ID}/anything-else`, 'GET')).to.equal(false);
        });

        it('does not skip auth for non-GET methods', () => {
            expect(isUnauthenticatedPath(`/v1/users-service/users/${USER_ID}`, 'POST')).to.equal(false);
            expect(isUnauthenticatedPath(`/v1/users-service/users/${USER_ID}`, 'DELETE')).to.equal(false);
        });
    });

    describe('SUPER_ADMIN diagnostics endpoints stay authenticated', () => {
        it('requires auth for the users-service push diagnostics', () => {
            expect(isUnauthenticatedPath(`/v1/users-service/users/${USER_ID}/push-diagnostics`, 'GET')).to.equal(false);
            expect(isUnauthenticatedPath(`/v1/users-service/users/${USER_ID}/push-diagnostics/send-test`, 'POST')).to.equal(false);
        });

        it('requires auth for the push-notifications-service diagnostics', () => {
            expect(isUnauthenticatedPath('/v1/push-notifications-service/notifications/diagnostics', 'GET')).to.equal(false);
            expect(isUnauthenticatedPath('/v1/push-notifications-service/notifications/diagnostics/send-test', 'POST')).to.equal(false);
        });
    });

    describe('genuinely public routes still skip auth', () => {
        const cases: Array<[string, string]> = [
            ['/healthcheck', 'GET'],
            ['/v1/users-service/auth', 'POST'],
            ['/v1/users-service/users', 'POST'],
            ['/v1/users-service/auth/token/refresh', 'POST'],
            ['/v1/users-service/users/forgot-password', 'POST'],
            [`/v1/users-service/users/achievements/${USER_ID}/public`, 'GET'],
            [`/v1/users-service/users/invites/${USER_ID}`, 'GET'],
            ['/v1/users-service/users/by-username/zack', 'GET'],
            ['/v1/phone/auth/start', 'POST'],
            ['/v1/user-files/some/image.png', 'GET'],
            ['/v1/maps-service/geocode', 'GET'],
            ['/v1/messages-service/forums/search', 'POST'],
        ];

        cases.forEach(([pathname, method]) => {
            it(`skips auth for ${method} ${pathname}`, () => {
                expect(isUnauthenticatedPath(pathname, method)).to.equal(true);
            });
        });
    });

    /**
     * Regression: both routes were added without a matching exemption here, so every
     * anonymous caller got a 401 from `authenticate`. The dashboard's 401 interceptor turns
     * that into `logout()` + `navigate('/login')`, which bounced a buyer returning from
     * Stripe off /payment-complete/:sessionId before the GA4 `purchase` event could fire —
     * the one conversion event the whole Checkout Sessions change exists to produce.
     */
    describe('Stripe checkout is reachable without a session (buy-then-register)', () => {
        const SESSION_ID = 'cs_test_a1b2C3d4E5f6G7h8I9j0';

        it('skips auth for starting a checkout session', () => {
            expect(isUnauthenticatedPath('/v1/users-service/payments/checkout/sessions', 'POST')).to.equal(true);
        });

        it('skips auth for activating a completed checkout session', () => {
            expect(isUnauthenticatedPath(`/v1/users-service/payments/checkout/sessions/${SESSION_ID}`, 'POST')).to.equal(true);
        });

        it('does NOT skip auth for sub-paths under a session id', () => {
            expect(isUnauthenticatedPath(`/v1/users-service/payments/checkout/sessions/${SESSION_ID}/refund`, 'POST')).to.equal(false);
        });

        it('does not skip auth for other methods, or for the customer portal', () => {
            expect(isUnauthenticatedPath('/v1/users-service/payments/checkout/sessions', 'GET')).to.equal(false);
            expect(isUnauthenticatedPath(`/v1/users-service/payments/checkout/sessions/${SESSION_ID}`, 'DELETE')).to.equal(false);
            // The portal acts on the caller's own subscription and has no billing-email gate.
            expect(isUnauthenticatedPath('/v1/users-service/payments/customer-portal/sessions', 'POST')).to.equal(false);
        });
    });

    describe('list hygiene', () => {
        it('anchors every regex that targets a specific resource under /users/:id', () => {
            // A pattern matching a bare user id must not also match a longer path.
            const offenders = unauthenticatedPaths
                .filter((p) => p.url instanceof RegExp)
                .filter((p) => {
                    const re = p.url as RegExp;
                    re.lastIndex = 0;
                    const matchesBare = re.test(`/v1/users-service/users/${USER_ID}`);
                    re.lastIndex = 0;
                    const matchesDeeper = re.test(`/v1/users-service/users/${USER_ID}/sub-resource`);
                    return matchesBare && matchesDeeper;
                });

            expect(offenders, `unanchored: ${offenders.map((o) => String(o.url)).join(', ')}`).to.have.lengthOf(0);
        });
    });

    /**
     * The drift guardrail.
     *
     * Every assertion above this point is made against `isUnauthenticatedPath`, which
     * is a *reimplementation* of how `express-unless` matches — production never calls
     * it. So on its own this file proves the list is correct about a function nothing
     * runs, and a change in `express-unless` (a patch release inside the `^0.5.0`
     * range, or the 2.x rewrite) would leave every test green while the gateway
     * quietly authenticates a different set of routes.
     *
     * These tests close that gap by driving the REAL middleware over the REAL list and
     * asserting the two agree everywhere. Anything that changes the dependency's
     * matching semantics fails here, in a test that names the divergent path.
     */
    describe('agrees with the real express-unless (drift guardrail)', () => {
        /** Returns true when `authenticate` would be SKIPPED, per the actual dependency. */
        const realUnlessSkips = (pathname: string, method: string): boolean => {
            let authRan = false;
            const inner: any = (req: any, res: any, next: any) => {
                authRan = true;
                next();
            };
            inner.unless = unless;
            const wrapped = inner.unless({ path: unauthenticatedPaths });
            wrapped({ originalUrl: pathname, url: pathname, method }, {}, () => undefined);
            return !authRan;
        };

        // Derived from the list itself, so it keeps covering entries added later:
        // the exact path (skips), a sub-path (must not), and the wrong method.
        const derivedCases: Array<[string, string]> = [];
        unauthenticatedPaths.forEach((p) => {
            if (typeof p.url !== 'string') {
                return;
            }
            p.methods.forEach((method) => {
                derivedCases.push([p.url as string, method]);
                derivedCases.push([`${p.url}/sub-resource`, method]);
                derivedCases.push([p.url as string, method === 'GET' ? 'POST' : 'GET']);
            });
        });

        // The regex entries, which is where the semantics actually bite.
        const regexCases: Array<[string, string]> = [
            [`/v1/users-service/users/${USER_ID}`, 'GET'],
            [`/v1/users-service/users/${USER_ID}/`, 'GET'],
            [`/v1/users-service/users/${USER_ID}/push-diagnostics`, 'GET'],
            [`/v1/users-service/users/${USER_ID}/anything-else`, 'GET'],
            [`/v1/users-service/users/${USER_ID}`, 'POST'],
            [`/v1/users-service/users/achievements/${USER_ID}/public`, 'GET'],
            [`/v1/users-service/users/achievements/${USER_ID}/public/extra`, 'GET'],
            [`/v1/users-service/users/invites/${USER_ID}`, 'GET'],
            ['/v1/users-service/users/verify/some-token', 'POST'],
            ['/v1/users-service/users/by-username/zack', 'GET'],
            ['/v1/users-service/users/me', 'GET'],
            ['/v1/user-files/nested/dir/image.png', 'GET'],
            ['/v1/maps-service/place/details', 'GET'],
            ['/v1/maps-service/moments/abc/details', 'POST'],
            ['/v1/maps-service/spaces/abc/details', 'POST'],
            ['/v1/maps-service/events/abc/details', 'POST'],
            ['/v1/maps-service/events/search', 'POST'],
            ['/v1/maps-service/spaces/abc/pairings', 'GET'],
            ['/v1/maps-service/spaces/abc/pairings/feedback', 'POST'],
            ['/v1/maps-service/spaces/abc/corrections', 'POST'],
            ['/v1/maps-service/cities/austin/pulse', 'GET'],
            ['/v1/users-service/payments/checkout/sessions/cs_test_a1b2C3d4E5f6G7h8I9j0', 'POST'],
            ['/v1/users-service/payments/checkout/sessions/cs_test_a1b2C3d4E5f6G7h8I9j0/refund', 'POST'],
            ['/v1/users-service/payments/customer-portal/sessions', 'POST'],
            ['/v1/messages-service/forums/abc-123', 'GET'],
            ['/v1/reactions-service/user-lists/public/abc-123/my-list', 'GET'],
            ['/v1/habits/pacts', 'GET'],
            ['/v1/users-service/users/connections', 'GET'],
        ];

        const allCases = derivedCases.concat(regexCases);

        it('proves the harness is live before trusting it to agree', () => {
            // Without this, a dependency that stopped skipping anything (or started
            // skipping everything) could still be "agreed with" by a mirror that broke
            // the same way — or the assertions below could pass over an empty set.
            expect(allCases.length).to.be.greaterThan(20);
            expect(realUnlessSkips('/healthcheck', 'GET'), 'a public route must skip').to.equal(true);
            expect(
                realUnlessSkips(`/v1/users-service/users/${USER_ID}/push-diagnostics`, 'GET'),
                'a protected route must NOT skip',
            ).to.equal(false);
        });

        it('matches isUnauthenticatedPath on every case, for every entry in the list', () => {
            const divergences = allCases
                .filter(([pathname, method]) => realUnlessSkips(pathname, method) !== isUnauthenticatedPath(pathname, method))
                .map(([pathname, method]) => `${method} ${pathname}`);

            expect(
                divergences,
                `isUnauthenticatedPath no longer mirrors express-unless for: ${divergences.join(', ')}`,
            ).to.have.lengthOf(0);
        });
    });
});
