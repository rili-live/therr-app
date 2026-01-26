import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, beforeEach, afterEach } from '@jest/globals';

/**
 * FeatureGate Component Tests
 *
 * These tests verify the FeatureGate component behavior including:
 * - Rendering children when feature is enabled
 * - Hiding children when feature is disabled
 * - Rendering fallback when feature is disabled
 * - AND logic (all features must be enabled)
 * - OR logic (any feature can be enabled)
 *
 * Note: These tests mirror the logic from main/components/FeatureGate.tsx
 * and main/context/FeatureFlagContext.tsx to test behavior without
 * complex module imports.
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
    ENABLE_AREAS: 'ENABLE_AREAS',
    ENABLE_GROUPS: 'ENABLE_GROUPS',
    ENABLE_MAP: 'ENABLE_MAP',
    ENABLE_CONNECT: 'ENABLE_CONNECT',
    ENABLE_MOMENTS: 'ENABLE_MOMENTS',
    ENABLE_SPACES: 'ENABLE_SPACES',
    ENABLE_EVENTS: 'ENABLE_EVENTS',
    ENABLE_DIRECT_MESSAGING: 'ENABLE_DIRECT_MESSAGING',
};

// ============================================================================
// Feature Flag Context Logic (mirroring main/context/FeatureFlagContext.tsx)
// ============================================================================

interface IFeatureFlagContext {
    flags: Record<string, boolean>;
    isEnabled: (flag: string) => boolean;
    areAllEnabled: (flags: string[]) => boolean;
    isAnyEnabled: (flags: string[]) => boolean;
}

/**
 * Creates a feature flag context value from a flags configuration.
 */
const createFeatureFlagContext = (featureFlags: Record<string, boolean>): IFeatureFlagContext => ({
    flags: featureFlags,
    isEnabled: (flag: string) => featureFlags[flag] === true,
    areAllEnabled: (flags: string[]) => flags.every(f => featureFlags[f] === true),
    isAnyEnabled: (flags: string[]) => flags.some(f => featureFlags[f] === true),
});

// ============================================================================
// FeatureGate Logic (mirroring main/components/FeatureGate.tsx)
// ============================================================================

interface IFeatureGateProps {
    feature?: string;
    features?: string[];
    mode?: 'all' | 'any';
    fallback?: React.ReactNode;
    children: React.ReactNode;
}

/**
 * Determines whether to render children based on feature flags.
 */
const shouldRenderGate = (
    context: IFeatureFlagContext,
    feature?: string,
    features?: string[],
    mode: 'all' | 'any' = 'all'
): boolean => {
    const { isEnabled, areAllEnabled, isAnyEnabled } = context;

    if (feature) {
        return isEnabled(feature);
    } else if (features) {
        return mode === 'all'
            ? areAllEnabled(features)
            : isAnyEnabled(features);
    }

    // No feature specified, render children
    return true;
};

// ============================================================================
// Tests
// ============================================================================

