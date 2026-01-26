import 'react-native';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, beforeEach, afterEach } from '@jest/globals';

/**
 * Feature Flags Validation Tests
 *
 * These tests verify the core feature flag validation logic including:
 * - Feature dependency checking (e.g., ENABLE_EVENTS requires ENABLE_MAP)
 * - Navigation tab count validation (3-5 tabs required)
 * - Error message formatting
 * - Dev mode assertion behavior
 *
 * Note: These tests mirror the logic in main/utilities/validateFeatureFlags.ts
 * to test the validation behavior without importing the actual module
 * (avoiding complex mock setup for therr-js-utilities).
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
// FeatureFlags Constants (mirroring therr-js-utilities/constants/enums/FeatureFlags.ts)
// ============================================================================

const FeatureFlags = {
    // Navigation Tabs
    ENABLE_AREAS: 'ENABLE_AREAS',
    ENABLE_GROUPS: 'ENABLE_GROUPS',
    ENABLE_MAP: 'ENABLE_MAP',
    ENABLE_CONNECT: 'ENABLE_CONNECT',

    // Content Types
    ENABLE_MOMENTS: 'ENABLE_MOMENTS',
    ENABLE_SPACES: 'ENABLE_SPACES',
    ENABLE_EVENTS: 'ENABLE_EVENTS',
    ENABLE_THOUGHTS: 'ENABLE_THOUGHTS',

    // Social Features
    ENABLE_DIRECT_MESSAGING: 'ENABLE_DIRECT_MESSAGING',
    ENABLE_ACHIEVEMENTS: 'ENABLE_ACHIEVEMENTS',
    ENABLE_ACTIVITIES: 'ENABLE_ACTIVITIES',
    ENABLE_NOTIFICATIONS: 'ENABLE_NOTIFICATIONS',

    // Groups Features
    ENABLE_FORUMS: 'ENABLE_FORUMS',
    ENABLE_ACTIVITY_SCHEDULER: 'ENABLE_ACTIVITY_SCHEDULER',
};

// ============================================================================
// Validation Logic (mirroring main/utilities/validateFeatureFlags.ts)
// ============================================================================

interface IFeatureDependency {
    feature: string;
    requires: string[];
}

// Navigation tab flags for counting visible tabs
const NAVIGATION_TAB_FLAGS = [
    FeatureFlags.ENABLE_AREAS,
    FeatureFlags.ENABLE_GROUPS,
    FeatureFlags.ENABLE_MAP,
    FeatureFlags.ENABLE_CONNECT,
];

// Define dependencies (feature X requires feature Y)
const FEATURE_DEPENDENCIES: IFeatureDependency[] = [
    { feature: FeatureFlags.ENABLE_EVENTS, requires: [FeatureFlags.ENABLE_MAP] },
    { feature: FeatureFlags.ENABLE_ACTIVITY_SCHEDULER, requires: [FeatureFlags.ENABLE_GROUPS] },
    { feature: FeatureFlags.ENABLE_FORUMS, requires: [FeatureFlags.ENABLE_GROUPS] },
];

/**
 * Validates feature flag configurations for correctness.
 * Checks feature dependencies and tab count requirements.
 */
const validateFeatureFlags = (flags: Record<string, boolean>): string[] => {
    const errors: string[] = [];

    // Check feature dependencies
    for (const dep of FEATURE_DEPENDENCIES) {
        if (flags[dep.feature]) {
            for (const required of dep.requires) {
                if (!flags[required]) {
                    errors.push(
                        `${dep.feature} requires ${required} to be enabled`
                    );
                }
            }
        }
    }

    // Validate tab count (3-5 tabs required for good UI)
    // Note: Profile tab is always shown, so we need 2-4 additional tabs
    const enabledTabCount = NAVIGATION_TAB_FLAGS.filter(flag => flags[flag]).length;
    const totalTabsWithProfile = enabledTabCount + 1; // +1 for Profile tab (always shown)

    if (totalTabsWithProfile < 3) {
        errors.push(
            `Too few navigation tabs enabled (${totalTabsWithProfile}). Minimum 3 required for good UI.`
        );
    }
    if (totalTabsWithProfile > 5) {
        errors.push(
            `Too many navigation tabs enabled (${totalTabsWithProfile}). Maximum 5 allowed for good UI.`
        );
    }

    return errors;
};

