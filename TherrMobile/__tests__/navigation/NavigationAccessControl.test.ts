import 'react-native';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, beforeEach, afterEach, expect } from '@jest/globals';

/**
 * Navigation & Route Access Control Regression Tests
 *
 * These tests verify the core navigation access control logic including:
 * - UsersService.isAuthorized method behavior
 * - AccessCheckType (ALL, ANY, NONE) logic
 * - Public vs authenticated route access
 * - Email verification gates
 * - Route filtering based on user access levels
 */

beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
});

afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});

// ============================================================================
// Access Levels Constants (mirroring therr-js-utilities/constants/enums/AccessLevels.ts)
// ============================================================================

const AccessLevels = {
    DEFAULT: 'user.default',
    DASHBOARD_SIGNUP: 'user.dashboard.default',
    DASHBOARD_SUBSCRIBER_BASIC: 'user.dashboard.subscriber.basic',
    DASHBOARD_SUBSCRIBER_PRO: 'user.dashboard.subscriber.pro',
    DASHBOARD_SUBSCRIBER_PREMIUM: 'user.dashboard.subscriber.premium',
    DASHBOARD_SUBSCRIBER_AGENCY: 'user.dashboard.subscriber.agency',
    EMAIL_VERIFIED_MISSING_PROPERTIES: 'user.verified.email.missing.props',
    EMAIL_VERIFIED: 'user.verified.email',
    MOBILE_VERIFIED: 'user.verified.mobile',
    SUPER_ADMIN: 'user.admin.super',
    ORGANIZATIONS_ADMIN: 'user.organizations.admin',
    ORGANIZATIONS_BILLING: 'user.organizations.billing',
    ORGANIZATIONS_MANAGER: 'user.organizations.manager',
    ORGANIZATIONS_READ: 'user.organizations.read',
    ORGANIZATIONS_SUBSCRIBER: 'user.organizations.subscriber',
};

// ============================================================================
// Access Check Types (mirroring therr-react/types/index.ts)
// ============================================================================

enum AccessCheckType {
    ALL = 'all',   // User has all of the access levels from the check
    ANY = 'any',   // User has at least one of the access levels from the check
    NONE = 'none', // User does not have any of the access levels from the check
}

interface IAccess {
    type: AccessCheckType;
    levels: Array<string>;
    isPublic?: boolean;
}

interface IUserState {
    details?: {
        id?: string;
        accessLevels?: string[];
    };
    isAuthenticated?: boolean;
}

// ============================================================================
// UsersService.isAuthorized Implementation (mirroring therr-react/services/UsersService.ts)
// ============================================================================

/**
 * Core authorization check function that determines if a user has access to a route
 * based on their access levels and the route's access configuration.
 *
 * This is the central logic used by Layout.tsx to filter which routes are visible
 * to the current user.
 */
const isAuthorized = (access: IAccess, user: IUserState): boolean => {
    const userAccessLevels = user?.details?.accessLevels;

    if (access.isPublic || userAccessLevels) {
        // Public routes with no user access levels - always grant access
        if (!userAccessLevels) {
            return true;
        }

        if (access.type === AccessCheckType.NONE) {
            // User does NOT have any of the access levels from the check
            return !access.levels.some((lvl) => user.details!.accessLevels!.includes(lvl));
        }

        if (access.type === AccessCheckType.ANY) {
            // User has at least one of the access levels from the check
            return access.levels.some((lvl) => user.details!.accessLevels!.includes(lvl));
        }

        if (access.type === AccessCheckType.ALL) {
            // User has ALL of the access levels from the check
            return !access.levels.some((lvl) => !user.details!.accessLevels!.includes(lvl));
        }
    }

    return false;
};

// ============================================================================
// AUTH HELPER FUNCTIONS (mirroring TherrMobile/main/utilities/authUtils.ts)
// ============================================================================

/**
 * Checks if user has any authentication access level (logged in)
 */
const isUserAuthenticated = (user: IUserState): boolean => isAuthorized(
    {
        type: AccessCheckType.ANY,
        levels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
    },
    user
);

/**
 * Checks if user has completed email verification with full profile
 */
const isUserEmailVerified = (user: IUserState): boolean => isAuthorized(
    {
        type: AccessCheckType.ALL,
        levels: [AccessLevels.EMAIL_VERIFIED],
    },
    user
);

// ============================================================================
// TESTS: AccessCheckType.NONE - User must NOT have any of the specified levels
// ============================================================================