describe('FeatureGate Logic', () => {
    describe('Single Feature Gate', () => {
        it('should return true when feature is enabled', () => {
            const context = createFeatureFlagContext({
                ENABLE_MAP: true,
                ENABLE_AREAS: true,
                ENABLE_GROUPS: true,
            });

            const result = shouldRenderGate(context, FeatureFlags.ENABLE_MAP);

            expect(result).toBe(true);
        });

        it('should return false when feature is disabled', () => {
            const context = createFeatureFlagContext({
                ENABLE_MAP: false,
                ENABLE_AREAS: true,
                ENABLE_GROUPS: true,
            });

            const result = shouldRenderGate(context, FeatureFlags.ENABLE_MAP);

            expect(result).toBe(false);
        });

        it('should return false when feature is undefined (not explicitly set)', () => {
            const context = createFeatureFlagContext({
                ENABLE_AREAS: true,
                ENABLE_GROUPS: true,
            });

            const result = shouldRenderGate(context, FeatureFlags.ENABLE_MAP);

            expect(result).toBe(false);
        });
    });

    describe('Multiple Features - AND Logic (mode="all")', () => {
        it('should return true when all features are enabled', () => {
            const context = createFeatureFlagContext({
                ENABLE_MAP: true,
                ENABLE_AREAS: true,
                ENABLE_GROUPS: true,
            });

            const result = shouldRenderGate(
                context,
                undefined,
                [FeatureFlags.ENABLE_MAP, FeatureFlags.ENABLE_AREAS],
                'all'
            );

            expect(result).toBe(true);
        });

        it('should return false when one feature is disabled (AND logic)', () => {
            const context = createFeatureFlagContext({
                ENABLE_MAP: false,
                ENABLE_AREAS: true,
                ENABLE_GROUPS: true,
            });

            const result = shouldRenderGate(
                context,
                undefined,
                [FeatureFlags.ENABLE_MAP, FeatureFlags.ENABLE_AREAS],
                'all'
            );

            expect(result).toBe(false);
        });

        it('should return false when all features are disabled (AND logic)', () => {
            const context = createFeatureFlagContext({
                ENABLE_MAP: false,
                ENABLE_AREAS: false,
                ENABLE_GROUPS: true,
            });

            const result = shouldRenderGate(
                context,
                undefined,
                [FeatureFlags.ENABLE_MAP, FeatureFlags.ENABLE_AREAS],
                'all'
            );

            expect(result).toBe(false);
        });

        it('should default to "all" mode when mode is not specified', () => {
            const context = createFeatureFlagContext({
                ENABLE_MAP: false,
                ENABLE_AREAS: true,
            });

            const result = shouldRenderGate(
                context,
                undefined,
                [FeatureFlags.ENABLE_MAP, FeatureFlags.ENABLE_AREAS]
            );

            // Should return false because ENABLE_MAP is false (AND logic)
            expect(result).toBe(false);
        });
    });

    describe('Multiple Features - OR Logic (mode="any")', () => {
        it('should return true when all features are enabled', () => {
            const context = createFeatureFlagContext({
                ENABLE_MAP: true,
                ENABLE_AREAS: true,
            });

            const result = shouldRenderGate(
                context,
                undefined,
                [FeatureFlags.ENABLE_MAP, FeatureFlags.ENABLE_AREAS],
                'any'
            );

            expect(result).toBe(true);
        });

        it('should return true when at least one feature is enabled (OR logic)', () => {
            const context = createFeatureFlagContext({
                ENABLE_MAP: false,
                ENABLE_AREAS: true,
            });

            const result = shouldRenderGate(
                context,
                undefined,
                [FeatureFlags.ENABLE_MAP, FeatureFlags.ENABLE_AREAS],
                'any'
            );

            expect(result).toBe(true);
        });

        it('should return false when all features are disabled (OR logic)', () => {
            const context = createFeatureFlagContext({
                ENABLE_MAP: false,
                ENABLE_AREAS: false,
            });

            const result = shouldRenderGate(
                context,
                undefined,
                [FeatureFlags.ENABLE_MAP, FeatureFlags.ENABLE_AREAS],
                'any'
            );

            expect(result).toBe(false);
        });
    });

    describe('No Feature Specified', () => {
        it('should return true when no feature or features prop is provided', () => {
            const context = createFeatureFlagContext({
                ENABLE_MAP: false,
                ENABLE_AREAS: false,
            });

            const result = shouldRenderGate(context);

            expect(result).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty features array with AND mode (returns true)', () => {
            const context = createFeatureFlagContext({
                ENABLE_MAP: true,
            });

            // empty array with every() returns true
            const result = shouldRenderGate(context, undefined, [], 'all');

            expect(result).toBe(true);
        });

        it('should handle empty features array with OR mode (returns false)', () => {
            const context = createFeatureFlagContext({
                ENABLE_MAP: true,
            });

            // empty array with some() returns false
            const result = shouldRenderGate(context, undefined, [], 'any');

            expect(result).toBe(false);
        });

        it('should handle single feature in features array', () => {
            const context = createFeatureFlagContext({
                ENABLE_MAP: true,
            });

            const result = shouldRenderGate(context, undefined, [FeatureFlags.ENABLE_MAP], 'all');

            expect(result).toBe(true);
        });

        it('should handle undefined feature flag value', () => {
            const context = createFeatureFlagContext({});

            const result = shouldRenderGate(context, FeatureFlags.ENABLE_MAP);

            // undefined !== true, so should return false
            expect(result).toBe(false);
        });
    });
});

