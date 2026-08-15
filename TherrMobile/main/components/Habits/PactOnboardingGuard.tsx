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
 * Either an active pact, OR an invite the user has sent that nobody has
 * accepted yet. The second condition was added with solo habits: gating purely
 * on acceptance made a user's own progress depend on someone else's action, and
 * a friend who installed the app a week later — or never — left the inviter
 * parked here indefinitely with nothing they could do about it.
 *
 * The invite requirement itself is unchanged: the user still has to pick a
 * habit, pick a person and send the invitation. What changed is that the friend
 * saying yes is no longer the thing standing between them and their own habits.
 * The server enforces the same rule on `POST /habits/user-habits`, so this is
 * the UI half of a gate rather than the gate itself.
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
    const hasStarted = hasActivePact || hasSentInvite;

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
