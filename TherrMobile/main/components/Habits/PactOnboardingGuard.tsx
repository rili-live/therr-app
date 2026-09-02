import React, { useEffect, useMemo, useRef } from 'react';
import { connect } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IUserState, IHabitsState } from 'therr-react/types';
import { CURRENT_BRAND_VARIATION } from '../../config/brandConfig';
import { BrandVariations, FeatureFlags } from 'therr-js-utilities/constants';
import { useFeatureFlags } from '../../context/FeatureFlagContext';
import PactPreviewOverlay, { HABITS_PRESTAGED_TEMPLATE_ID } from './PactPreviewOverlay';
import { hasSentPactInvite, hasTrackedHabit } from '../../routes/Habits/pactState';
import { hasStartedHabitsCached, rememberHabitsStarted } from '../../utilities/habitsOnboardingCache';

interface IPactOnboardingGuardProps {
    user: IUserState;
    habits: IHabitsState;
    navigation: any;
    children: React.ReactNode;
    isBypassed?: boolean;
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
 * The last condition matters for personal habits. Starting one navigates
 * straight back here, so a guard that only knew about pacts would drop the user
 * onto this overlay holding a habit it refused to show them. It reads the
 * server's count of habits actually being tracked rather than the local goal
 * list — see `hasTrackedHabit` for why a goal on its own is not a start — and
 * the dashboard beneath already fetches that count on every focus.
 *
 * Note this asks "have you started", which is a different and looser question
 * than "have you unlocked solo habits" — that one takes several invites and is
 * enforced by the server on `POST /habits/user-habits`. A user who has sent one
 * invite is past this overlay and still cannot track alone; the overlay's footer
 * and the dashboard banner are what show them how far they have left to go.
 *
 * `isBypassed` exists because the dashboard now also holds the pact invite
 * lists. A user with an invite waiting has not "started" by any of the tests
 * above, so a blanket gate would answer the notification that told them they
 * have an invite — and this overlay's own link to it — with this overlay.
 *
 * COLD START
 *
 * Every test above reads the `habits` slice, which redux-persist does not
 * whitelist and which is therefore empty until the dashboard's fetches resolve.
 * Left alone, that made an established user's launch flash this overlay for a
 * network round trip. `hasStartedHabitsCached` answers the same question
 * synchronously from MMKV, so the first render already knows — see
 * `utilities/habitsOnboardingCache` for why the cached answer is one-way.
 */
const PactOnboardingGuard: React.FC<IPactOnboardingGuardProps> = ({
    user,
    habits,
    navigation,
    children,
    isBypassed,
}) => {
    const { isEnabled } = useFeatureFlags();
    const activePactCount = habits.activePacts?.length || 0;
    const previousActivePactCount = useRef<number>(activePactCount);
    const userId = user.details?.id;

    // Read once per account rather than per render. Only ever flips false->true,
    // and by the time it would the live `hasStarted` below is already true, so
    // there is nothing for a re-read to catch.
    const wasStartedBeforeLaunch = useMemo(() => hasStartedHabitsCached(userId), [userId]);

    const guardActive = CURRENT_BRAND_VARIATION === BrandVariations.HABITS
        && isEnabled(FeatureFlags.REQUIRE_PACT_ONBOARDING)
        && user.isAuthenticated;
    const hasActivePact = activePactCount > 0;
    const hasSentInvite = hasSentPactInvite(habits.pacts || [], user.details?.id);
    const hasOwnHabit = hasTrackedHabit(
        habits.userHabitEligibility?.activeHabitCount,
        habits.userHabits?.length || 0,
        habits.habitGoals?.length || 0,
    );
    const hasStarted = hasActivePact || hasSentInvite || hasOwnHabit;

    // Write only on the live answer. Seeding from the cached one would let a
    // stale flag re-persist itself forever.
    useEffect(() => {
        if (hasStarted) {
            rememberHabitsStarted(userId);
        }
    }, [hasStarted, userId]);

    // Depend on the length, not the array reference, so unrelated Redux
    // dispatches that recreate `activePacts` don't re-run this effect.
    useEffect(() => {
        const previous = previousActivePactCount.current;
        if (previous === 0 && activePactCount > 0) {
            AsyncStorage.removeItem(HABITS_PRESTAGED_TEMPLATE_ID).catch(() => {});
        }
        previousActivePactCount.current = activePactCount;
    }, [activePactCount]);

    if (!guardActive || isBypassed || hasStarted || wasStartedBeforeLaunch) {
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
