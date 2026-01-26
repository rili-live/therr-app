import React from 'react';
import { FeatureFlags } from 'therr-js-utilities/constants';
import { useFeatureFlags } from '../context/FeatureFlagContext';

interface IFeatureGateProps {
    feature?: FeatureFlags;
    features?: FeatureFlags[];
    mode?: 'all' | 'any';  // AND vs OR logic
    fallback?: React.ReactNode;
    children: React.ReactNode;
}

const FeatureGate: React.FC<IFeatureGateProps> = ({
    feature,
    features,
    mode = 'all',
    fallback = null,
    children,
}) => {
    const { isEnabled, areAllEnabled, isAnyEnabled } = useFeatureFlags();

    let shouldRender = false;

    if (feature) {
        shouldRender = isEnabled(feature);
    } else if (features) {
        shouldRender = mode === 'all'
            ? areAllEnabled(features)
            : isAnyEnabled(features);
    } else {
        // No feature specified, render children
        shouldRender = true;
    }

    return shouldRender ? <>{children}</> : <>{fallback}</>;
};

export default FeatureGate;
