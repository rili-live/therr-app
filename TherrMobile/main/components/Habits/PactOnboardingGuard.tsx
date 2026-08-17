import React, { useEffect, useRef } from 'react';
import { connect } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IUserState, IHabitsState } from 'therr-react/types';
import { CURRENT_BRAND_VARIATION } from '../../config/brandConfig';
import { BrandVariations, FeatureFlags } from 'therr-js-utilities/constants';
import { useFeatureFlags } from '../../context/FeatureFlagContext';
import PactPreviewOverlay, { HABITS_PRESTAGED_TEMPLATE_ID } from './PactPreviewOverlay';
import { hasSentPactInvite } from '../../routes/Habits/pactState';

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
 * Soft-gates the Habits dashboard for HABITS users who have not yet started.
 *
 * Renders <PactPreviewOverlay/> in place of children to show what's behind the
 * gate (sample habit + partner row + benefits) and route the user into the
 * pact-invite wizard.
 *
 * WHAT RELEASES THE GATE
 *
 * Any of: an active pact, an invite the user has sent that nobody has accepted
 * yet, or a habit of their own.
 *
 * The last condition is what makes personal habits usable at all. Starting one
 * navigates straight back here, so a gate that only knew about pacts would drop
 * the user onto this overlay holding a habit it refused to show them — the exact
 * dead end the solo path exists to remove. `habitGoals` is the right signal
 * because the dashboard beneath already loads it on every focus, and a goal only
 * comes into existence once the user finishes the wizard one way or the other.
 *
 * This is a soft gate, not the enforcement point: the server no longer requires
 * an invite to start a habit, so nothing here is holding a rule up on its own.
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
    const hasSentInvite = hasSentPactInvite(habits.pacts || [], user.details?.id);
    const hasOwnHabit = (habits.habitGoals?.length || 0) > 0;
    const hasStarted = hasActivePact || hasSentInvite || hasOwnHabit;

    // Depend on the length, not the array reference, so unrelated Redux
    // dispatches that recreate `activePacts` don't re-run this effect.
    useEffect(() => {
        const previous = previousActivePactCount.current;
        if (previous === 0 && activePactCount > 0) {
            AsyncStorage.removeItem(HABITS_PRESTAGED_TEMPLATE_ID).catch(() => {});
        }
        previousActivePactCount.current = activePactCount;
    }, [activePactCount]);

    if (!guardActive || hasStarted) {
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