describe('AccessCheckType.NONE Authorization', () => {
    describe('Public routes for unauthenticated users', () => {
        it('should grant access when user has no access levels and isPublic is true', () => {
            const access: IAccess = {
                type: AccessCheckType.NONE,
                levels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                isPublic: true,
            };
            const user: IUserState = { details: {} };

            expect(isAuthorized(access, user)).toBe(true);
        });

        it('should grant access when user object is empty and isPublic is true', () => {
            const access: IAccess = {
                type: AccessCheckType.NONE,
                levels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED],
                isPublic: true,
            };
            const user: IUserState = {};

            expect(isAuthorized(access, user)).toBe(true);
        });

        it('should deny access when user has one of the forbidden access levels', () => {
            const access: IAccess = {
                type: AccessCheckType.NONE,
                levels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                isPublic: true,
            };
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED],
                },
            };

            expect(isAuthorized(access, user)).toBe(false);
        });

        it('should deny access when user has multiple forbidden access levels', () => {
            const access: IAccess = {
                type: AccessCheckType.NONE,
                levels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED],
                isPublic: true,
            };
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED],
                },
            };

            expect(isAuthorized(access, user)).toBe(false);
        });

        it('should grant access when user has access levels not in the forbidden list', () => {
            const access: IAccess = {
                type: AccessCheckType.NONE,
                levels: [AccessLevels.EMAIL_VERIFIED],
                isPublic: true,
            };
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.SUPER_ADMIN], // Not in forbidden list
                },
            };

            expect(isAuthorized(access, user)).toBe(true);
        });
    });

    describe('Non-public routes with NONE check', () => {
        it('should deny access when isPublic is false and user has no access levels', () => {
            const access: IAccess = {
                type: AccessCheckType.NONE,
                levels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                isPublic: false,
            };
            const user: IUserState = { details: {} };

            expect(isAuthorized(access, user)).toBe(false);
        });

        it('should grant access when user has access levels not in forbidden list', () => {
            const access: IAccess = {
                type: AccessCheckType.NONE,
                levels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
            };
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED], // Not forbidden
                },
            };

            expect(isAuthorized(access, user)).toBe(true);
        });
    });
});

// ============================================================================
// TESTS: AccessCheckType.ANY - User must have at least one of the specified levels
// ============================================================================

describe('AccessCheckType.ANY Authorization', () => {
    it('should grant access when user has one of the required access levels', () => {
        const access: IAccess = {
            type: AccessCheckType.ANY,
            levels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED],
        };
        const user: IUserState = {
            details: {
                id: 'user-123',
                accessLevels: [AccessLevels.DEFAULT],
            },
        };

        expect(isAuthorized(access, user)).toBe(true);
    });

    it('should grant access when user has multiple of the required access levels', () => {
        const access: IAccess = {
            type: AccessCheckType.ANY,
            levels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED],
        };
        const user: IUserState = {
            details: {
                id: 'user-123',
                accessLevels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED],
            },
        };

        expect(isAuthorized(access, user)).toBe(true);
    });

    it('should deny access when user has none of the required access levels', () => {
        const access: IAccess = {
            type: AccessCheckType.ANY,
            levels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED],
        };
        const user: IUserState = {
            details: {
                id: 'user-123',
                accessLevels: [AccessLevels.SUPER_ADMIN], // Not in required list
            },
        };

        expect(isAuthorized(access, user)).toBe(false);
    });

    it('should deny access when user has no access levels', () => {
        const access: IAccess = {
            type: AccessCheckType.ANY,
            levels: [AccessLevels.EMAIL_VERIFIED],
        };
        const user: IUserState = { details: {} };

        expect(isAuthorized(access, user)).toBe(false);
    });

    it('should deny access when user details is undefined', () => {
        const access: IAccess = {
            type: AccessCheckType.ANY,
            levels: [AccessLevels.EMAIL_VERIFIED],
        };
        const user: IUserState = {};

        expect(isAuthorized(access, user)).toBe(false);
    });
});

// ============================================================================
// TESTS: AccessCheckType.ALL - User must have ALL of the specified levels
// ============================================================================

