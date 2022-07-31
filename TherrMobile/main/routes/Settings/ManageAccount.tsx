import React from 'react';
import { SafeAreaView, View, Text, Platform } from 'react-native';
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
import DeleteAccountModal from '../../components/Modals/DeleteAccountModal';

interface IManageAccountDispatchProps {
    logout: Function;
    updateUser: Function;
}

interface IStoreProps extends IManageAccountDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IManageAccountProps extends IStoreProps {
    navigation: any;
}

interface IManageAccountState {
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

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    logout: UsersActions.logout,
    updateUser: UsersActions.update,
}, dispatch);

export class ManageAccount extends React.Component<IManageAccountProps, IManageAccountState> {
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
                email: props.user.details.email,
                firstName: props.user.details.firstName,
                lastName: props.user.details.lastName,
                userName: props.user.details.userName,
                phoneNumber: props.user.details.phoneNumber,
                settingsBio: props.user.settings.settingsBio,
                shouldHideMatureContent: props.user.details.shouldHideMatureContent,
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
            title: this.translate('pages.advancedSettings.headerTitle'),
        });
    }

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
    }

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
    }

    onSubmit = (shouldDeactivateAccount?: boolean) => {
        const { user } = this.props;

        const updateArgs: any = {
            settingsIsAccountSoftDeleted: !!shouldDeactivateAccount,
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
                type: 'success',
                text1: this.translate('pages.advancedSettings.alertTitles.accountDeactived'),
                text2: this.translate('pages.advancedSettings.alertMessages.accountDeactived'),
                visibilityTime: 3000,
            });
        })
        .catch((error: any) => {
            console.log(error);
            Toast.show({
                type: 'error',
                text1: this.translate('pages.advancedSettings.alertTitles.accountError'),
                text2: this.translate('pages.advancedSettings.alertMessages.accountDeactivedError'),
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
    }

    toggleDeleteAccountModal = (shouldOpen: boolean) => {
        this.setState({
            isDeleteAccountModalVisible: shouldOpen,
        });
    }

    onDeleteAccountModalClose = (action?: 'deactivate' | 'delete') => {
        this.setState({
            isDeleteAccountModalVisible: false,
        });

        if (action === 'deactivate') {
            this.onSubmit(true);
        } else if (action === 'delete') {
            this.onDeleteAccountConfirm();
        }
    }

    handleRefresh = () => {
        console.log('refresh');
    }

    render() {
        const { navigation, user } = this.props;
        const  { isDeleteAccountModalVisible } = this.state;
        const pageHeaderAdvancedSettings = this.translate('pages.advancedSettings.pageHeaderAccountActions');

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
                            {
                                /* This not a requirement for Google Play, so no need to support it yet */
                                Platform.OS === 'ios' && <View style={this.themeSettingsForm.styles.advancedContainer}>
                                    <Text style={this.theme.styles.sectionDescription}>
                                        <Text
                                            style={this.themeForms.styles.buttonLink}
                                            onPress={() => this.toggleDeleteAccountModal(true)}>{this.translate('forms.settings.buttons.deleteAccount')}</Text>
                                    </Text>
                                </View>
                            }
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
                <DeleteAccountModal
                    isVisible={isDeleteAccountModalVisible}
                    translate={this.translate}
                    onRequestClose={(action) => this.onDeleteAccountModalClose(action)}
                    themeButtons={this.themeButtons}
                    themeModal={this.themeModal}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ManageAccount);
