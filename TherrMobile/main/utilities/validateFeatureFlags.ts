import { FeatureFlags } from 'therr-js-utilities/constants';

interface IFeatureDependency {
    feature: FeatureFlags;
    requires: FeatureFlags[];
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

export const validateFeatureFlags = (flags: Record<string, boolean>): string[] => {
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

// Call in dev mode to alert developers - THROWS ERRORS (fail fast)
export const assertValidFeatureFlags = (flags: Record<string, boolean>) => {
    if (__DEV__) {
        const errors = validateFeatureFlags(flags);
        if (errors.length > 0) {
            console.error('Feature Flag Configuration Errors:', errors);
            throw new Error(`Invalid feature flag configuration:\n${errors.join('\n')}`);
        }
    }
};

export default {
    validateFeatureFlags,
    assertValidFeatureFlags,
};