describe('AccessCheckType.ALL Authorization', () => {
    it('should grant access when user has all of the required access levels', () => {
        const access: IAccess = {
            type: AccessCheckType.ALL,
            levels: [AccessLevels.EMAIL_VERIFIED],
        };
        const user: IUserState = {
            details: {
                id: 'user-123',
                accessLevels: [AccessLevels.EMAIL_VERIFIED],
            },
        };

        expect(isAuthorized(access, user)).toBe(true);
    });

    it('should grant access when user has all required levels plus additional ones', () => {
        const access: IAccess = {
            type: AccessCheckType.ALL,
            levels: [AccessLevels.EMAIL_VERIFIED],
        };
        const user: IUserState = {
            details: {
                id: 'user-123',
                accessLevels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.SUPER_ADMIN],
            },
        };

        expect(isAuthorized(access, user)).toBe(true);
    });

    it('should deny access when user is missing one of the required access levels', () => {
        const access: IAccess = {
            type: AccessCheckType.ALL,
            levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.MOBILE_VERIFIED],
        };
        const user: IUserState = {
            details: {
                id: 'user-123',
                accessLevels: [AccessLevels.EMAIL_VERIFIED], // Missing MOBILE_VERIFIED
            },
        };

        expect(isAuthorized(access, user)).toBe(false);
    });

    it('should deny access when user has no access levels', () => {
        const access: IAccess = {
            type: AccessCheckType.ALL,
            levels: [AccessLevels.EMAIL_VERIFIED],
        };
        const user: IUserState = { details: {} };

        expect(isAuthorized(access, user)).toBe(false);
    });

    it('should grant access when requiring multiple levels and user has all', () => {
        const access: IAccess = {
            type: AccessCheckType.ALL,
            levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.MOBILE_VERIFIED],
        };
        const user: IUserState = {
            details: {
                id: 'user-123',
                accessLevels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.MOBILE_VERIFIED, AccessLevels.SUPER_ADMIN],
            },
        };

        expect(isAuthorized(access, user)).toBe(true);
    });
});

// ============================================================================
// TESTS: Route Configuration - Public vs Authenticated Routes
// ============================================================================

describe('Route Configuration - Public Routes', () => {
    // Landing route configuration
    const landingRouteAccess: IAccess = {
        type: AccessCheckType.NONE,
        levels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
        isPublic: true,
    };

    // Register route configuration
    const registerRouteAccess: IAccess = {
        type: AccessCheckType.NONE,
        levels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
        isPublic: true,
    };

    // EmailVerification route configuration
    const emailVerificationRouteAccess: IAccess = {
        type: AccessCheckType.NONE,
        levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
        isPublic: true,
    };

    describe('Landing route access', () => {
        it('should be accessible to completely unauthenticated users', () => {
            const user: IUserState = {};
            expect(isAuthorized(landingRouteAccess, user)).toBe(true);
        });

        it('should be accessible to users with no access levels', () => {
            const user: IUserState = { details: {} };
            expect(isAuthorized(landingRouteAccess, user)).toBe(true);
        });

        it('should NOT be accessible to users with DEFAULT access level', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.DEFAULT],
                },
            };
            expect(isAuthorized(landingRouteAccess, user)).toBe(false);
        });

        it('should NOT be accessible to users with EMAIL_VERIFIED access level', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED],
                },
            };
            expect(isAuthorized(landingRouteAccess, user)).toBe(false);
        });

        it('should NOT be accessible to users in email verification missing properties state', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                },
            };
            expect(isAuthorized(landingRouteAccess, user)).toBe(false);
        });
    });

    describe('Register route access', () => {
        it('should be accessible to unauthenticated users', () => {
            const user: IUserState = {};
            expect(isAuthorized(registerRouteAccess, user)).toBe(true);
        });

        it('should NOT be accessible to logged-in users', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED],
                },
            };
            expect(isAuthorized(registerRouteAccess, user)).toBe(false);
        });
    });

    describe('EmailVerification route access', () => {
        it('should be accessible to unauthenticated users', () => {
            const user: IUserState = {};
            expect(isAuthorized(emailVerificationRouteAccess, user)).toBe(true);
        });

        it('should be accessible to users with DEFAULT access level only', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.DEFAULT],
                },
            };
            expect(isAuthorized(emailVerificationRouteAccess, user)).toBe(true);
        });

        it('should NOT be accessible to users already EMAIL_VERIFIED', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED],
                },
            };
            expect(isAuthorized(emailVerificationRouteAccess, user)).toBe(false);
        });

        it('should NOT be accessible to users in EMAIL_VERIFIED_MISSING_PROPERTIES state', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                },
            };
            expect(isAuthorized(emailVerificationRouteAccess, user)).toBe(false);
        });
    });
});

describe('Route Configuration - Authenticated Routes', () => {
    // Routes requiring EMAIL_VERIFIED (full authentication)
    const authenticatedRouteAccess: IAccess = {
        type: AccessCheckType.ALL,
        levels: [AccessLevels.EMAIL_VERIFIED],
    };

    describe('Fully authenticated routes (Areas, Settings, Connect, etc.)', () => {
        it('should be accessible to users with EMAIL_VERIFIED access level', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED],
                },
            };
            expect(isAuthorized(authenticatedRouteAccess, user)).toBe(true);
        });

        it('should be accessible to super admins with EMAIL_VERIFIED', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.SUPER_ADMIN],
                },
            };
            expect(isAuthorized(authenticatedRouteAccess, user)).toBe(true);
        });

        it('should NOT be accessible to unauthenticated users', () => {
            const user: IUserState = {};
            expect(isAuthorized(authenticatedRouteAccess, user)).toBe(false);
        });

        it('should NOT be accessible to users with only DEFAULT access level', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.DEFAULT],
                },
            };
            expect(isAuthorized(authenticatedRouteAccess, user)).toBe(false);
        });

        it('should NOT be accessible to users in EMAIL_VERIFIED_MISSING_PROPERTIES state', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                },
            };
            expect(isAuthorized(authenticatedRouteAccess, user)).toBe(false);
        });
    });
});

