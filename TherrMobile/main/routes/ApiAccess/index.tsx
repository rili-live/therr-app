import React from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect } from 'react-redux';
import { IUserState } from 'therr-react/types';
import { AccessLevels } from 'therr-js-utilities/constants';
import { Button } from '../../components/BaseButton';
import BaseStatusBar from '../../components/BaseStatusBar';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import translator from '../../utilities/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import spacingStyles from '../../styles/layouts/spacing';
import getConfig from '../../utilities/getConfig';

const API_DOCS_URL = 'https://api.therr.com/v1/docs';

/**
 * Deliberately NOT a therr.com URL. therr.com and www.therr.com are auto-verified Android
 * App Links (see appLinkHostsByAppId in TherrMobile/android/app/build.gradle), so opening
 * one here would be captured by this same app and bounce the user right back to this
 * screen. dashboard.therr.com is not in the intent filter, so it opens in the browser.
 */
const getDashboardUrl = (path: string) => `${getConfig().dashboardHostFull}${path}`;

// Mirrors API_KEY_ELIGIBLE_LEVELS in users-service/handlers/apiKeys.ts.
const API_KEY_ELIGIBLE_LEVELS: string[] = [
    AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
    AccessLevels.DASHBOARD_SUBSCRIBER_PRO,
    AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM,
    AccessLevels.DASHBOARD_SUBSCRIBER_AGENCY,
    AccessLevels.SUPER_ADMIN,
    AccessLevels.API_ACCESS,
];

const STEP_KEYS = ['one', 'two', 'three', 'four'];

interface IStoreProps {
    user: IUserState;
}

export interface IApiAccessProps extends IStoreProps {
    navigation: any;
}

const mapStateToProps = (state) => ({
    user: state.user,
});

/**
 * Landing screen for the therr.com/api-access universal link.
 *
 * API keys are issued from the web dashboard, and there is no in-app equivalent — but the
 * link is app-linked, so tapping it on a device with the app installed opens the app. Before
 * this screen existed that fell through to handleOpenByNotifeeNotification and the user was
 * left staring at whatever screen happened to be mounted. This explains the steps in-app and
 * hands off to the browser for the part that genuinely requires the dashboard.
 */
export class ApiAccessComponent extends React.Component<IApiAccessProps> {
    private theme = buildStyles();

    private themeMenu = buildMenuStyles();

    private themeForms = buildFormStyles();

    private translate: Function;

    constructor(props: IApiAccessProps) {
        super(props);

        this.reloadTheme();
        this.translate = (key: string, params?: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        const { navigation } = this.props;
        navigation.setOptions({
            title: this.translate('pages.apiAccess.headerTitle'),
        });
    }

    reloadTheme = () => {
        const themeName = this.props.user.settings?.mobileThemeName;

        this.theme = buildStyles(themeName);
        this.themeMenu = buildMenuStyles(themeName);
        this.themeForms = buildFormStyles(themeName);
    };

    get isEligible(): boolean {
        const accessLevels: string[] = this.props.user?.details?.accessLevels || [];
        return API_KEY_ELIGIBLE_LEVELS.some((level) => accessLevels.includes(level));
    }

    onOpenDashboard = () => {
        // Eligible accounts go straight to the key generator; everyone else needs to
        // register or subscribe first, so send them to the dashboard entry point.
        const path = this.isEligible ? '/settings/api-keys' : '/register';
        Linking.openURL(getDashboardUrl(path)).catch(() => {});
    };

    onOpenDocs = () => {
        Linking.openURL(API_DOCS_URL).catch(() => {});
    };

    render() {
        const { navigation, user } = this.props;

        return (
            <>
                <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
                <SafeAreaView edges={[]} style={this.theme.styles.safeAreaView}>
                    <ScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        style={this.theme.styles.scrollView}
                    >
                        <View style={this.theme.styles.body}>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitle}>
                                    {this.translate('pages.apiAccess.pageTitle')}
                                </Text>
                                <Text style={this.theme.styles.sectionDescription}>
                                    {this.translate('pages.apiAccess.intro')}
                                </Text>
                            </View>

                            {STEP_KEYS.map((stepKey, index) => (
                                <View key={stepKey} style={this.theme.styles.sectionContainer}>
                                    <Text style={this.theme.styles.sectionTitleSmall}>
                                        {`${index + 1}. ${this.translate(`pages.apiAccess.steps.${stepKey}.title`)}`}
                                    </Text>
                                    <Text style={this.theme.styles.sectionDescription}>
                                        {this.translate(`pages.apiAccess.steps.${stepKey}.description`)}
                                    </Text>
                                </View>
                            ))}

                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionDescription}>
                                    {this.isEligible
                                        ? this.translate('pages.apiAccess.statusEligible')
                                        : this.translate('pages.apiAccess.statusNotEligible')}
                                </Text>
                            </View>

                            <View style={[this.theme.styles.sectionContainer, spacingStyles.padHorizSm]}>
                                <Button
                                    buttonStyle={this.themeForms.styles.buttonPrimary}
                                    titleStyle={this.themeForms.styles.buttonTitle}
                                    title={this.isEligible
                                        ? this.translate('pages.apiAccess.buttons.manageKeys')
                                        : this.translate('pages.apiAccess.buttons.openDashboard')}
                                    onPress={this.onOpenDashboard}
                                />
                            </View>

                            <View style={[this.theme.styles.sectionContainer, spacingStyles.padHorizSm]}>
                                <Button
                                    type="clear"
                                    titleStyle={this.themeForms.styles.buttonLink}
                                    title={this.translate('pages.apiAccess.buttons.viewDocs')}
                                    onPress={this.onOpenDocs}
                                />
                            </View>
                        </View>
                    </ScrollView>
                    <MainButtonMenu
                        navigation={navigation}
                        translate={this.translate}
                        user={user}
                        themeMenu={this.themeMenu}
                    />
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, null)(ApiAccessComponent);
