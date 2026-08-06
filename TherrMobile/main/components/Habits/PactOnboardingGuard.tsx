import React, { useEffect, useRef } from 'react';
import { connect } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IUserState, IHabitsState } from 'therr-react/types';
import { CURRENT_BRAND_VARIATION } from '../../config/brandConfig';
import { BrandVariations, FeatureFlags } from 'therr-js-utilities/constants';
import { useFeatureFlags } from '../../context/FeatureFlagContext';
import PactPreviewOverlay, { HABITS_PRESTAGED_TEMPLATE_ID } from './PactPreviewOverlay';

interface IPactOnboardingGuardProps {
    user: IUserState;
    habits: IHabitsState;
    navigation: any;
    children: React.ReactNode;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    habits: state.habits,
});

/**
 * Soft-gates the Habits dashboard for HABITS users without an active pact.
 * Renders <PactPreviewOverlay/> in place of children to show what's behind the
 * gate (sample habit + partner row + benefits) and route the user into the
 * pact-invite wizard. Once activePacts becomes non-empty, the gate releases
 * and any client-side pre-staged template marker is cleared.
 */
const PactOnboardingGuard: React.FC<IPactOnboardingGuardProps> = ({
    user,
    habits,
    navigation,
    children,
}) => {
    const { isEnabled } = useFeatureFlags();
    const activePactCount = habits.activePacts?.length || 0;
    const previousActivePactCount = useRef<number>(activePactCount);

    const guardActive = CURRENT_BRAND_VARIATION === BrandVariations.HABITS
        && isEnabled(FeatureFlags.REQUIRE_PACT_ONBOARDING)
        && user.isAuthenticated;
    const hasActivePact = activePactCount > 0;

    // Depend on the length, not the array reference, so unrelated Redux
    // dispatches that recreate `activePacts` don't re-run this effect.
    useEffect(() => {
        const previous = previousActivePactCount.current;
        if (previous === 0 && activePactCount > 0) {
            AsyncStorage.removeItem(HABITS_PRESTAGED_TEMPLATE_ID).catch(() => {});
        }
        previousActivePactCount.current = activePactCount;
    }, [activePactCount]);

    if (!guardActive || hasActivePact) {
        return <>{children}</>;
    }

    return (
        <PactPreviewOverlay
            user={user}
            habits={habits}
            navigation={navigation}
        />
    );
};

export default connect(mapStateToProps)(PactOnboardingGuard);
