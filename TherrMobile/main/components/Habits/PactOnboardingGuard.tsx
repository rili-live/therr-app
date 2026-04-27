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
    const previousActivePactCount = useRef<number>(habits.activePacts?.length || 0);

    const guardActive = CURRENT_BRAND_VARIATION === BrandVariations.HABITS
        && isEnabled(FeatureFlags.REQUIRE_PACT_ONBOARDING)
        && user.isAuthenticated;
    const hasActivePact = (habits.activePacts?.length || 0) > 0;

    useEffect(() => {
        const previous = previousActivePactCount.current;
        const current = habits.activePacts?.length || 0;
        if (previous === 0 && current > 0) {
            AsyncStorage.removeItem(HABITS_PRESTAGED_TEMPLATE_ID).catch(() => {});
        }
        previousActivePactCount.current = current;
    }, [habits.activePacts]);

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