// ============================================================================
// TESTS: Email Verification Gates
// ============================================================================

describe('Email Verification Gates', () => {
    // CreateProfile route - requires EMAIL_VERIFIED_MISSING_PROPERTIES
    const createProfileRouteAccess: IAccess = {
        type: AccessCheckType.ALL,
        levels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
    };

    describe('CreateProfile route (profile completion gate)', () => {
        it('should be accessible to users in EMAIL_VERIFIED_MISSING_PROPERTIES state', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                },
            };
            expect(isAuthorized(createProfileRouteAccess, user)).toBe(true);
        });

        it('should NOT be accessible to unauthenticated users', () => {
            const user: IUserState = {};
            expect(isAuthorized(createProfileRouteAccess, user)).toBe(false);
        });

        it('should NOT be accessible to users with DEFAULT access level', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.DEFAULT],
                },
            };
            expect(isAuthorized(createProfileRouteAccess, user)).toBe(false);
        });

        it('should NOT be accessible to users already fully verified', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED],
                },
            };
            expect(isAuthorized(createProfileRouteAccess, user)).toBe(false);
        });
    });

    describe('Semi-public routes (Map, Home, ViewSpace)', () => {
        // These routes use NONE with EMAIL_VERIFIED_MISSING_PROPERTIES
        // They're accessible to everyone EXCEPT users in the missing properties state
        const mapRouteAccess: IAccess = {
            type: AccessCheckType.NONE,
            levels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
        };

        const homeRouteAccess: IAccess = {
            type: AccessCheckType.NONE,
            levels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
            isPublic: true,
        };

        it('Home route should be accessible to unauthenticated users', () => {
            const user: IUserState = {};
            expect(isAuthorized(homeRouteAccess, user)).toBe(true);
        });

        it('Home route should be accessible to fully verified users', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED],
                },
            };
            expect(isAuthorized(homeRouteAccess, user)).toBe(true);
        });

        it('Home route should NOT be accessible to users in missing properties state', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                },
            };
            expect(isAuthorized(homeRouteAccess, user)).toBe(false);
        });

        it('Map route should NOT be accessible to unauthenticated users (not public)', () => {
            const user: IUserState = {};
            expect(isAuthorized(mapRouteAccess, user)).toBe(false);
        });

        it('Map route should be accessible to fully verified users', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED],
                },
            };
            expect(isAuthorized(mapRouteAccess, user)).toBe(true);
        });

        it('Map route should NOT be accessible to users in missing properties state', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                },
            };
            expect(isAuthorized(mapRouteAccess, user)).toBe(false);
        });
    });
});

// ============================================================================
// TESTS: Auth Helper Functions
// ============================================================================

describe('Auth Helper Functions', () => {
    describe('isUserAuthenticated', () => {
        it('should return true for user with DEFAULT access level', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.DEFAULT],
                },
            };
            expect(isUserAuthenticated(user)).toBe(true);
        });

        it('should return true for user with EMAIL_VERIFIED access level', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED],
                },
            };
            expect(isUserAuthenticated(user)).toBe(true);
        });

        it('should return true for user with EMAIL_VERIFIED_MISSING_PROPERTIES', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                },
            };
            expect(isUserAuthenticated(user)).toBe(true);
        });

        it('should return false for unauthenticated user', () => {
            const user: IUserState = {};
            expect(isUserAuthenticated(user)).toBe(false);
        });

        it('should return false for user with only SUPER_ADMIN (not a login access level)', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.SUPER_ADMIN],
                },
            };
            // SUPER_ADMIN alone is not one of the login access levels
            expect(isUserAuthenticated(user)).toBe(false);
        });

        it('should return true for super admin who also has EMAIL_VERIFIED', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.SUPER_ADMIN],
                },
            };
            expect(isUserAuthenticated(user)).toBe(true);
        });
    });

    describe('isUserEmailVerified', () => {
        it('should return true for user with EMAIL_VERIFIED access level', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED],
                },
            };
            expect(isUserEmailVerified(user)).toBe(true);
        });

        it('should return false for user with only DEFAULT access level', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.DEFAULT],
                },
            };
            expect(isUserEmailVerified(user)).toBe(false);
        });

        it('should return false for user with EMAIL_VERIFIED_MISSING_PROPERTIES', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                },
            };
            expect(isUserEmailVerified(user)).toBe(false);
        });

        it('should return false for unauthenticated user', () => {
            const user: IUserState = {};
            expect(isUserEmailVerified(user)).toBe(false);
        });

        it('should return true for user with EMAIL_VERIFIED and additional levels', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.MOBILE_VERIFIED, AccessLevels.SUPER_ADMIN],
                },
            };
            expect(isUserEmailVerified(user)).toBe(true);
        });
    });
});

