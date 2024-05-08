import React from 'react';
import { SafeAreaView, View, Text } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { IUserState } from 'therr-react/types';
import { UsersService } from 'therr-react/services';
import Toast from 'react-native-toast-message';
import analytics from '@react-native-firebase/analytics';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import UsersActions from '../../redux/actions/UsersActions';
import translator from '../../services/translator';
import { buildStyles } from '../../styles';
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
    isSubmitting: boolean;
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
            isSubmitting: false,
        };

        this.reloadTheme();
        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount = () => {
        this.props.navigation.setOptions({
            title: this.translate('pages.managePreferences.headerTitle'),
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
            });
        }).catch((err) => {
            console.log(err);
        });
    };

    onDeleteAccountConfirm = () => {
        const { logout, user } = this.props;

        analytics().logEvent('account_delete_start', {
            userId: user.details.id,
        }).catch((err) => console.log(err));

        // TODO: Add are you sure modal and test
        UsersService.delete(user.details.id).then(() => {
            analytics().logEvent('account_delete_success', {
                userId: user.details.id,
            }).catch((err) => console.log(err));

            Toast.show({
                type: 'successBig',
                text1: this.translate('pages.advancedSettings.alertTitles.accountDeleted'),
                text2: this.translate('pages.advancedSettings.alertMessages.accountDeleted'),
                visibilityTime: 2000,
                onHide: () => {
                    logout();
                },
            });
        }).catch((error) => {
            analytics().logEvent('account_delete_failed', {
                userId: user.details.id,
                error: error?.message,
            }).catch((err) => console.log(err));
        });
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
                Toast.show({
                    type: 'successBig',
                    text1: this.translate('pages.managePreferences.alertTitles.preferenceSettingsUpdated'),
                    text2: this.translate('pages.managePreferences.alertMessages.preferenceSettingsUpdated'),
                    visibilityTime: 3000,
                });
            }).catch(() => {
                Toast.show({
                    type: 'errorBig',
                    text1: this.translate('pages.manageNotifications.alertTitles.accountError'),
                    text2: this.translate('pages.manageNotifications.alertMessages.preferenceSettingsUpdatedError'),
                    visibilityTime: 3000,
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
        const  { interests, isSubmitting } = this.state;
        const pageHeaderAdvancedSettings = this.translate('pages.managePreferences.pageHeaderEmailSettings');
        const pageHeaderYourInterests = this.translate('pages.managePreferences.pageSubHeaderInterests');

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName} />
                <SafeAreaView  style={this.theme.styles.safeAreaView}>
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
                            <CreateProfileInterests
                                availableInterests={interests}
                                isDisabled={isSubmitting}
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
