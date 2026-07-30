import React, { useState } from 'react';
import { View, Text, SafeAreaView, ScrollView, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import { IUserState, IHabitsState, IHabitGoal, IPact } from 'therr-react/types';
import { Button } from '../BaseButton';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import { bottomSafeAreaInset } from '../../styles/navigation/buttonMenu';
import { space } from '../../styles/layouts/spacing';
import translator from '../../utilities/translator';
import BaseStatusBar from '../BaseStatusBar';

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
}

const PactStepper: React.FC<IStepperProps> = ({ activeStep, themeHabits, translate }) => {
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
                    <View key={stepNum} style={themeHabits.styles.stepperItem}>
                        {!isLast && (
                            <View
                                style={[
                                    themeHabits.styles.stepperConnector,
                                    isDone && themeHabits.styles.stepperConnectorActive,
                                ]}
                            />
                        )}
                        <View
                            accessibilityRole="text"
                            accessibilityLabel={`${step.label}. ${translate(
                                isDone
                                    ? 'pages.pacts.preview.stepDone'
                                    : 'pages.pacts.preview.stepOf',
                                { current: stepNum, total: steps.length },
                            )}`}
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
                    </View>
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
    const sampleHabitName = prestagedTemplate?.name || translate('pages.pacts.preview.sampleHabitTitle');
    const sampleHabitSubtitle = prestagedTemplate
        ? translate('pages.pacts.preview.prestagedSuffix')
        : translate('pages.pacts.preview.sampleHabitSubtitle');

    const outgoingInvites = findOutgoingInvites(habits, user.details?.id || '');
    const hasOutgoing = outgoingInvites.length > 0;
    const hasPendingInvite = (habits.pendingInvites?.length || 0) > 0;

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

    const handleViewSent = () => {
        navigation.navigate('PactsList', { initialTab: 'outgoing' });
    };

    const handleViewPending = () => {
        navigation.navigate('PactsList', { initialTab: 'pending' });
    };

    return (
        <>
            <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
            <SafeAreaView style={[theme.styles.safeAreaView, themeHabits.styles.dashboardContainer]}>
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

                    <PactStepper
                        activeStep={activeStep}
                        themeHabits={themeHabits}
                        translate={translate}
                    />

                    <View style={themeHabits.styles.habitCardContainer}>
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
                        </View>
                        <Text style={themeHabits.styles.onboardingCardFooter}>
                            {'🔒 '}
                            {translate('pages.pacts.preview.sampleStreakLabel')}
                        </Text>
                    </View>

                    <View style={themeHabits.styles.habitCardContainer}>
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
                    </View>

                    <View style={themeHabits.styles.habitCardContainer}>
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
                    </View>
                </ScrollView>

                <View
                    onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
                    style={[
                        themeHabits.styles.onboardingFooter,
                        { paddingBottom: space.lg + bottomSafeAreaInset },
                    ]}
                >
                    <Text style={themeHabits.styles.onboardingFooterHelper}>
                        {translate('pages.pacts.preview.bannerHelper')}
                    </Text>
                    <Button
                        buttonStyle={themeButtons.styles.btnLargeWithText}
                        titleStyle={themeButtons.styles.btnLargeTitle}
                        title={translate('pages.pacts.preview.bannerCTA')}
                        onPress={handleInvite}
                    />
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
                            onPress={handleViewPending}
                            style={themeHabits.styles.onboardingFooterSecondary}
                        >
                            <Text style={themeHabits.styles.onboardingFooterSecondaryText}>
                                {translate('pages.pacts.onboarding.viewInvites', { count: habits.pendingInvites!.length })}
                            </Text>
                        </Pressable>
                    )}
                </View>
            </SafeAreaView>
        </>
    );
};

export default PactPreviewOverlay;
