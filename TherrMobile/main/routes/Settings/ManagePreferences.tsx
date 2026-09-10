import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { IUserState } from 'therr-react/types';
import { UsersService } from 'therr-react/services';
import { showToast } from '../../utilities/toasts';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import { Button } from '../../components/BaseButton';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import UsersActions from '../../redux/actions/UsersActions';
import translator from '../../utilities/translator';
import { bypassInterestsRedirect } from '../../utilities/interestsRedirectGuard';
import { buildStyles } from '../../styles';
import { getTheme } from '../../styles/themes';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildSettingsFormStyles } from '../../styles/forms/settingsForm';
import { buildStyles as buildModalStyles } from '../../styles/modal';
import BaseStatusBar from '../../components/BaseStatusBar';
import CreateProfileInterests from '../../components/0_First_Time_UI/onboarding-stages/CreateProfileInterests';
import spacingStyles from '../../styles/layouts/spacing';

interface IManagePreferencesDispatchProps {
    logout: Function;
    updateUser: Function;
    updateUserInterests: Function;
}

interface IStoreProps extends IManagePreferencesDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IManagePreferencesProps extends IStoreProps {
    navigation: any;
}

interface IManagePreferencesState {
    errorMsg: string;
    successMsg: string;
    interests: any;
    isLoading: boolean;
    isSubmitting: boolean;
    hasLoadError: boolean;
}

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    logout: UsersActions.logout,
    updateUser: UsersActions.update,
    updateUserInterests: UsersActions.updateUserInterests,
}, dispatch);

export class ManagePreferences extends React.Component<IManagePreferencesProps, IManagePreferencesState> {
    private scrollViewRef;
    private translate: Function;
    private theme = buildStyles();
    private themeButtons = buildButtonStyles();
    private themeMenu = buildMenuStyles();
    private themeModal = buildModalStyles();
    private themeForms = buildFormStyles();
    private themeSettingsForm = buildSettingsFormStyles();

