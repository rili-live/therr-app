import { expect } from 'chai';
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
});
