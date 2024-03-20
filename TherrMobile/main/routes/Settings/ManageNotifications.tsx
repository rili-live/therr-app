import React from 'react';
import { SafeAreaView, View, Text, Switch } from 'react-native';
import { Button } from 'react-native-elements';
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
import spacingStyles from '../../styles/layouts/spacing';
import BaseStatusBar from '../../components/BaseStatusBar';

interface IManageNotificationsDispatchProps {
    logout: Function;
    updateUser: Function;
}

interface IStoreProps extends IManageNotificationsDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IManageNotificationsProps extends IStoreProps {
    navigation: any;
}

interface IManageNotificationsState {
    croppedImageDetails: any;
    errorMsg: string;
    successMsg: string;
    inputs: any;
    isCropping: boolean;
    isDeleteAccountModalVisible: boolean;
    isNightMode: boolean;
    isSubmitting: boolean;
    passwordErrorMessage: string;
}

const NotificationSettingSwitch = ({
    onChange,
    label,
    value,
    translate,
    theme,
    themeForms,
    themeModal,
    disabled,
}) => {
    return (
        <View
            style={[
                themeForms.styles.switchSubContainer,
                spacingStyles.flexRow,
                spacingStyles.justifyCenter,
                spacingStyles.padBotXlg,
                spacingStyles.padHorizSm,
            ]}
        >
            <Text
                style={[
                    themeModal.styles.label,
                    spacingStyles.flexOne,
                ]}
                numberOfLines={2}
            >
                {label}
            </Text>
            <Switch
                style={[
                    themeForms.styles.switchButton,
                    spacingStyles.marginLtLg,
                    spacingStyles.marginRtLg,
                ]}
                trackColor={{ false: theme.colors.primary2, true: theme.colors.primary4 }}
                thumbColor={true? theme.colors.primary3 : theme.colorVariations.primary3Fade}
                ios_backgroundColor={theme.colors.primary4}
                onValueChange={onChange}
                value={value}
                disabled={disabled}
            />
            <Text
                style={[
                    themeModal.styles.label,
                    {
                        fontWeight: true? '800' : '400',
                    },
                ]}
            >
                {value ? translate('forms.settings.buttons.on') : translate('forms.settings.buttons.off')}
            </Text>
        </View>
    );
};

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    logout: UsersActions.logout,
    updateUser: UsersActions.update,
}, dispatch);

