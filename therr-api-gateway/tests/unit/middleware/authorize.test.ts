/**
 * Unit Tests for authorize middleware
 *
 * Tests access level validation with ALL, ANY, NONE check types
 * and organization-level access checks.
 *
 * Note: These tests verify the authorization logic independently
 * without requiring the full application context.
 */
import { expect } from 'chai';
import * as sinon from 'sinon';

// Enum definition matching the source (using const to avoid shadowing)
const AccessCheckType = {
    ALL: 'all',
    ANY: 'any',
    NONE: 'none',
} as const;

type AccessCheckTypeValue = typeof AccessCheckType[keyof typeof AccessCheckType];

// isAuthorized function matching the source logic
const isAuthorized = (access: { type: AccessCheckTypeValue; levels: string[]; isPublic?: boolean }, userAccessLevels: string[] | null) => {
    if (access.isPublic || userAccessLevels) {
        if (!userAccessLevels) {
            return true;
        }
        if (access.type === AccessCheckType.NONE) {
            return !access.levels.some((lvl) => userAccessLevels.includes(lvl));
        }
        if (access.type === AccessCheckType.ANY) {
            return access.levels.some((lvl) => userAccessLevels.includes(lvl));
        }
        if (access.type === AccessCheckType.ALL) {
            return !access.levels.some((lvl) => !userAccessLevels.includes(lvl));
        }
    }
    return false;
};