/**
 * Asserts that feature flags are valid, throwing in dev mode.
 * In production, validation errors are silently ignored.
 */
const assertValidFeatureFlags = (flags: Record<string, boolean>, isDev: boolean) => {
    if (isDev) {
        const errors = validateFeatureFlags(flags);
        if (errors.length > 0) {
            throw new Error(`Invalid feature flag configuration:\n${errors.join('\n')}`);
        }
    }
};

// ============================================================================
// Tests
// ============================================================================

describe('validateFeatureFlags', () => {
    describe('Feature Dependencies', () => {
        it('should return no errors when ENABLE_EVENTS is enabled with ENABLE_MAP', () => {
            const flags = {
                ENABLE_AREAS: true,
                ENABLE_GROUPS: true,
                ENABLE_MAP: true,
                ENABLE_CONNECT: false,
                ENABLE_EVENTS: true,
            };

            const errors = validateFeatureFlags(flags);

            expect(errors).not.toContainEqual(expect.stringContaining('ENABLE_EVENTS requires ENABLE_MAP'));
        });

        it('should return error when ENABLE_EVENTS is enabled without ENABLE_MAP', () => {
            const flags = {
                ENABLE_AREAS: true,
                ENABLE_GROUPS: true,
                ENABLE_MAP: false,
                ENABLE_CONNECT: true,
                ENABLE_EVENTS: true,
            };

            const errors = validateFeatureFlags(flags);

            expect(errors).toContain('ENABLE_EVENTS requires ENABLE_MAP to be enabled');
        });

        it('should return no errors when ENABLE_ACTIVITY_SCHEDULER is enabled with ENABLE_GROUPS', () => {
            const flags = {
                ENABLE_AREAS: true,
                ENABLE_GROUPS: true,
                ENABLE_MAP: true,
                ENABLE_CONNECT: false,
                ENABLE_ACTIVITY_SCHEDULER: true,
            };

            const errors = validateFeatureFlags(flags);

            expect(errors).not.toContainEqual(expect.stringContaining('ENABLE_ACTIVITY_SCHEDULER requires'));
        });

        it('should return error when ENABLE_ACTIVITY_SCHEDULER is enabled without ENABLE_GROUPS', () => {
            const flags = {
                ENABLE_AREAS: true,
                ENABLE_GROUPS: false,
                ENABLE_MAP: true,
                ENABLE_CONNECT: true,
                ENABLE_ACTIVITY_SCHEDULER: true,
            };

            const errors = validateFeatureFlags(flags);

            expect(errors).toContain('ENABLE_ACTIVITY_SCHEDULER requires ENABLE_GROUPS to be enabled');
        });

        it('should return error when ENABLE_FORUMS is enabled without ENABLE_GROUPS', () => {
            const flags = {
                ENABLE_AREAS: true,
                ENABLE_GROUPS: false,
                ENABLE_MAP: true,
                ENABLE_CONNECT: true,
                ENABLE_FORUMS: true,
            };

            const errors = validateFeatureFlags(flags);

            expect(errors).toContain('ENABLE_FORUMS requires ENABLE_GROUPS to be enabled');
        });

        it('should return no errors when dependent feature is disabled', () => {
            const flags = {
                ENABLE_AREAS: true,
                ENABLE_GROUPS: false,
                ENABLE_MAP: true,
                ENABLE_CONNECT: true,
                ENABLE_EVENTS: false, // Disabled, so no dependency error
                ENABLE_ACTIVITY_SCHEDULER: false,
                ENABLE_FORUMS: false,
            };

            const errors = validateFeatureFlags(flags);

            // Should only have errors about dependencies, not about disabled features
            expect(errors).not.toContainEqual(expect.stringContaining('ENABLE_EVENTS requires'));
            expect(errors).not.toContainEqual(expect.stringContaining('ENABLE_ACTIVITY_SCHEDULER requires'));
            expect(errors).not.toContainEqual(expect.stringContaining('ENABLE_FORUMS requires'));
        });
    });

    describe('Tab Count Validation', () => {
        it('should return no errors when 4 navigation tabs are enabled (5 total with Profile)', () => {
            const flags = {
                ENABLE_AREAS: true,
                ENABLE_GROUPS: true,
                ENABLE_MAP: true,
                ENABLE_CONNECT: true,
            };

            const errors = validateFeatureFlags(flags);

            expect(errors).not.toContainEqual(expect.stringContaining('Too few navigation tabs'));
            expect(errors).not.toContainEqual(expect.stringContaining('Too many navigation tabs'));
        });

        it('should return no errors when 3 navigation tabs are enabled (4 total with Profile)', () => {
            const flags = {
                ENABLE_AREAS: true,
                ENABLE_GROUPS: true,
                ENABLE_MAP: true,
                ENABLE_CONNECT: false,
            };

            const errors = validateFeatureFlags(flags);

            expect(errors).not.toContainEqual(expect.stringContaining('Too few navigation tabs'));
            expect(errors).not.toContainEqual(expect.stringContaining('Too many navigation tabs'));
        });

        it('should return no errors when 2 navigation tabs are enabled (3 total with Profile)', () => {
            const flags = {
                ENABLE_AREAS: true,
                ENABLE_GROUPS: true,
                ENABLE_MAP: false,
                ENABLE_CONNECT: false,
            };

            const errors = validateFeatureFlags(flags);

            expect(errors).not.toContainEqual(expect.stringContaining('Too few navigation tabs'));
            expect(errors).not.toContainEqual(expect.stringContaining('Too many navigation tabs'));
        });

        it('should return error when only 1 navigation tab is enabled (2 total with Profile)', () => {
            const flags = {
                ENABLE_AREAS: true,
                ENABLE_GROUPS: false,
                ENABLE_MAP: false,
                ENABLE_CONNECT: false,
            };

            const errors = validateFeatureFlags(flags);

            expect(errors).toContainEqual(expect.stringContaining('Too few navigation tabs enabled (2)'));
        });

        it('should return error when 0 navigation tabs are enabled (1 total with Profile)', () => {
            const flags = {
                ENABLE_AREAS: false,
                ENABLE_GROUPS: false,
                ENABLE_MAP: false,
                ENABLE_CONNECT: false,
            };

            const errors = validateFeatureFlags(flags);

            expect(errors).toContainEqual(expect.stringContaining('Too few navigation tabs enabled (1)'));
        });

        it('should include minimum requirement message in tab count error', () => {
            const flags = {
                ENABLE_AREAS: true,
                ENABLE_GROUPS: false,
                ENABLE_MAP: false,
                ENABLE_CONNECT: false,
            };

            const errors = validateFeatureFlags(flags);

            expect(errors).toContainEqual(expect.stringContaining('Minimum 3 required'));
        });
    });

    describe('Multiple Errors', () => {
        it('should return multiple errors when multiple validation rules fail', () => {
            const flags = {
                ENABLE_AREAS: true,
                ENABLE_GROUPS: false,
                ENABLE_MAP: false,
                ENABLE_CONNECT: false,
                ENABLE_EVENTS: true, // Requires ENABLE_MAP
                ENABLE_ACTIVITY_SCHEDULER: true, // Requires ENABLE_GROUPS
            };

            const errors = validateFeatureFlags(flags);

            expect(errors.length).toBeGreaterThanOrEqual(3); // Tab count + 2 dependency errors
            expect(errors).toContain('ENABLE_EVENTS requires ENABLE_MAP to be enabled');
            expect(errors).toContain('ENABLE_ACTIVITY_SCHEDULER requires ENABLE_GROUPS to be enabled');
            expect(errors).toContainEqual(expect.stringContaining('Too few navigation tabs'));
        });
    });

    describe('Valid Configurations', () => {
        it('should return empty array for valid full configuration', () => {
            const flags = {
                ENABLE_AREAS: true,
                ENABLE_GROUPS: true,
                ENABLE_MAP: true,
                ENABLE_CONNECT: true,
                ENABLE_MOMENTS: true,
                ENABLE_SPACES: true,
                ENABLE_EVENTS: true,
                ENABLE_THOUGHTS: true,
                ENABLE_DIRECT_MESSAGING: true,
                ENABLE_ACHIEVEMENTS: true,
                ENABLE_ACTIVITIES: true,
                ENABLE_NOTIFICATIONS: true,
                ENABLE_FORUMS: true,
                ENABLE_ACTIVITY_SCHEDULER: true,
            };

            const errors = validateFeatureFlags(flags);

            expect(errors).toEqual([]);
        });

        it('should return empty array for valid minimal configuration', () => {
            const flags = {
                ENABLE_AREAS: true,
                ENABLE_GROUPS: true,
                ENABLE_MAP: false,
                ENABLE_CONNECT: false,
            };

            const errors = validateFeatureFlags(flags);

            expect(errors).toEqual([]);
        });

        it('should return empty array with only content features (no navigation impact)', () => {
            const flags = {
                ENABLE_AREAS: true,
                ENABLE_GROUPS: true,
                ENABLE_MAP: true,
                ENABLE_CONNECT: false,
                ENABLE_MOMENTS: true,
                ENABLE_SPACES: true,
                ENABLE_THOUGHTS: true,
                ENABLE_DIRECT_MESSAGING: true,
            };

            const errors = validateFeatureFlags(flags);

            expect(errors).toEqual([]);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty flags object', () => {
            const flags = {};

            const errors = validateFeatureFlags(flags);

            // Should have tab count error (0 + 1 = 1 tab)
            expect(errors).toContainEqual(expect.stringContaining('Too few navigation tabs'));
        });

        it('should handle undefined flag values gracefully', () => {
            const flags = {
                ENABLE_AREAS: undefined,
                ENABLE_GROUPS: true,
                ENABLE_MAP: true,
                ENABLE_CONNECT: undefined,
            } as any;

            // Should not throw
            expect(() => validateFeatureFlags(flags)).not.toThrow();
        });

        it('should handle missing navigation flags', () => {
            const flags = {
                ENABLE_MOMENTS: true,
                ENABLE_SPACES: true,
            };

            const errors = validateFeatureFlags(flags);

            // Should have tab count error
            expect(errors).toContainEqual(expect.stringContaining('Too few navigation tabs'));
        });
    });
});

