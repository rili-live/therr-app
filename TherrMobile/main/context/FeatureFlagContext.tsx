import React, { createContext, useContext, useMemo } from 'react';
import { FeatureFlags } from 'therr-js-utilities/constants';
import getConfig from '../utilities/getConfig';
import { assertValidFeatureFlags } from '../utilities/validateFeatureFlags';

interface IFeatureFlagContext {
    flags: Record<string, boolean>;
    isEnabled: (flag: FeatureFlags) => boolean;
    areAllEnabled: (flags: FeatureFlags[]) => boolean;
    isAnyEnabled: (flags: FeatureFlags[]) => boolean;
}

const FeatureFlagContext = createContext<IFeatureFlagContext | null>(null);

interface IFeatureFlagProviderProps {
    children: React.ReactNode;
}

export const FeatureFlagProvider: React.FC<IFeatureFlagProviderProps> = ({ children }) => {
    // Feature flags are loaded from config (compile-time constant)
    // Using useMemo to ensure stable reference
    const featureFlags = useMemo(() => {
        const config = getConfig();
        return config.featureFlags || {};
    }, []);

    // Validate feature flags on initialization (throws in dev mode)
    useMemo(() => {
        assertValidFeatureFlags(featureFlags);
    }, [featureFlags]);

    const value = useMemo(() => ({
        flags: featureFlags,
        isEnabled: (flag: FeatureFlags) => featureFlags[flag] === true,
        areAllEnabled: (flags: FeatureFlags[]) => flags.every(f => featureFlags[f] === true),
        isAnyEnabled: (flags: FeatureFlags[]) => flags.some(f => featureFlags[f] === true),
    }), [featureFlags]);

    return (
        <FeatureFlagContext.Provider value={value}>
            {children}
        </FeatureFlagContext.Provider>
    );
};

export const useFeatureFlags = (): IFeatureFlagContext => {
    const context = useContext(FeatureFlagContext);
    if (!context) {
        throw new Error('useFeatureFlags must be used within FeatureFlagProvider');
    }
    return context;
};

export default FeatureFlagContext;