// ============================================================================
// TESTS: Route Filtering Logic (as used in Layout.tsx)
// ============================================================================

describe('Route Filtering Logic', () => {
    // Mock route configurations
    const mockRoutes = [
        {
            name: 'Landing',
            options: () => ({
                access: {
                    type: AccessCheckType.NONE,
                    levels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                    isPublic: true,
                },
            }),
        },
        {
            name: 'Register',
            options: () => ({
                access: {
                    type: AccessCheckType.NONE,
                    levels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                    isPublic: true,
                },
            }),
        },
        {
            name: 'CreateProfile',
            options: () => ({
                access: {
                    type: AccessCheckType.ALL,
                    levels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                },
            }),
        },
        {
            name: 'Areas',
            options: () => ({
                access: {
                    type: AccessCheckType.ALL,
                    levels: [AccessLevels.EMAIL_VERIFIED],
                },
            }),
        },
        {
            name: 'Settings',
            options: () => ({
                access: {
                    type: AccessCheckType.ALL,
                    levels: [AccessLevels.EMAIL_VERIFIED],
                },
            }),
        },
        {
            name: 'ForgotPassword',
            options: () => ({
                title: 'Password Reset',
                // No access configuration - always visible
            }),
        },
    ];

    /**
     * Simulates the route filtering logic from Layout.tsx
     */
    const filterRoutes = (routes: any[], user: IUserState) => {
        return routes.filter((route: any) => {
            // Routes without access property are always visible
            if (!(route.options && typeof route.options === 'function' && route.options().access)) {
                return true;
            }

            // Hide Landing route if user is already logged in (has user id)
            if (route.name === 'Landing' && user?.details?.id) {
                return false;
            }

            // Check authorization based on access configuration
            return isAuthorized(route.options().access, user);
        });
    };

    describe('Unauthenticated user route visibility', () => {
        const unauthenticatedUser: IUserState = {};

        it('should show Landing route', () => {
            const visibleRoutes = filterRoutes(mockRoutes, unauthenticatedUser);
            expect(visibleRoutes.some(r => r.name === 'Landing')).toBe(true);
        });

        it('should show Register route', () => {
            const visibleRoutes = filterRoutes(mockRoutes, unauthenticatedUser);
            expect(visibleRoutes.some(r => r.name === 'Register')).toBe(true);
        });

        it('should show ForgotPassword route (no access config)', () => {
            const visibleRoutes = filterRoutes(mockRoutes, unauthenticatedUser);
            expect(visibleRoutes.some(r => r.name === 'ForgotPassword')).toBe(true);
        });

        it('should NOT show CreateProfile route', () => {
            const visibleRoutes = filterRoutes(mockRoutes, unauthenticatedUser);
            expect(visibleRoutes.some(r => r.name === 'CreateProfile')).toBe(false);
        });

        it('should NOT show Areas route', () => {
            const visibleRoutes = filterRoutes(mockRoutes, unauthenticatedUser);
            expect(visibleRoutes.some(r => r.name === 'Areas')).toBe(false);
        });

        it('should NOT show Settings route', () => {
            const visibleRoutes = filterRoutes(mockRoutes, unauthenticatedUser);
            expect(visibleRoutes.some(r => r.name === 'Settings')).toBe(false);
        });
    });

    describe('User in EMAIL_VERIFIED_MISSING_PROPERTIES state route visibility', () => {
        const onboardingUser: IUserState = {
            details: {
                id: 'user-123',
                accessLevels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
            },
        };

        it('should NOT show Landing route (user has id)', () => {
            const visibleRoutes = filterRoutes(mockRoutes, onboardingUser);
            expect(visibleRoutes.some(r => r.name === 'Landing')).toBe(false);
        });

        it('should NOT show Register route (user is authenticated)', () => {
            const visibleRoutes = filterRoutes(mockRoutes, onboardingUser);
            expect(visibleRoutes.some(r => r.name === 'Register')).toBe(false);
        });

        it('should show CreateProfile route', () => {
            const visibleRoutes = filterRoutes(mockRoutes, onboardingUser);
            expect(visibleRoutes.some(r => r.name === 'CreateProfile')).toBe(true);
        });

        it('should NOT show Areas route (not fully verified)', () => {
            const visibleRoutes = filterRoutes(mockRoutes, onboardingUser);
            expect(visibleRoutes.some(r => r.name === 'Areas')).toBe(false);
        });

        it('should show ForgotPassword route (no access config)', () => {
            const visibleRoutes = filterRoutes(mockRoutes, onboardingUser);
            expect(visibleRoutes.some(r => r.name === 'ForgotPassword')).toBe(true);
        });
    });

    describe('Fully verified user route visibility', () => {
        const verifiedUser: IUserState = {
            details: {
                id: 'user-123',
                accessLevels: [AccessLevels.EMAIL_VERIFIED],
            },
        };

        it('should NOT show Landing route (user has id)', () => {
            const visibleRoutes = filterRoutes(mockRoutes, verifiedUser);
            expect(visibleRoutes.some(r => r.name === 'Landing')).toBe(false);
        });

        it('should NOT show Register route (user is authenticated)', () => {
            const visibleRoutes = filterRoutes(mockRoutes, verifiedUser);
            expect(visibleRoutes.some(r => r.name === 'Register')).toBe(false);
        });

        it('should NOT show CreateProfile route (already verified)', () => {
            const visibleRoutes = filterRoutes(mockRoutes, verifiedUser);
            expect(visibleRoutes.some(r => r.name === 'CreateProfile')).toBe(false);
        });

        it('should show Areas route', () => {
            const visibleRoutes = filterRoutes(mockRoutes, verifiedUser);
            expect(visibleRoutes.some(r => r.name === 'Areas')).toBe(true);
        });

        it('should show Settings route', () => {
            const visibleRoutes = filterRoutes(mockRoutes, verifiedUser);
            expect(visibleRoutes.some(r => r.name === 'Settings')).toBe(true);
        });

        it('should show ForgotPassword route (no access config)', () => {
            const visibleRoutes = filterRoutes(mockRoutes, verifiedUser);
            expect(visibleRoutes.some(r => r.name === 'ForgotPassword')).toBe(true);
        });
    });
});