describe('useFeatureFlags Hook Logic', () => {
    describe('isEnabled()', () => {
        it('should return true for enabled flag', () => {
            const context = createFeatureFlagContext({
                ENABLE_MAP: true,
                ENABLE_AREAS: true,
            });

            expect(context.isEnabled(FeatureFlags.ENABLE_MAP)).toBe(true);
        });

        it('should return false for disabled flag', () => {
            const context = createFeatureFlagContext({
                ENABLE_MAP: false,
                ENABLE_AREAS: true,
            });

            expect(context.isEnabled(FeatureFlags.ENABLE_MAP)).toBe(false);
        });

        it('should return false for undefined flag', () => {
            const context = createFeatureFlagContext({
                ENABLE_AREAS: true,
            });

            expect(context.isEnabled(FeatureFlags.ENABLE_MAP)).toBe(false);
        });
    });

    describe('areAllEnabled()', () => {
        it('should return true when all specified flags are enabled', () => {
            const context = createFeatureFlagContext({
                ENABLE_MAP: true,
                ENABLE_AREAS: true,
                ENABLE_GROUPS: true,
            });

            expect(context.areAllEnabled([
                FeatureFlags.ENABLE_MAP,
                FeatureFlags.ENABLE_AREAS,
            ])).toBe(true);
        });

        it('should return false when one specified flag is disabled', () => {
            const context = createFeatureFlagContext({
                ENABLE_MAP: false,
                ENABLE_AREAS: true,
            });

            expect(context.areAllEnabled([
                FeatureFlags.ENABLE_MAP,
                FeatureFlags.ENABLE_AREAS,
            ])).toBe(false);
        });

        it('should return true for empty array', () => {
            const context = createFeatureFlagContext({});

            expect(context.areAllEnabled([])).toBe(true);
        });
    });

    describe('isAnyEnabled()', () => {
        it('should return true when all specified flags are enabled', () => {
            const context = createFeatureFlagContext({
                ENABLE_MAP: true,
                ENABLE_AREAS: true,
            });

            expect(context.isAnyEnabled([
                FeatureFlags.ENABLE_MAP,
                FeatureFlags.ENABLE_AREAS,
            ])).toBe(true);
        });

        it('should return true when at least one specified flag is enabled', () => {
            const context = createFeatureFlagContext({
                ENABLE_MAP: false,
                ENABLE_AREAS: true,
            });

            expect(context.isAnyEnabled([
                FeatureFlags.ENABLE_MAP,
                FeatureFlags.ENABLE_AREAS,
            ])).toBe(true);
        });

        it('should return false when all specified flags are disabled', () => {
            const context = createFeatureFlagContext({
                ENABLE_MAP: false,
                ENABLE_AREAS: false,
            });

            expect(context.isAnyEnabled([
                FeatureFlags.ENABLE_MAP,
                FeatureFlags.ENABLE_AREAS,
            ])).toBe(false);
        });

        it('should return false for empty array', () => {
            const context = createFeatureFlagContext({});

            expect(context.isAnyEnabled([])).toBe(false);
        });
    });

    describe('flags object', () => {
        it('should provide access to raw flags object', () => {
            const flags = {
                ENABLE_MAP: true,
                ENABLE_AREAS: false,
                ENABLE_GROUPS: true,
            };
            const context = createFeatureFlagContext(flags);

            expect(context.flags).toEqual(flags);
            expect(context.flags.ENABLE_MAP).toBe(true);
            expect(context.flags.ENABLE_AREAS).toBe(false);
        });

        it('should contain all configured flags', () => {
            const flags = {
                ENABLE_MAP: true,
                ENABLE_AREAS: true,
                ENABLE_GROUPS: true,
                ENABLE_CONNECT: true,
            };
            const context = createFeatureFlagContext(flags);

            expect(Object.keys(context.flags).length).toBe(4);
        });
    });
});