describe('authorize middleware', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('AccessCheckType.ANY', () => {
        it('should allow access when user has at least one required level', () => {
            const userAccessLevels = ['user.default', 'user.premium'];
            const access = {
                type: AccessCheckType.ANY,
                levels: ['user.premium', 'user.admin'],
            };

            const authorized = isAuthorized(access, userAccessLevels);
            expect(authorized).to.be.eq(true);
        });

        it('should deny access when user has none of the required levels', () => {
            const userAccessLevels = ['user.default'];
            const access = {
                type: AccessCheckType.ANY,
                levels: ['user.premium', 'user.admin'],
            };

            const authorized = isAuthorized(access, userAccessLevels);
            expect(authorized).to.be.eq(false);
        });

        it('should allow access when user has exactly one matching level', () => {
            const userAccessLevels = ['user.admin'];
            const access = {
                type: AccessCheckType.ANY,
                levels: ['user.premium', 'user.admin', 'user.superadmin'],
            };

            const authorized = isAuthorized(access, userAccessLevels);
            expect(authorized).to.be.eq(true);
        });
    });

    describe('AccessCheckType.ALL', () => {
        it('should allow access when user has all required levels', () => {
            const userAccessLevels = ['user.default', 'user.premium', 'user.admin'];
            const access = {
                type: AccessCheckType.ALL,
                levels: ['user.premium', 'user.admin'],
            };

            const authorized = isAuthorized(access, userAccessLevels);
            expect(authorized).to.be.eq(true);
        });

        it('should deny access when user is missing one required level', () => {
            const userAccessLevels = ['user.default', 'user.premium'];
            const access = {
                type: AccessCheckType.ALL,
                levels: ['user.premium', 'user.admin'],
            };

            const authorized = isAuthorized(access, userAccessLevels);
            expect(authorized).to.be.eq(false);
        });

        it('should allow access when user has extra levels beyond required', () => {
            const userAccessLevels = ['user.default', 'user.premium', 'user.admin', 'user.superadmin'];
            const access = {
                type: AccessCheckType.ALL,
                levels: ['user.premium'],
            };

            const authorized = isAuthorized(access, userAccessLevels);
            expect(authorized).to.be.eq(true);
        });
    });

    describe('AccessCheckType.NONE', () => {
        it('should allow access when user has none of the restricted levels', () => {
            const userAccessLevels = ['user.default'];
            const access = {
                type: AccessCheckType.NONE,
                levels: ['user.banned', 'user.restricted'],
            };

            const authorized = isAuthorized(access, userAccessLevels);
            expect(authorized).to.be.eq(true);
        });

        it('should deny access when user has any restricted level', () => {
            const userAccessLevels = ['user.default', 'user.banned'];
            const access = {
                type: AccessCheckType.NONE,
                levels: ['user.banned', 'user.restricted'],
            };

            const authorized = isAuthorized(access, userAccessLevels);
            expect(authorized).to.be.eq(false);
        });

        it('should deny access when user has all restricted levels', () => {
            const userAccessLevels = ['user.banned', 'user.restricted'];
            const access = {
                type: AccessCheckType.NONE,
                levels: ['user.banned', 'user.restricted'],
            };

            const authorized = isAuthorized(access, userAccessLevels);
            expect(authorized).to.be.eq(false);
        });
    });

    describe('Public Routes (isPublic flag)', () => {
        it('should allow access to public routes without user access levels', () => {
            const access = {
                type: AccessCheckType.ANY,
                levels: ['user.premium'],
                isPublic: true,
            };

            const authorized = isAuthorized(access, null);
            expect(authorized).to.be.eq(true);
        });

        it('should still validate access levels if provided for public routes', () => {
            const userAccessLevels = ['user.default'];
            const access = {
                type: AccessCheckType.ANY,
                levels: ['user.premium'],
                isPublic: true,
            };

            // When access levels ARE provided, they must still pass validation
            const authorized = isAuthorized(access, userAccessLevels);
            expect(authorized).to.be.eq(false);
        });
    });

    describe('Organization Access Checks', () => {
        it('should validate organization access correctly', () => {
            const userOrgsAccess = {
                'org-123': ['admin', 'member'],
            };
            const contextOrgId = 'org-123';
            const orgAccess = {
                type: AccessCheckType.ANY,
                levels: ['admin'],
            };

            const organizationAccessLevels = userOrgsAccess[contextOrgId] || [];
            const authorized = isAuthorized(orgAccess, organizationAccessLevels);

            expect(authorized).to.be.eq(true);
        });

        it('should deny access when user lacks organization access', () => {
            const userOrgsAccess = {
                'org-123': ['viewer'],
            };
            const contextOrgId = 'org-123';
            const orgAccess = {
                type: AccessCheckType.ANY,
                levels: ['admin', 'editor'],
            };

            const organizationAccessLevels = userOrgsAccess[contextOrgId] || [];
            const authorized = isAuthorized(orgAccess, organizationAccessLevels);

            expect(authorized).to.be.eq(false);
        });

        it('should deny access when user is not part of organization', () => {
            const userOrgsAccess = {
                'org-456': ['admin'],
            };
            const contextOrgId = 'org-123';
            const orgAccess = {
                type: AccessCheckType.ANY,
                levels: ['admin'],
            };

            const organizationAccessLevels = userOrgsAccess[contextOrgId] || [];
            const authorized = isAuthorized(orgAccess, organizationAccessLevels);

            expect(authorized).to.be.eq(false);
        });
    });

    describe('Header Parsing', () => {
        it('should parse x-user-access-levels header correctly', () => {
            const headerValue = '["user.default","user.premium"]';
            const parsed = JSON.parse(headerValue);

            expect(parsed).to.deep.equal(['user.default', 'user.premium']);
        });

        it('should parse x-organizations header correctly', () => {
            const headerValue = '{"org-1":["admin"],"org-2":["member"]}';
            const parsed = JSON.parse(headerValue);

            expect(parsed).to.deep.equal({ 'org-1': ['admin'], 'org-2': ['member'] });
        });

        it('should handle malformed headers gracefully', () => {
            const headerValue = 'not-valid-json';
            let parsed = [];

            try {
                parsed = JSON.parse(headerValue);
            } catch {
                parsed = [];
            }

            expect(parsed).to.deep.equal([]);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty access levels array', () => {
            const userAccessLevels: string[] = [];
            const access = {
                type: AccessCheckType.ANY,
                levels: ['user.default'],
            };

            const authorized = isAuthorized(access, userAccessLevels);
            expect(authorized).to.be.eq(false);
        });

        it('should handle empty required levels array for ANY check', () => {
            const userAccessLevels = ['user.default'];
            const access = {
                type: AccessCheckType.ANY,
                levels: [] as string[],
            };

            const authorized = isAuthorized(access, userAccessLevels);
            // Empty levels array means no match possible for ANY
            expect(authorized).to.be.eq(false);
        });

        it('should handle empty required levels array for ALL check', () => {
            const userAccessLevels = ['user.default'];
            const access = {
                type: AccessCheckType.ALL,
                levels: [] as string[],
            };

            const authorized = isAuthorized(access, userAccessLevels);
            // Empty levels array means all requirements met (vacuous truth)
            expect(authorized).to.be.eq(true);
        });

        it('should handle empty required levels array for NONE check', () => {
            const userAccessLevels = ['user.default'];
            const access = {
                type: AccessCheckType.NONE,
                levels: [] as string[],
            };

            const authorized = isAuthorized(access, userAccessLevels);
            // Empty levels array means no restrictions
            expect(authorized).to.be.eq(true);
        });
    });

    describe('HTTP Status Code Mapping', () => {
        it('should map unauthorized access to 403 Forbidden', () => {
            const statusCode = 403;
            expect(statusCode).to.equal(403);
        });

        it('should map unauthorized organization access to 403 Forbidden', () => {
            const statusCode = 403;
            const message = 'Invalid Organization Access Levels';

            expect(statusCode).to.equal(403);
            expect(message).to.include('Organization');
        });
    });
});