// ============================================================================
// TESTS: User Authentication State Transitions
// ============================================================================

describe('User Authentication State Transitions', () => {
    describe('Registration flow states', () => {
        it('new user starts unauthenticated', () => {
            const user: IUserState = {};
            expect(isUserAuthenticated(user)).toBe(false);
            expect(isUserEmailVerified(user)).toBe(false);
        });

        it('user after registration has DEFAULT access', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.DEFAULT],
                },
            };
            expect(isUserAuthenticated(user)).toBe(true);
            expect(isUserEmailVerified(user)).toBe(false);
        });

        it('user after email verification but before profile completion', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                },
            };
            expect(isUserAuthenticated(user)).toBe(true);
            expect(isUserEmailVerified(user)).toBe(false);
        });

        it('user after complete registration and profile setup', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED],
                },
            };
            expect(isUserAuthenticated(user)).toBe(true);
            expect(isUserEmailVerified(user)).toBe(true);
        });
    });

    describe('Access level combinations', () => {
        it('user can have multiple access levels', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [
                        AccessLevels.EMAIL_VERIFIED,
                        AccessLevels.MOBILE_VERIFIED,
                        AccessLevels.SUPER_ADMIN,
                    ],
                },
            };
            expect(isUserAuthenticated(user)).toBe(true);
            expect(isUserEmailVerified(user)).toBe(true);
        });

        it('dashboard user has different access path', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.DASHBOARD_SIGNUP],
                },
            };
            // Dashboard users are not considered authenticated for mobile routes
            expect(isUserAuthenticated(user)).toBe(false);
        });

        it('organization user has role-based access', () => {
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [
                        AccessLevels.EMAIL_VERIFIED,
                        AccessLevels.ORGANIZATIONS_ADMIN,
                    ],
                },
            };
            expect(isUserAuthenticated(user)).toBe(true);
            expect(isUserEmailVerified(user)).toBe(true);
        });
    });
});

// ============================================================================
// TESTS: Edge Cases and Error Handling
// ============================================================================