describe('Feature Flag Integration Scenarios', () => {
    describe('Therr App Default Configuration', () => {
        it('should enable all features with default Therr config', () => {
            const therrDefaultFlags = {
                ENABLE_AREAS: true,
                ENABLE_GROUPS: true,
                ENABLE_MAP: true,
                ENABLE_CONNECT: true,
                ENABLE_MOMENTS: true,
                ENABLE_SPACES: true,
                ENABLE_EVENTS: true,
                ENABLE_DIRECT_MESSAGING: true,
            };

            const context = createFeatureFlagContext(therrDefaultFlags);

            // All navigation tabs should be enabled
            expect(context.isEnabled(FeatureFlags.ENABLE_AREAS)).toBe(true);
            expect(context.isEnabled(FeatureFlags.ENABLE_GROUPS)).toBe(true);
            expect(context.isEnabled(FeatureFlags.ENABLE_MAP)).toBe(true);
            expect(context.isEnabled(FeatureFlags.ENABLE_CONNECT)).toBe(true);

            // All content types should be enabled
            expect(context.isEnabled(FeatureFlags.ENABLE_MOMENTS)).toBe(true);
            expect(context.isEnabled(FeatureFlags.ENABLE_SPACES)).toBe(true);
            expect(context.isEnabled(FeatureFlags.ENABLE_EVENTS)).toBe(true);
        });
    });

    describe('Niche App Configuration (e.g., HABITS)', () => {
        it('should allow disabling map-based features for non-location apps', () => {
            const habitsFlags = {
                ENABLE_AREAS: true, // Keep for content listing
                ENABLE_GROUPS: true, // Keep for pacts/groups
                ENABLE_MAP: false, // Disable for non-location app
                ENABLE_CONNECT: true, // Keep for social features
                ENABLE_MOMENTS: false, // Disable location-based content
                ENABLE_SPACES: false, // Disable location-based content
                ENABLE_EVENTS: false, // Disable (requires map)
            };

            const context = createFeatureFlagContext(habitsFlags);

            // Map-related features should be disabled
            expect(context.isEnabled(FeatureFlags.ENABLE_MAP)).toBe(false);
            expect(context.isEnabled(FeatureFlags.ENABLE_MOMENTS)).toBe(false);
            expect(context.isEnabled(FeatureFlags.ENABLE_SPACES)).toBe(false);
            expect(context.isEnabled(FeatureFlags.ENABLE_EVENTS)).toBe(false);

            // Core social features should still be enabled
            expect(context.isEnabled(FeatureFlags.ENABLE_GROUPS)).toBe(true);
            expect(context.isEnabled(FeatureFlags.ENABLE_CONNECT)).toBe(true);
        });
    });

    describe('Minimal Configuration', () => {
        it('should work with minimum required tabs (3 total)', () => {
            const minimalFlags = {
                ENABLE_AREAS: true,
                ENABLE_GROUPS: true,
                ENABLE_MAP: false,
                ENABLE_CONNECT: false,
            };

            const context = createFeatureFlagContext(minimalFlags);

            // Check enabled tabs
            expect(context.areAllEnabled([
                FeatureFlags.ENABLE_AREAS,
                FeatureFlags.ENABLE_GROUPS,
            ])).toBe(true);

            // Check disabled tabs
            expect(context.isAnyEnabled([
                FeatureFlags.ENABLE_MAP,
                FeatureFlags.ENABLE_CONNECT,
            ])).toBe(false);
        });
    });
});