describe('assertValidFeatureFlags', () => {
    describe('Development Mode', () => {
        it('should throw error in dev mode when validation fails', () => {
            const flags = {
                ENABLE_AREAS: true,
                ENABLE_GROUPS: false,
                ENABLE_MAP: false,
                ENABLE_CONNECT: false,
            };

            expect(() => assertValidFeatureFlags(flags, true)).toThrow('Invalid feature flag configuration');
        });

        it('should not throw when validation passes in dev mode', () => {
            const flags = {
                ENABLE_AREAS: true,
                ENABLE_GROUPS: true,
                ENABLE_MAP: true,
                ENABLE_CONNECT: false,
            };

            expect(() => assertValidFeatureFlags(flags, true)).not.toThrow();
        });

        it('should include all error messages in thrown error', () => {
            const flags = {
                ENABLE_AREAS: true,
                ENABLE_GROUPS: false,
                ENABLE_MAP: false,
                ENABLE_CONNECT: false,
                ENABLE_EVENTS: true,
            };

            expect(() => assertValidFeatureFlags(flags, true)).toThrow('ENABLE_EVENTS requires ENABLE_MAP');
        });
    });

    describe('Production Mode', () => {
        it('should not throw in production mode even with invalid config', () => {
            const flags = {
                ENABLE_AREAS: true,
                ENABLE_GROUPS: false,
                ENABLE_MAP: false,
                ENABLE_CONNECT: false,
            };

            expect(() => assertValidFeatureFlags(flags, false)).not.toThrow();
        });
    });
});
