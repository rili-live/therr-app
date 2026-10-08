import React, { useRef, useState } from 'react';
import {
    Animated, View, Text, ScrollView, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import Toast from 'react-native-toast-message';
import { FeatureFlags } from 'therr-js-utilities/constants';
import { IUserState, IHabitsState, IHabitGoal, IPact } from 'therr-react/types';
import { Button } from '../BaseButton';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import { bottomSafeAreaInset } from '../../styles/navigation/buttonMenu';
import { space } from '../../styles/layouts/spacing';
import translator from '../../utilities/translator';
import { getSoloUnlockProgress } from '../../utilities/soloHabitUnlock';
import getConfig from '../../utilities/getConfig';
import { logAppEvent } from '../../utilities/analyticsEvents';
import { localizeTemplate } from '../../routes/Pacts/habitTemplates';
import BaseStatusBar from '../BaseStatusBar';
import { getOnboardingTapAction, OnboardingStepNumber } from './onboardingTapAction';

export const HABITS_PRESTAGED_TEMPLATE_ID = 'HABITS_PRESTAGED_TEMPLATE_ID';

interface IPactPreviewOverlayProps {
    user: IUserState;
    habits: IHabitsState;
    navigation: any;
}

const findOutgoingInvites = (habits: IHabitsState, currentUserId: string): IPact[] => {
    if (!habits.pacts) return [];
    return habits.pacts.filter(
        (p) => p.status === 'pending' && p.creatorUserId === currentUserId,
    );
};

const findTemplate = (templates: IHabitGoal[] | undefined, id: string): IHabitGoal | undefined => {
    if (!templates) return undefined;
    return templates.find((t) => t.id === id);
};

interface IStepperProps {
    activeStep: number;
    themeHabits: any;
    translate: (key: string, params?: any) => string;
    onPressStep: (step: OnboardingStepNumber) => void;
}

const PactStepper: React.FC<IStepperProps> = ({
    activeStep, themeHabits, translate, onPressStep,
}) => {
    const steps = [
        { label: translate('pages.pacts.preview.step1Label'), sublabel: translate('pages.pacts.preview.step1Sublabel') },
        { label: translate('pages.pacts.preview.step2Label'), sublabel: translate('pages.pacts.preview.step2Sublabel') },
        { label: translate('pages.pacts.preview.step3Label'), sublabel: translate('pages.pacts.preview.step3Sublabel') },
    ];

    return (
        <View style={themeHabits.styles.stepperContainer}>
            {steps.map((step, index) => {
                const stepNum = index + 1;
                // Three distinct states, where there used to effectively be
                // one: steps already behind the user, the step they are on,
                // and steps still ahead.
                const isDone = stepNum < activeStep;
                const isCurrent = stepNum === activeStep;
                const isLast = index === steps.length - 1;
                return (
                    // Every step answers a tap — see `onboardingTapAction` for why.
                    <Pressable
                        key={stepNum}
                        onPress={() => onPressStep(stepNum as OnboardingStepNumber)}
                        accessibilityRole="button"
                        accessibilityLabel={`${step.label}. ${translate(
                            isDone
                                ? 'pages.pacts.preview.stepDone'
                                : 'pages.pacts.preview.stepOf',
                            { current: stepNum, total: steps.length },
                        )}`}
                        style={themeHabits.styles.stepperItem}
                    >
                        {!isLast && (
                            <View
                                style={[
                                    themeHabits.styles.stepperConnector,
                                    isDone && themeHabits.styles.stepperConnectorActive,
                                ]}
                            />
                        )}
                        <View
                            style={[
                                themeHabits.styles.stepperCircle,
                                isCurrent && themeHabits.styles.stepperCircleCurrent,
                                isDone && themeHabits.styles.stepperCircleDone,
                            ]}
                        >
                            {isDone
                                ? <FontAwesome5Icon name="check" size={13} color={themeHabits.colors.onBrand} />
                                : (
                                    <Text
                                        style={[
                                            themeHabits.styles.stepperCircleNumber,
                                            isCurrent && themeHabits.styles.stepperCircleNumberCurrent,
                                        ]}
                                    >
                                        {stepNum}
                                    </Text>
                                )}
                        </View>
                        <Text
                            style={[
                                themeHabits.styles.stepperLabel,
                                (isDone || isCurrent) && themeHabits.styles.stepperLabelActive,
                            ]}
                        >
                            {step.label}
                        </Text>
                        <Text style={themeHabits.styles.stepperSublabel}>{step.sublabel}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
};

interface IOnboardingCardHeaderProps {
    stepNum: number;
    activeStep: number;
    label: string;
    themeHabits: any;
}

/**
 * The step index lives inside the card it describes. It previously sat in a
 * separate "Step N of 3" badge floating above each card, which restated the
 * stepper immediately above it — the same three numbers rendered twice on one
 * screen.
 */
const OnboardingCardHeader: React.FC<IOnboardingCardHeaderProps> = ({
    stepNum,
    activeStep,
    label,
    themeHabits,
}) => {
    const isDone = stepNum < activeStep;

    return (
        <View style={themeHabits.styles.onboardingCardHeaderRow}>
            <View
                style={[
                    themeHabits.styles.onboardingCardStepIndex,
                    isDone && themeHabits.styles.onboardingCardStepIndexDone,
                ]}
            >
                {isDone
                    ? <FontAwesome5Icon name="check" size={10} color={themeHabits.colors.onBrand} />
                    : (
                        <Text
                            style={[
                                themeHabits.styles.onboardingCardStepIndexText,
                                isDone && themeHabits.styles.onboardingCardStepIndexTextDone,
                            ]}
                        >
                            {stepNum}
                        </Text>
                    )}
            </View>
            <Text style={themeHabits.styles.onboardingCardHeader} numberOfLines={1}>
                {label}
            </Text>
        </View>
    );
};

const PactPreviewOverlay: React.FC<IPactPreviewOverlayProps> = ({
    user,
    habits,
    navigation,
}) => {
    const [prestagedId, setPrestagedId] = useState<string | null>(null);
    // The scroll padding used to be a hardcoded 240 + inset, which was shorter
    // than the sticky footer once the secondary CTAs appear — the step 3 card
    // sat underneath it and could not be scrolled into view. Measuring the
    // footer keeps the two in sync no matter which CTAs render.
    const [footerHeight, setFooterHeight] = useState<number>(0);
    const theme = buildStyles(user.settings?.mobileThemeName);
    const themeButtons = buildButtonStyles(user.settings?.mobileThemeName);
    const themeHabits = buildHabitStyles(user.settings?.mobileThemeName);
    const translate = (key: string, params?: any) =>
        translator(user.settings?.locale || 'en-us', key, params);

    const loadPrestaged = async () => {
        try {
            const id = await AsyncStorage.getItem(HABITS_PRESTAGED_TEMPLATE_ID);
            setPrestagedId(id);
        } catch {
            setPrestagedId(null);
        }
    };

    // useFocusEffect fires on initial focus AND on every re-focus, which
    // covers the mount case the prior useEffect was redundantly handling.
    useFocusEffect(
        React.useCallback(() => {
            loadPrestaged();
        }, []),
    );

    const prestagedTemplate = prestagedId ? findTemplate(habits.templates, prestagedId) : undefined;
    const sampleEmoji = prestagedTemplate?.emoji || translate('pages.pacts.wizard.habitDefaultEmoji');
    const hasPrestagedHabit = !!prestagedTemplate;
    const sampleHabitName = (prestagedTemplate && localizeTemplate(prestagedTemplate, translate).name)
        || translate('pages.pacts.preview.sampleHabitTitle');
    const sampleHabitSubtitle = prestagedTemplate
        ? translate('pages.pacts.preview.prestagedSuffix')
        : translate('pages.pacts.preview.sampleHabitSubtitle');

    const outgoingInvites = findOutgoingInvites(habits, user.details?.id || '');
    const hasOutgoing = outgoingInvites.length > 0;
    const hasPendingInvite = (habits.pendingInvites?.length || 0) > 0;
    // Newest first (the server orders by createdAt desc). Only one is shown; the pending tab the
    // button opens lists them all.
    const firstPendingInvite = habits.pendingInvites?.[0];

    // Active step drives the stepper highlight: prestaged habit advances to step 2,
    // an already-sent invite advances to step 3 (waiting for acceptance).
    let activeStep = 1;
    if (hasOutgoing) {
        activeStep = 3;
    } else if (hasPrestagedHabit) {
        activeStep = 2;
    }

    const handleInvite = () => {
        navigation.navigate('CreatePactInvite');
    };

    // `mode: 'solo'` takes the user through the same wizard minus the partner
    // step. Only offered once unlocked — see the footer, which otherwise shows
    // how many invites are left instead.
    const handleStartSolo = () => {
        navigation.navigate('CreatePactInvite', { mode: 'solo' });
    };

    // This overlay is the whole of onboarding, which makes it the one place the
    // invite requirement can be explained before it is enforced. Showing the
    // remaining count here is what turns "you must invite people" into a target
    // worth finishing; a user who only meets the rule at the moment it blocks
    // them has already formed the impression that the app is stonewalling.
    const soloUnlock = getSoloUnlockProgress(
        habits.userHabitEligibility,
        getConfig().featureFlags?.[FeatureFlags.ENABLE_HABITS_SOLO] === true,
    );

    // Both land on the dashboard's pact segments. The `initialTab` is what tells
    // `PactOnboardingGuard` to stand down for that visit — without it a user who
    // has not started yet would be handed straight back to this overlay.
    const handleViewSent = () => {
        navigation.navigate('HabitsDashboard', { initialTab: 'outgoing' });
    };

    const handleViewPending = () => {
        navigation.navigate('HabitsDashboard', { initialTab: 'pending' });
    };

    // A friend's invite is the fastest way past this screen, and the one that leads to a habit that
    // sticks: in production, 20 of 21 users whose pact was accepted went on to check in, while
    // invitees who never answered almost never did. It used to sit below the footer as a small text
    // link under "pick a habit & invite a friend" — asking someone who already had an invite to go
    // and send one. So when one is waiting it leads, and starting a pact of their own is secondary.
    // Accepting happens on the pending tab, which already owns the paywall, toast and refresh.
    const handleRespondToInvite = () => {
        logAppEvent('habits_onboarding_invite_open', {
            userId: user.details?.id,
            inviteCount: habits.pendingInvites?.length || 0,
        });
        handleViewPending();
    };

    // Draws the eye to the one control that moves the user forward, after a tap
    // on something that cannot. Native driver: transform only, no layout.
    const ctaScale = useRef(new Animated.Value(1)).current;
    const pulseCta = () => {
        ctaScale.stopAnimation();
        ctaScale.setValue(1);
        Animated.sequence([
            Animated.timing(ctaScale, { toValue: 1.06, duration: 140, useNativeDriver: true }),
            Animated.spring(ctaScale, { toValue: 1, friction: 3, tension: 120, useNativeDriver: true }),
        ]).start();
    };

    // See `onboardingTapAction` for the rule. The event is how we learn whether
    // anyone still gets stuck here — taps on step 2/3 before an invite is the
    // confusion the user test surfaced.
    const handleStepPress = (step: OnboardingStepNumber) => {
        const action = getOnboardingTapAction(step, { hasOutgoingInvite: hasOutgoing });

        logAppEvent('habits_onboarding_step_tap', {
            userId: user.details?.id,
            step,
            activeStep,
            action,
        });

        if (action === 'openWizard') {
            Toast.show({
                type: 'info',
                text1: translate('pages.pacts.preview.pickHabitToastTitle'),
                text2: translate('pages.pacts.preview.pickHabitToastBody'),
            });
            handleInvite();
            return;
        }

        if (action === 'viewSentInvites') {
            handleViewSent();
            return;
        }

        Toast.show({
            type: 'info',
            text1: translate('pages.pacts.preview.inviteGateToastTitle'),
            text2: translate('pages.pacts.preview.inviteGateToastBody'),
            onPress: () => {
                Toast.hide();
                handleInvite();
            },
        });
        pulseCta();
    };

    return (
        <>
            <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
            {/* `edges={[]}`: this overlay already adds `bottomSafeAreaInset` to its own
                content padding below, so a second inset here would double it. */}
            <SafeAreaView
                edges={[]}
                style={[theme.styles.safeAreaView, themeHabits.styles.dashboardContainer]}
            >
                <ScrollView
                    contentContainerStyle={{
                        paddingBottom: (footerHeight || 220) + bottomSafeAreaInset,
                    }}
                >
                    <View style={themeHabits.styles.dashboardHeader}>
                        <Text style={themeHabits.styles.dashboardGreeting}>
                            {translate('pages.pacts.preview.bannerTitle')}
                        </Text>
                        <Text style={themeHabits.styles.dashboardSubtitle}>
                            {translate('pages.pacts.preview.bannerSubtitle')}
                        </Text>
                    </View>

                    {firstPendingInvite && (
                        <Pressable
                            onPress={handleRespondToInvite}
                            accessibilityRole="button"
                            accessibilityHint={translate('pages.pacts.preview.respondToInviteCTA')}
                            style={themeHabits.styles.habitCardContainer}
                        >
                            <Text style={themeHabits.styles.onboardingCardFooter}>
                                {translate('pages.pacts.preview.invitedCardHeader')}
                            </Text>
                            <View style={themeHabits.styles.habitCardHeader}>
                                <View style={themeHabits.styles.habitCardEmojiContainer}>
                                    <Text style={themeHabits.styles.habitCardEmojiContained}>
                                        {firstPendingInvite.habitGoalEmoji || '\uD83E\uDD1D'}
                                    </Text>
                                </View>
                                <View style={themeHabits.styles.habitCardTitleContainer}>
                                    <Text style={themeHabits.styles.onboardingCardTitle}>
                                        {firstPendingInvite.habitGoalName || translate('pages.pacts.defaultTitle')}
                                    </Text>
                                    <Text style={themeHabits.styles.onboardingCardBody}>
                                        {translate('pages.pacts.preview.invitedCardBody')}
                                    </Text>
                                </View>
                                <Text style={themeHabits.styles.habitPickRowChevron}>{'›'}</Text>
                            </View>
                        </Pressable>
                    )}

                    <PactStepper
                        activeStep={activeStep}
                        themeHabits={themeHabits}
                        translate={translate}
                        onPressStep={handleStepPress}
                    />

                    <Pressable
                        onPress={() => handleStepPress(1)}
                        accessibilityRole="button"
                        accessibilityHint={translate('pages.pacts.preview.pickHabitToastTitle')}
                        style={themeHabits.styles.habitCardContainer}
                    >
                        <OnboardingCardHeader
                            stepNum={1}
                            activeStep={activeStep}
                            label={translate('pages.pacts.preview.habitCardHeader')}
                            themeHabits={themeHabits}
                        />
                        <View style={themeHabits.styles.habitCardHeader}>
                            <View style={themeHabits.styles.habitCardEmojiContainer}>
                                <Text style={themeHabits.styles.habitCardEmojiContained}>{sampleEmoji}</Text>
                            </View>
                            <View style={themeHabits.styles.habitCardTitleContainer}>
                                <Text style={themeHabits.styles.onboardingCardTitle}>{sampleHabitName}</Text>
                                <Text style={themeHabits.styles.onboardingCardBody}>{sampleHabitSubtitle}</Text>
                            </View>
                            {/* The one card that is a real action, so it is the one that looks like one. */}
                            <Text style={themeHabits.styles.habitPickRowChevron}>{'›'}</Text>
                        </View>
                        <Text style={themeHabits.styles.onboardingCardFooter}>
                            {'🔒 '}
                            {translate('pages.pacts.preview.sampleStreakLabel')}
                        </Text>
                    </Pressable>

                    <Pressable
                        onPress={() => handleStepPress(2)}
                        accessibilityRole="button"
                        accessibilityHint={translate('pages.pacts.preview.inviteGateToastTitle')}
                        style={themeHabits.styles.habitCardContainer}
                    >
                        <OnboardingCardHeader
                            stepNum={2}
                            activeStep={activeStep}
                            label={translate('pages.pacts.preview.partnerCardHeader')}
                            themeHabits={themeHabits}
                        />
                        <View style={themeHabits.styles.habitCardHeader}>
                            <View style={themeHabits.styles.onboardingCardLeading}>
                                <Text style={themeHabits.styles.onboardingCardLeadingGlyph}>{'👤'}</Text>
                            </View>
                            <View style={themeHabits.styles.habitCardTitleContainer}>
                                <Text style={themeHabits.styles.onboardingCardTitle}>
                                    {translate('pages.pacts.preview.samplePartnerName')}
                                </Text>
                                <Text style={themeHabits.styles.onboardingCardBody}>
                                    {translate('pages.pacts.onboarding.benefit2')}
                                </Text>
                            </View>
                        </View>
                    </Pressable>

                    <Pressable
                        onPress={() => handleStepPress(3)}
                        accessibilityRole="button"
                        accessibilityHint={translate(hasOutgoing
                            ? 'pages.pacts.preview.bannerSecondaryCTA'
                            : 'pages.pacts.preview.inviteGateToastTitle')}
                        style={themeHabits.styles.habitCardContainer}
                    >
                        <OnboardingCardHeader
                            stepNum={3}
                            activeStep={activeStep}
                            label={translate('pages.pacts.preview.pactCardHeader')}
                            themeHabits={themeHabits}
                        />
                        <View style={themeHabits.styles.habitCardHeader}>
                            <View style={themeHabits.styles.onboardingCardLeading}>
                                <Text style={themeHabits.styles.onboardingCardLeadingGlyph}>{'⏳'}</Text>
                            </View>
                            <View style={themeHabits.styles.habitCardTitleContainer}>
                                <Text style={themeHabits.styles.onboardingCardTitle}>
                                    {translate('pages.pacts.preview.samplePactStatus')}
                                </Text>
                            </View>
                        </View>
                    </Pressable>
                </ScrollView>

                <View
                    onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
                    style={[
                        themeHabits.styles.onboardingFooter,
                        { paddingBottom: space.lg + bottomSafeAreaInset },
                    ]}
                >
                    {/* "Pick a habit, then invite a friend" is the other path; the invite card says what this one is. */}
                    {!hasPendingInvite && (
                        <Text style={themeHabits.styles.onboardingFooterHelper}>
                            {translate('pages.pacts.preview.bannerHelper')}
                        </Text>
                    )}
                    <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
                        <Button
                            buttonStyle={themeButtons.styles.btnLargeWithText}
                            titleStyle={themeButtons.styles.btnLargeTitle}
                            title={hasPendingInvite
                                ? translate('pages.pacts.preview.respondToInviteCTA')
                                : translate('pages.pacts.preview.bannerCTA')}
                            onPress={hasPendingInvite ? handleRespondToInvite : handleInvite}
                        />
                    </Animated.View>
                    {hasOutgoing && (
                        <Pressable
                            accessibilityRole="button"
                            onPress={handleViewSent}
                            style={themeHabits.styles.onboardingFooterSecondary}
                        >
                            <Text style={themeHabits.styles.onboardingFooterSecondaryText}>
                                {translate('pages.pacts.preview.bannerSecondaryCTA')}
                            </Text>
                        </Pressable>
                    )}
                    {hasPendingInvite && (
                        <Pressable
                            accessibilityRole="button"
                            onPress={handleInvite}
                            style={themeHabits.styles.onboardingFooterSecondary}
                        >
                            <Text style={themeHabits.styles.onboardingFooterSecondaryText}>
                                {translate('pages.pacts.preview.startOwnPactCTA')}
                            </Text>
                        </Pressable>
                    )}
                    {soloUnlock.isUnlocked && (
                        <Pressable
                            accessibilityRole="button"
                            onPress={handleStartSolo}
                            style={themeHabits.styles.onboardingFooterSecondary}
                        >
                            <Text style={themeHabits.styles.onboardingFooterSecondaryText}>
                                {translate('pages.pacts.preview.soloCTA')}
                            </Text>
                        </Pressable>
                    )}
                    {!soloUnlock.isUnlocked && soloUnlock.hasProgress && (
                        <View style={themeHabits.styles.onboardingFooterSecondary}>
                            <Text style={themeHabits.styles.onboardingFooterSecondaryText}>
                                {translate('pages.pacts.preview.soloUnlockProgress', {
                                    invited: soloUnlock.invitedCount,
                                    required: soloUnlock.requiredCount,
                                })}
                            </Text>
                        </View>
                    )}
                </View>
            </SafeAreaView>
        </>
    );
};

export default PactPreviewOverlay;
