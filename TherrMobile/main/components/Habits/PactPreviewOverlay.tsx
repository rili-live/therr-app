import React, { useState } from 'react';
import { View, Text, SafeAreaView, ScrollView, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IUserState, IHabitsState, IHabitGoal, IPact } from 'therr-react/types';
import { Button } from '../BaseButton';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
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

const PactPreviewOverlay: React.FC<IPactPreviewOverlayProps> = ({
    user,
    habits,
    navigation,
}) => {
    const [prestagedId, setPrestagedId] = useState<string | null>(null);
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
    const sampleHabitName = prestagedTemplate?.name || translate('pages.pacts.preview.sampleHabitTitle');
    const sampleHabitSubtitle = prestagedTemplate
        ? translate('pages.pacts.preview.prestagedSuffix')
        : translate('pages.pacts.preview.sampleHabitSubtitle');

    const outgoingInvites = findOutgoingInvites(habits, user.details?.id || '');
    const hasOutgoing = outgoingInvites.length > 0;
    const hasPendingInvite = (habits.pendingInvites?.length || 0) > 0;

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
                <ScrollView contentContainerStyle={{ paddingBottom: 180 }}>
                    <View style={themeHabits.styles.dashboardHeader}>
                        <Text style={themeHabits.styles.dashboardGreeting}>
                            {translate('pages.pacts.onboarding.title')}
                        </Text>
                        <Text style={themeHabits.styles.dashboardSubtitle}>
                            {translate('pages.pacts.preview.bannerSubtitle')}
                        </Text>
                    </View>

                    <View style={[themeHabits.styles.habitCardContainer, { opacity: 0.85 }]}>
                        <View style={themeHabits.styles.habitCardHeader}>
                            <Text style={themeHabits.styles.habitCardEmoji}>{sampleEmoji}</Text>
                            <View style={themeHabits.styles.habitCardTitleContainer}>
                                <Text style={themeHabits.styles.habitCardTitle}>{sampleHabitName}</Text>
                                <Text style={themeHabits.styles.habitCardSubtitle}>{sampleHabitSubtitle}</Text>
                            </View>
                            <Text style={{ fontSize: 22 }}>{'🔒'}</Text>
                        </View>
                        <Text style={[themeHabits.styles.streakMilestoneText, { marginTop: 8 }]}>
                            {translate('pages.pacts.preview.sampleStreakLabel')}
                        </Text>
                    </View>

                    <View style={[themeHabits.styles.habitCardContainer, { opacity: 0.85, flexDirection: 'row', alignItems: 'center' }]}>
                        <View style={[themeHabits.styles.pactPartnerAvatar, { marginRight: 12 }]}>
                            <Text>{'👤'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={themeHabits.styles.habitCardTitle}>
                                {translate('pages.pacts.preview.samplePartnerName')}
                            </Text>
                            <Text style={themeHabits.styles.habitCardSubtitle}>
                                {translate('pages.pacts.onboarding.benefit2')}
                            </Text>
                        </View>
                    </View>

                    <View style={[themeHabits.styles.emptyStateContainer, { paddingTop: 16 }]}>
                        <Text style={[themeHabits.styles.habitCardSubtitle, { textAlign: 'center', fontWeight: '600' }]}>
                            {translate('pages.pacts.onboarding.whyPacts')}
                        </Text>
                        <Text style={[themeHabits.styles.streakMilestoneText, { marginTop: 8 }]}>
                            {'✅'} {translate('pages.pacts.onboarding.benefit1')}
                        </Text>
                        <Text style={[themeHabits.styles.streakMilestoneText, { marginTop: 4 }]}>
                            {'✅'} {translate('pages.pacts.onboarding.benefit2')}
                        </Text>
                        <Text style={[themeHabits.styles.streakMilestoneText, { marginTop: 4 }]}>
                            {'✅'} {translate('pages.pacts.onboarding.benefit3')}
                        </Text>
                    </View>
                </ScrollView>

                <View
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        backgroundColor: theme.colors.brandingWhite,
                        borderTopLeftRadius: 16,
                        borderTopRightRadius: 16,
                        padding: 20,
                        shadowColor: theme.colors.textBlack,
                        shadowOffset: { width: 0, height: -2 },
                        shadowOpacity: 0.12,
                        shadowRadius: 8,
                        elevation: 6,
                    }}
                >
                    <Text style={[themeHabits.styles.dashboardGreeting, { fontSize: 18, textAlign: 'center' }]}>
                        {translate('pages.pacts.preview.bannerTitle')}
                    </Text>
                    <Button
                        buttonStyle={[themeButtons.styles.btnLargeWithText, { marginTop: 12 }]}
                        titleStyle={themeButtons.styles.btnLargeTitle}
                        title={translate('pages.pacts.preview.bannerCTA')}
                        onPress={handleInvite}
                    />
                    {hasOutgoing && (
                        <Pressable onPress={handleViewSent} style={{ marginTop: 12, alignItems: 'center' }}>
                            <Text style={themeButtons.styles.btnTitleBlack}>
                                {translate('pages.pacts.preview.bannerSecondaryCTA')}
                            </Text>
                        </Pressable>
                    )}
                    {hasPendingInvite && (
                        <Pressable onPress={handleViewPending} style={{ marginTop: 12, alignItems: 'center' }}>
                            <Text style={themeButtons.styles.btnTitleBlack}>
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