describe('Edge Cases and Error Handling', () => {
    describe('Null and undefined handling', () => {
        it('should handle null user object', () => {
            const access: IAccess = {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            };
            // @ts-ignore - Testing null case
            expect(isAuthorized(access, null)).toBe(false);
        });

        it('should handle undefined user object', () => {
            const access: IAccess = {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            };
            // @ts-ignore - Testing undefined case
            expect(isAuthorized(access, undefined)).toBe(false);
        });

        it('should handle null accessLevels array', () => {
            const access: IAccess = {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            };
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    // @ts-ignore - Testing null accessLevels
                    accessLevels: null,
                },
            };
            expect(isAuthorized(access, user)).toBe(false);
        });

        it('should handle undefined accessLevels array', () => {
            const access: IAccess = {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            };
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: undefined,
                },
            };
            expect(isAuthorized(access, user)).toBe(false);
        });
    });

    describe('Empty array handling', () => {
        it('should handle empty accessLevels array', () => {
            const access: IAccess = {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            };
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [],
                },
            };
            // Empty accessLevels array is truthy, so it proceeds to checks
            // ALL check with empty array should fail
            expect(isAuthorized(access, user)).toBe(false);
        });

        it('should handle empty access levels requirement with ALL', () => {
            const access: IAccess = {
                type: AccessCheckType.ALL,
                levels: [], // No levels required
            };
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED],
                },
            };
            // ALL with empty requirement should pass (user has all of nothing)
            expect(isAuthorized(access, user)).toBe(true);
        });

        it('should handle empty access levels requirement with NONE', () => {
            const access: IAccess = {
                type: AccessCheckType.NONE,
                levels: [], // No forbidden levels
            };
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED],
                },
            };
            // NONE with empty forbidden list should pass (user has none of nothing forbidden)
            expect(isAuthorized(access, user)).toBe(true);
        });
    });

    describe('Special access level combinations', () => {
        it('should handle super admin without email verification', () => {
            const access: IAccess = {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            };
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.SUPER_ADMIN],
                },
            };
            // Super admin without EMAIL_VERIFIED should not have access to email-verified routes
            expect(isAuthorized(access, user)).toBe(false);
        });

        it('should handle organization admin correctly', () => {
            const access: IAccess = {
                type: AccessCheckType.ANY,
                levels: [AccessLevels.ORGANIZATIONS_ADMIN, AccessLevels.SUPER_ADMIN],
            };
            const user: IUserState = {
                details: {
                    id: 'user-123',
                    accessLevels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.ORGANIZATIONS_ADMIN],
                },
            };
            expect(isAuthorized(access, user)).toBe(true);
        });
    });
});

// ============================================================================
// TESTS: Complete Route Access Matrix
// ============================================================================

