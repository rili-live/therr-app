import React from 'react';
import { SafeAreaView, ScrollView, View, Text, Pressable, Platform, PermissionsAndroid } from 'react-native';
import { connect } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee from '@notifee/react-native';
import { IUserState } from 'therr-react/types';
import translator from '../../utilities/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import { Button } from '../../components/BaseButton';
import BaseStatusBar from '../../components/BaseStatusBar';

export const HABITS_PUSH_OPTIN_SHOWN = 'HABITS_PUSH_OPTIN_SHOWN';

interface IHabitsPushOptInProps {
    user: IUserState;
    navigation: any;
}

const mapStateToProps = (state: any) => ({ user: state.user });

class HabitsPushOptIn extends React.Component<IHabitsPushOptInProps> {
    private translate: (key: string, params?: any) => string;
    private theme = buildStyles();
    private themeButtons = buildButtonStyles();
    private themeHabits = buildHabitStyles();

    constructor(props: IHabitsPushOptInProps) {
        super(props);
        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonStyles(props.user.settings?.mobileThemeName);
        this.themeHabits = buildHabitStyles(props.user.settings?.mobileThemeName);
        this.translate = (key, params) => translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount() {
        this.props.navigation.setOptions({
            title: this.translate('pages.pushOptIn.title'),
        });
    }

    markShownAndContinue = async () => {
        try {
            await AsyncStorage.setItem(HABITS_PUSH_OPTIN_SHOWN, 'true');
        } catch {
            // non-fatal — worst case the screen shows again next launch
        }
        this.props.navigation.reset({ index: 0, routes: [{ name: 'HabitsDashboard' }] });
    };

    requestPermissions = async () => {
        try {
            if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
                await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
            }
            await notifee.requestPermission();
        } catch {
            // user denied or error — proceed regardless; we don't block onboarding
        }
        await this.markShownAndContinue();
    };

    render() {
        const { user } = this.props;

        return (
            <>
                <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
                <SafeAreaView style={[this.theme.styles.safeAreaView, this.themeHabits.styles.dashboardContainer]}>
                    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 48 }}>
                        <Text style={{ fontSize: 64, textAlign: 'center', marginBottom: 16 }}>{'🔔'}</Text>
                        <Text style={[this.themeHabits.styles.dashboardGreeting, { textAlign: 'center', fontSize: 24 }]}>
                            {this.translate('pages.pushOptIn.title')}
                        </Text>
                        <Text style={[this.themeHabits.styles.dashboardSubtitle, { textAlign: 'center', marginTop: 12 }]}>
                            {this.translate('pages.pushOptIn.subtitle')}
                        </Text>
                        <View style={{ marginTop: 32 }}>
                            <Text style={[this.themeHabits.styles.streakMilestoneText, { marginBottom: 8 }]}>
                                {'✅'} {this.translate('pages.pushOptIn.benefit1')}
                            </Text>
                            <Text style={[this.themeHabits.styles.streakMilestoneText, { marginBottom: 8 }]}>
                                {'✅'} {this.translate('pages.pushOptIn.benefit2')}
                            </Text>
                            <Text style={[this.themeHabits.styles.streakMilestoneText, { marginBottom: 8 }]}>
                                {'✅'} {this.translate('pages.pushOptIn.benefit3')}
                            </Text>
                        </View>
                    </ScrollView>
                    <View style={{ padding: 24 }}>
                        <Button
                            buttonStyle={[this.themeButtons.styles.btnLargeWithText, { width: '100%' }]}
                            titleStyle={this.themeButtons.styles.btnLargeTitle}
                            title={this.translate('pages.pushOptIn.enableButton')}
                            onPress={this.requestPermissions}
                        />
                        <Pressable
                            onPress={this.markShownAndContinue}
                            style={{ alignItems: 'center', marginTop: 16, paddingVertical: 12 }}
                        >
                            <Text style={this.themeButtons.styles.btnTitleBlack}>
                                {this.translate('pages.pushOptIn.skipButton')}
                            </Text>
                        </Pressable>
                    </View>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps)(HabitsPushOptIn);