    constructor(props) {
        super(props);

        this.state = {
            errorMsg: '',
            successMsg: '',
            interests: {},
            isLoading: true,
            isSubmitting: false,
            hasLoadError: false,
        };

        this.reloadTheme();
        this.translate = (key: string, params: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount = () => {
        this.props.navigation.setOptions({
            title: this.translate('pages.managePreferences.headerTitle'),
        });

        this.loadInterests();
    };

    loadInterests = () => {
        this.setState({
            isLoading: true,
            hasLoadError: false,
        });

        Promise.all([
            UsersService.getInterests(),
            UsersService.getUserInterests(),
        ]).then(([interestsResponse, userInterestsResponse]) => {
            const mappedUserInterests = userInterestsResponse.data?.reduce((acc, cur) => {
                acc[cur.interestId] = cur;

                return acc;
            }, {});
            const currentInterests: any = {};
            Object.keys(interestsResponse.data).map((categoryTranslationKey) => {
                const interests = interestsResponse.data[categoryTranslationKey].map((interest) => ({
                    ...interest,
                    isEnabled: !!mappedUserInterests?.[interest.id]?.isEnabled,
                }));
                currentInterests[categoryTranslationKey] = interests;
            });
            this.setState({
                interests: currentInterests,
                hasLoadError: false,
            });
        }).catch((err) => {
            console.log(err);
            this.setState({
                hasLoadError: true,
            });
        }).finally(() => {
            this.setState({
                isLoading: false,
            });
        });
    };

    handleSkipForNow = () => {
        bypassInterestsRedirect();
        if (this.props.navigation.canGoBack()) {
            this.props.navigation.goBack();
        } else {
            this.props.navigation.navigate('Settings');
        }
    };

    isFormDisabled() {
        const { isSubmitting } = this.state;

        return isSubmitting;
    }

    reloadTheme = () => {
        const themeName = this.props.user.settings?.mobileThemeName;

        this.theme = buildStyles(themeName);
        this.themeMenu = buildMenuStyles(themeName);
        this.themeForms = buildFormStyles(themeName);
        this.themeSettingsForm = buildSettingsFormStyles(themeName);
    };

    onSubmitInterests = (interests: any) => {
        this.setState({
            isSubmitting: true,
        });
        this.props.updateUserInterests({
            interests,
        })
            .then(() => {
                logEvent(getAnalytics(),'account_update_interests', {
                    userId: this.props.user.details.id,
                }).catch((err) => console.log(err));
                showToast.success({
                    text1: this.translate('pages.managePreferences.alertTitles.preferenceSettingsUpdated'),
                    text2: this.translate('pages.managePreferences.alertMessages.preferenceSettingsUpdated'),
                    onHide: () => {
                        if (this.props.navigation.canGoBack()) {
                            this.props.navigation.goBack();
                        } else {
                            this.props.navigation.navigate('Settings');
                        }
                    },
                });
            }).catch(() => {
                showToast.error({
                    text1: this.translate('pages.managePreferences.alertTitles.accountError'),
                    text2: this.translate('pages.managePreferences.alertMessages.preferenceSettingsUpdatedError'),
                });
            }).finally(() => {
                this.setState({
                    isSubmitting: false,
                });
            });
    };

    handleRefresh = () => {
        console.log('refresh');
    };

    render() {
        const { navigation, user } = this.props;
        const  { interests, isLoading, isSubmitting, hasLoadError } = this.state;
        const pageHeaderAdvancedSettings = this.translate('pages.managePreferences.pageHeaderEmailSettings');
        const pageHeaderYourInterests = this.translate('pages.managePreferences.pageSubHeaderInterests');
        const themeColors = getTheme(user.settings?.mobileThemeName).colors;

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName} />
                <SafeAreaView edges={[]}  style={this.theme.styles.safeAreaView}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        ref={(component) => (this.scrollViewRef = component)}
                        style={this.theme.styles.scrollViewFull}
                    >
                        <View style={this.theme.styles.body}>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitleCenter}>
                                    {pageHeaderAdvancedSettings}
                                </Text>
                            </View>
                            <View style={[
                                spacingStyles.marginHorizLg,
                                spacingStyles.marginTopLg,
                            ]}>
                                <Text style={this.theme.styles.sectionTitleSmall}>
                                    {pageHeaderYourInterests}
                                </Text>
                            </View>
                            {hasLoadError && (
                                <View style={[
                                    spacingStyles.marginHorizLg,
                                    spacingStyles.marginTopLg,
                                ]}>
                                    <Text style={[
                                        this.theme.styles.sectionDescriptionCentered,
                                        { color: themeColors.alertError },
                                    ]}>
                                        {this.translate('pages.managePreferences.alertMessages.loadInterestsError')}
                                    </Text>
                                    <View style={spacingStyles.marginTopMd}>
                                        <Button
                                            buttonStyle={this.themeForms.styles.buttonPrimary}
                                            disabledStyle={this.themeForms.styles.buttonDisabled}
                                            titleStyle={this.themeForms.styles.buttonTitle}
                                            disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                                            title={this.translate('pages.managePreferences.buttons.retry')}
                                            onPress={this.loadInterests}
                                            disabled={isLoading}
                                        />
                                    </View>
                                </View>
                            )}
                            <CreateProfileInterests
                                availableInterests={interests}
                                isDisabled={isSubmitting}
                                isLoading={isLoading}
                                onChange={() => {}}
                                onSubmit={this.onSubmitInterests}
                                translate={this.translate}
                                theme={this.theme}
                                themeForms={this.themeForms}
                                themeSettingsForm={this.themeSettingsForm}
                                submitButtonText={this.translate(
                                    'forms.settings.buttons.submit'
                                )}
                            />
                            <View style={[
                                spacingStyles.marginHorizLg,
                                spacingStyles.marginTopMd,
                                spacingStyles.marginBotLg,
                                { alignItems: 'center' },
                            ]}>
                                <TouchableOpacity
                                    onPress={this.handleSkipForNow}
                                    disabled={isSubmitting}
                                    accessibilityRole="button"
                                >
                                    <Text style={[
                                        this.theme.styles.sectionDescription,
                                        {
                                            color: themeColors.hyperlink,
                                            textDecorationLine: 'underline',
                                            textAlign: 'center',
                                        },
                                    ]}>
                                        {this.translate('pages.managePreferences.buttons.skipForNow')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAwareScrollView>
                </SafeAreaView>
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={this.handleRefresh}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ManagePreferences);