describe('Complete Route Access Matrix', () => {
    // All route configurations from routes/index.tsx
    const routeConfigs = {
        Landing: {
            type: AccessCheckType.NONE,
            levels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
            isPublic: true,
        },
        Register: {
            type: AccessCheckType.NONE,
            levels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
            isPublic: true,
        },
        CreateProfile: {
            type: AccessCheckType.ALL,
            levels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
        },
        Map: {
            type: AccessCheckType.NONE,
            levels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
        },
        Home: {
            type: AccessCheckType.NONE,
            levels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
            isPublic: true,
        },
        ViewSpace: {
            type: AccessCheckType.NONE,
            levels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
            isPublic: true,
        },
        EmailVerification: {
            type: AccessCheckType.NONE,
            levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
            isPublic: true,
        },
        Areas: {
            type: AccessCheckType.ALL,
            levels: [AccessLevels.EMAIL_VERIFIED],
        },
        Achievements: {
            type: AccessCheckType.ALL,
            levels: [AccessLevels.EMAIL_VERIFIED],
        },
        Connect: {
            type: AccessCheckType.ALL,
            levels: [AccessLevels.EMAIL_VERIFIED],
        },
        DirectMessage: {
            type: AccessCheckType.ALL,
            levels: [AccessLevels.EMAIL_VERIFIED],
        },
        Settings: {
            type: AccessCheckType.ALL,
            levels: [AccessLevels.EMAIL_VERIFIED],
        },
        Notifications: {
            type: AccessCheckType.ALL,
            levels: [AccessLevels.EMAIL_VERIFIED],
        },
        Groups: {
            type: AccessCheckType.ALL,
            levels: [AccessLevels.EMAIL_VERIFIED],
        },
    };

    // User states to test
    const userStates = {
        unauthenticated: {},
        defaultOnly: {
            details: {
                id: 'user-123',
                accessLevels: [AccessLevels.DEFAULT],
            },
        },
        emailVerifiedMissingProps: {
            details: {
                id: 'user-123',
                accessLevels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
            },
        },
        emailVerified: {
            details: {
                id: 'user-123',
                accessLevels: [AccessLevels.EMAIL_VERIFIED],
            },
        },
        superAdmin: {
            details: {
                id: 'user-123',
                accessLevels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.SUPER_ADMIN],
            },
        },
    };

    describe('Route access for unauthenticated users', () => {
        const user = userStates.unauthenticated;

        it('Landing should be accessible', () => {
            expect(isAuthorized(routeConfigs.Landing, user)).toBe(true);
        });

        it('Register should be accessible', () => {
            expect(isAuthorized(routeConfigs.Register, user)).toBe(true);
        });

        it('Home should be accessible', () => {
            expect(isAuthorized(routeConfigs.Home, user)).toBe(true);
        });

        it('ViewSpace should be accessible', () => {
            expect(isAuthorized(routeConfigs.ViewSpace, user)).toBe(true);
        });

        it('EmailVerification should be accessible', () => {
            expect(isAuthorized(routeConfigs.EmailVerification, user)).toBe(true);
        });

        it('CreateProfile should NOT be accessible', () => {
            expect(isAuthorized(routeConfigs.CreateProfile, user)).toBe(false);
        });

        it('Areas should NOT be accessible', () => {
            expect(isAuthorized(routeConfigs.Areas, user)).toBe(false);
        });

        it('Settings should NOT be accessible', () => {
            expect(isAuthorized(routeConfigs.Settings, user)).toBe(false);
        });

        it('Map should NOT be accessible (not public)', () => {
            expect(isAuthorized(routeConfigs.Map, user)).toBe(false);
        });
    });

    describe('Route access for users in EMAIL_VERIFIED_MISSING_PROPERTIES state', () => {
        const user = userStates.emailVerifiedMissingProps;

        it('Landing should NOT be accessible', () => {
            expect(isAuthorized(routeConfigs.Landing, user)).toBe(false);
        });

        it('Register should NOT be accessible', () => {
            expect(isAuthorized(routeConfigs.Register, user)).toBe(false);
        });

        it('CreateProfile should be accessible', () => {
            expect(isAuthorized(routeConfigs.CreateProfile, user)).toBe(true);
        });

        it('Areas should NOT be accessible', () => {
            expect(isAuthorized(routeConfigs.Areas, user)).toBe(false);
        });

        it('Settings should NOT be accessible', () => {
            expect(isAuthorized(routeConfigs.Settings, user)).toBe(false);
        });

        it('Home should NOT be accessible', () => {
            expect(isAuthorized(routeConfigs.Home, user)).toBe(false);
        });

        it('Map should NOT be accessible', () => {
            expect(isAuthorized(routeConfigs.Map, user)).toBe(false);
        });

        it('EmailVerification should NOT be accessible', () => {
            expect(isAuthorized(routeConfigs.EmailVerification, user)).toBe(false);
        });
    });

    describe('Route access for fully verified users', () => {
        const user = userStates.emailVerified;

        it('Landing should NOT be accessible', () => {
            expect(isAuthorized(routeConfigs.Landing, user)).toBe(false);
        });

        it('Register should NOT be accessible', () => {
            expect(isAuthorized(routeConfigs.Register, user)).toBe(false);
        });

        it('CreateProfile should NOT be accessible', () => {
            expect(isAuthorized(routeConfigs.CreateProfile, user)).toBe(false);
        });

        it('Areas should be accessible', () => {
            expect(isAuthorized(routeConfigs.Areas, user)).toBe(true);
        });

        it('Achievements should be accessible', () => {
            expect(isAuthorized(routeConfigs.Achievements, user)).toBe(true);
        });

        it('Connect should be accessible', () => {
            expect(isAuthorized(routeConfigs.Connect, user)).toBe(true);
        });

        it('DirectMessage should be accessible', () => {
            expect(isAuthorized(routeConfigs.DirectMessage, user)).toBe(true);
        });

        it('Settings should be accessible', () => {
            expect(isAuthorized(routeConfigs.Settings, user)).toBe(true);
        });

        it('Notifications should be accessible', () => {
            expect(isAuthorized(routeConfigs.Notifications, user)).toBe(true);
        });

        it('Groups should be accessible', () => {
            expect(isAuthorized(routeConfigs.Groups, user)).toBe(true);
        });

        it('Home should be accessible', () => {
            expect(isAuthorized(routeConfigs.Home, user)).toBe(true);
        });

        it('Map should be accessible', () => {
            expect(isAuthorized(routeConfigs.Map, user)).toBe(true);
        });

        it('ViewSpace should be accessible', () => {
            expect(isAuthorized(routeConfigs.ViewSpace, user)).toBe(true);
        });

        it('EmailVerification should NOT be accessible', () => {
            expect(isAuthorized(routeConfigs.EmailVerification, user)).toBe(false);
        });
    });

    describe('Route access for super admin users', () => {
        const user = userStates.superAdmin;

        it('should have access to all authenticated routes', () => {
            expect(isAuthorized(routeConfigs.Areas, user)).toBe(true);
            expect(isAuthorized(routeConfigs.Settings, user)).toBe(true);
            expect(isAuthorized(routeConfigs.Connect, user)).toBe(true);
            expect(isAuthorized(routeConfigs.Groups, user)).toBe(true);
            expect(isAuthorized(routeConfigs.Notifications, user)).toBe(true);
        });

        it('should NOT have access to public-only routes', () => {
            expect(isAuthorized(routeConfigs.Landing, user)).toBe(false);
            expect(isAuthorized(routeConfigs.Register, user)).toBe(false);
        });
    });
});