export class ManageNotifications extends React.Component<IManageNotificationsProps, IManageNotificationsState> {
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
            croppedImageDetails: {},
            errorMsg: '',
            successMsg: '',
            inputs: {
                settingsEmailMarketing: props.user.settings.settingsEmailMarketing,
                settingsEmailBusMarketing: props.user.settings.settingsEmailBusMarketing,
                settingsEmailLikes: props.user.settings.settingsEmailLikes,
                settingsEmailInvites: props.user.settings.settingsEmailInvites,
                settingsEmailMentions: props.user.settings.settingsEmailMentions,
                settingsEmailMessages: props.user.settings.settingsEmailMessages,
                settingsEmailReminders: props.user.settings.settingsEmailReminders,
                settingsEmailBackground: props.user.settings.settingsEmailBackground,
            },
            isCropping: false,
            isNightMode: props.user.settings.mobileThemeName === 'retro',
            isDeleteAccountModalVisible: false,
            isSubmitting: false,
            passwordErrorMessage: '',
        };

        this.reloadTheme();
        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount = () => {
        this.props.navigation.setOptions({
            title: this.translate('pages.manageNotifications.headerTitle'),
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

    onSubmit = () => {
        const { user } = this.props;

        const updateArgs: any = {
            ...this.state.inputs,
        };

        if (!this.isFormDisabled()) {
            this.setState({
                isSubmitting: true,
            });
            this.requestUserUpdate(user, updateArgs).finally(() => {
                this.setState({
                    isSubmitting: false,
                });
            });
        }
    };


    requestUserUpdate = (user, updateArgs) => this.props
        .updateUser(user.details.id, updateArgs)
        .then(() => {
            Toast.show({
                type: 'successBig',
                text1: this.translate('pages.manageNotifications.alertTitles.notificationSettingsUpdated'),
                text2: this.translate('pages.manageNotifications.alertMessages.notificationSettingsUpdated'),
                visibilityTime: 3000,
            });
        })
        .catch(() => {
            Toast.show({
                type: 'errorBig',
                text1: this.translate('pages.manageNotifications.alertTitles.accountError'),
                text2: this.translate('pages.manageNotifications.alertMessages.notificationSettingsUpdatedError'),
                visibilityTime: 3000,
            });
        })
        .finally(() => {
            this.scrollViewRef?.scrollToPosition(0, 0);
        });

    onThemeChange = (isNightMode: boolean) => {
        this.setState({
            isNightMode,
        });
    };

    onSwitchChange = (name: string) => {
        this.setState({
            inputs: {
                ...this.state.inputs,
                [name]: !this.state.inputs[name],
            },
        });
    };

    handleRefresh = () => {
        console.log('refresh');
    };

    render() {
        const { navigation, user } = this.props;
        const  { inputs, isSubmitting } = this.state;
        const pageHeaderAdvancedSettings = this.translate('pages.manageNotifications.pageHeaderEmailSettings');

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName} />
                <SafeAreaView  style={this.theme.styles.safeAreaView}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        ref={(component) => (this.scrollViewRef = component)}
                        style={this.theme.styles.scrollView}
                    >
                        <View style={this.theme.styles.body}>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitle}>
                                    {pageHeaderAdvancedSettings}
                                </Text>
                            </View>
                            <View style={this.themeSettingsForm.styles.advancedContainer}>
                                <NotificationSettingSwitch
                                    label={this.translate('forms.settings.buttons.settingsEmailMarketing')}
                                    value={inputs.settingsEmailMarketing}
                                    onChange={() => this.onSwitchChange('settingsEmailMarketing')}
                                    theme={this.theme}
                                    themeForms={this.themeForms}
                                    themeModal={this.themeModal}
                                    translate={this.translate}
                                    disabled={isSubmitting}
                                />
                                <NotificationSettingSwitch
                                    label={this.translate('forms.settings.buttons.settingsEmailBusMarketing')}
                                    value={inputs.settingsEmailBusMarketing}
                                    onChange={() => this.onSwitchChange('settingsEmailBusMarketing')}
                                    theme={this.theme}
                                    themeForms={this.themeForms}
                                    themeModal={this.themeModal}
                                    translate={this.translate}
                                    disabled={isSubmitting}
                                />
                                <NotificationSettingSwitch
                                    label={this.translate('forms.settings.buttons.settingsEmailLikes')}
                                    value={inputs.settingsEmailLikes}
                                    onChange={() => this.onSwitchChange('settingsEmailLikes')}
                                    theme={this.theme}
                                    themeForms={this.themeForms}
                                    themeModal={this.themeModal}
                                    translate={this.translate}
                                    disabled={isSubmitting}
                                />
                                <NotificationSettingSwitch
                                    label={this.translate('forms.settings.buttons.settingsEmailInvites')}
                                    value={inputs.settingsEmailInvites}
                                    onChange={() => this.onSwitchChange('settingsEmailInvites')}
                                    theme={this.theme}
                                    themeForms={this.themeForms}
                                    themeModal={this.themeModal}
                                    translate={this.translate}
                                    disabled={isSubmitting}
                                />
                                <NotificationSettingSwitch
                                    label={this.translate('forms.settings.buttons.settingsEmailMentions')}
                                    value={inputs.settingsEmailMentions}
                                    onChange={() => this.onSwitchChange('settingsEmailMentions')}
                                    theme={this.theme}
                                    themeForms={this.themeForms}
                                    themeModal={this.themeModal}
                                    translate={this.translate}
                                    disabled={isSubmitting}
                                />
                                <NotificationSettingSwitch
                                    label={this.translate('forms.settings.buttons.settingsEmailMessages')}
                                    value={inputs.settingsEmailMessages}
                                    onChange={() => this.onSwitchChange('settingsEmailMessages')}
                                    theme={this.theme}
                                    themeForms={this.themeForms}
                                    themeModal={this.themeModal}
                                    translate={this.translate}
                                    disabled={isSubmitting}
                                />
                                <NotificationSettingSwitch
                                    label={this.translate('forms.settings.buttons.settingsEmailReminders')}
                                    value={inputs.settingsEmailReminders}
                                    onChange={() => this.onSwitchChange('settingsEmailReminders')}
                                    theme={this.theme}
                                    themeForms={this.themeForms}
                                    themeModal={this.themeModal}
                                    translate={this.translate}
                                    disabled={isSubmitting}
                                />
                                <NotificationSettingSwitch
                                    label={this.translate('forms.settings.buttons.settingsEmailBackground')}
                                    value={inputs.settingsEmailBackground}
                                    onChange={() => this.onSwitchChange('settingsEmailBackground')}
                                    theme={this.theme}
                                    themeForms={this.themeForms}
                                    themeModal={this.themeModal}
                                    translate={this.translate}
                                    disabled={isSubmitting}
                                />
                            </View>
                        </View>
                    </KeyboardAwareScrollView>
                </SafeAreaView>
                <View style={this.themeMenu.styles.submitButtonContainerFloat}>
                    <Button
                        buttonStyle={this.themeForms.styles.button}
                        title={this.translate(
                            'forms.settings.buttons.submit'
                        )}
                        onPress={this.onSubmit}
                        disabled={this.isFormDisabled()}
                        raised={true}
                    />
                </View>
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

export default connect(mapStateToProps, mapDispatchToProps)(ManageNotifications);
