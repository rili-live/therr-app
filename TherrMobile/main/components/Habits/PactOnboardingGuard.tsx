import React from 'react';
import { View, Text, SafeAreaView } from 'react-native';
import { connect } from 'react-redux';
import { Button } from 'react-native-elements';
import { IUserState, IHabitsState } from 'therr-react/types';
import { CURRENT_BRAND_VARIATION, getCurrentBrandFeatures } from '../../config/brandConfig';
import { BrandVariations } from 'therr-js-utilities/constants';
import translator from '../../services/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import BaseStatusBar from '../BaseStatusBar';

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
 * Navigation guard that ensures HABITS users have at least one active pact
 * before accessing the main app. This enforces the accountability partnership
 * model that is core to the HABITS app experience.
 */
const PactOnboardingGuard: React.FC<IPactOnboardingGuardProps> = ({
    user,
    habits,
    navigation,
    children,
}) => {
    const features = getCurrentBrandFeatures();
    const translate = (key: string, params?: any) => translator('en-us', key, params);
    const theme = buildStyles(user.settings?.mobileThemeName);
    const themeButtons = buildButtonStyles(user.settings?.mobileThemeName);
    const themeHabits = buildHabitStyles(user.settings?.mobileThemeName);

    // Only apply guard for HABITS brand with requirePactOnboarding enabled
    if (CURRENT_BRAND_VARIATION !== BrandVariations.HABITS || !features.requirePactOnboarding) {
        return <>{children}</>;
    }

    // Check if user is authenticated
    if (!user.isAuthenticated) {
        return <>{children}</>;
    }

    // Check if user has any active pacts or pending invites they can accept
    const hasActivePact = habits.activePacts && habits.activePacts.length > 0;
    const hasPendingInvite = habits.pendingInvites && habits.pendingInvites.length > 0;

    // If user has an active pact, let them through
    if (hasActivePact) {
        return <>{children}</>;
    }

    // Show onboarding screen for users without pacts
    const handleCreatePact = () => {
        navigation.navigate('CreatePact');
    };

    const handleViewInvites = () => {
        navigation.navigate('PactsList');
    };

    const handleFindPartner = () => {
        navigation.navigate('Connect');
    };

    return (
        <>
            <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
            <SafeAreaView style={[theme.styles.safeAreaView, themeHabits.styles.dashboardContainer]}>
                <View style={themeHabits.styles.emptyStateContainer}>
                    <Text style={[themeHabits.styles.emptyStateEmoji, { fontSize: 64 }]}>
                        {'\uD83E\uDD1D'}
                    </Text>
                    <Text style={[themeHabits.styles.dashboardGreeting, { textAlign: 'center', marginTop: 24 }]}>
                        {translate('pages.pacts.onboarding.title')}
                    </Text>
                    <Text style={[themeHabits.styles.dashboardSubtitle, { textAlign: 'center', marginTop: 8, paddingHorizontal: 32 }]}>
                        {translate('pages.pacts.onboarding.subtitle')}
                    </Text>

                    <View style={{ marginTop: 32, width: '100%', paddingHorizontal: 24 }}>
                        <Button
                            buttonStyle={[themeButtons.styles.btnLargeWithText, { width: '100%', marginBottom: 16 }]}
                            titleStyle={themeButtons.styles.btnLargeTitle}
                            title={translate('pages.pacts.onboarding.createPact')}
                            onPress={handleCreatePact}
                        />

                        {hasPendingInvite && (
                            <Button
                                buttonStyle={[themeButtons.styles.btnMediumWithText, { width: '100%', marginBottom: 16 }]}
                                titleStyle={themeButtons.styles.btnMediumTitle}
                                title={translate('pages.pacts.onboarding.viewInvites', { count: habits.pendingInvites.length })}
                                onPress={handleViewInvites}
                            />
                        )}

                        <Button
                            buttonStyle={[themeButtons.styles.btnClear, { width: '100%' }]}
                            titleStyle={themeButtons.styles.btnTitleBlack}
                            title={translate('pages.pacts.onboarding.findPartner')}
                            onPress={handleFindPartner}
                        />
                    </View>

                    <View style={{ marginTop: 48, paddingHorizontal: 32 }}>
                        <Text style={[themeHabits.styles.habitCardSubtitle, { textAlign: 'center' }]}>
                            {translate('pages.pacts.onboarding.whyPacts')}
                        </Text>
                        <View style={{ marginTop: 16 }}>
                            <Text style={[themeHabits.styles.streakMilestoneText, { marginBottom: 8 }]}>
                                {'\u2705'} {translate('pages.pacts.onboarding.benefit1')}
                            </Text>
                            <Text style={[themeHabits.styles.streakMilestoneText, { marginBottom: 8 }]}>
                                {'\u2705'} {translate('pages.pacts.onboarding.benefit2')}
                            </Text>
                            <Text style={[themeHabits.styles.streakMilestoneText, { marginBottom: 8 }]}>
                                {'\u2705'} {translate('pages.pacts.onboarding.benefit3')}
                            </Text>
                        </View>
                    </View>
                </View>
            </SafeAreaView>
        </>
    );
};

export default connect(mapStateToProps)(PactOnboardingGuard);
