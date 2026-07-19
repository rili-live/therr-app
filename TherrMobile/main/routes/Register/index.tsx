import React from 'react';
import { connect } from 'react-redux';
import { Text, View, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import 'react-native-gesture-handler';
import { showToast } from '../../utilities/toasts';
import { IUserState } from 'therr-react/types';
import { UsersService } from 'therr-react/services';
import { buildStyles } from '../../styles';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildAuthFormStyles } from '../../styles/forms/authenticationForms';
import { buildStyles as buildAlertStyles } from '../../styles/alerts';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import { buildStyles as buildConfirmModalStyles } from '../../styles/modal/confirmModal';
import { buildStyles as buildFTUIStyles } from '../../styles/first-time-ui';
import RegisterForm from './RegisterForm';
import { bindActionCreators } from 'redux';
import UsersActions from '../../redux/actions/UsersActions';
import setPreLoginLocale from '../../redux/actions/setPreLoginLocale';
import translator from '../../utilities/translator';
import BaseStatusBar from '../../components/BaseStatusBar';
import LanguageSelector from '../../components/LanguageSelector';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import eula from '../Map/EULA';

interface IRegisterDispatchProps {
    login: Function;
    register: Function;
    setPreLoginLocale: Function;
}

interface IStoreProps extends IRegisterDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IRegisterProps extends IStoreProps {
    navigation: any;
    route?: any;
}

interface IRegisterState {
    isEULAVisible: boolean;
    prefillEmail: string;
    inviterName: string;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            login: UsersActions.login,
            register: UsersActions.register,
            setPreLoginLocale,
        },
        dispatch
    );

class RegisterComponent extends React.Component<IRegisterProps, IRegisterState> {
    private translate;
    private theme = buildStyles();
    private themeAlerts = buildAlertStyles();
    private themeAuthForm = buildAuthFormStyles();
    private themeButtons = buildButtonsStyles();
    private themeConfirmModal = buildConfirmModalStyles();
    private themeForms = buildFormStyles();
    private themeFTUI = buildFTUIStyles();

    constructor(props) {
        super(props);

        this.state = {
            isEULAVisible: false,
            prefillEmail: '',
            inviterName: '',
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeAlerts = buildAlertStyles(props.user.settings?.mobileThemeName);
        this.themeAuthForm = buildAuthFormStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
        this.themeConfirmModal = buildConfirmModalStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeFTUI = buildFTUIStyles(props.user.settings?.mobileThemeName);
        // Read from `this.props` (not the captured constructor `props`) so the translation
        // re-renders live when the pre-login locale changes via the LanguageSelector.
        this.translate = (key: string, params: any): string =>
            translator(this.props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount() {
        this.props.navigation.setOptions({
            title: this.translate('pages.register.headerTitle'),
        });

        // Magic invite link: resolve the token to pre-fill the invitee's known
        // email and show who invited them. Best-effort — signup still works if
        // the token can't be resolved.
        const inviteToken = this.props.route?.params?.inviteToken;
        if (inviteToken) {
            UsersService.getInviteByToken(inviteToken)
                .then((response: any) => {
                    const invite = response?.data || {};
                    this.setState({
                        prefillEmail: invite.email || '',
                        inviterName: invite.inviterName || '',
                    });
                })
                .catch(() => { /* ignore unknown/expired token */ });
        }
    }

    componentDidUpdate(prevProps: IRegisterProps) {
        if (prevProps.user.settings?.locale !== this.props.user.settings?.locale) {
            this.props.navigation.setOptions({
                title: this.translate('pages.register.headerTitle'),
            });
        }
    }

    onChangeLocale = (locale: string) => {
        this.props.setPreLoginLocale(locale);
    };

    onSuccess = () => {
        showToast.success({
            text1: this.translate('alertTitles.waitlistSuccess'),
            text2: this.translate('alertMessages.waitlistSuccess'),
        });
        this.props.navigation.navigate('Login', {
            userMessage: this.translate('pages.login.userAlerts.registerSuccess'),
        });
    };

    goToMap = () => {
        this.props.navigation.navigate('Map');
    };

    toggleEULA = () => {
        const { isEULAVisible } = this.state;
        this.setState({
            isEULAVisible: !isEULAVisible,
        });
    };

    render() {
        const { isEULAVisible } = this.state;
        const pageTitle = this.translate('pages.register.pageTitle');
        const pageSubtitle = this.translate('pages.register.pageSubtitle');
        const pageSubtitleMapPreviewLink = this.translate('pages.register.pageSubtitleMapPreviewLink');
        const iPadDynamicStyles: any = (Platform.OS === 'ios' && Platform.isPad)
            ? { paddingHorizontal: '10%' }
            : {};

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView edges={[]}  style={this.theme.styles.safeAreaView}>
                    <KeyboardAwareScrollView style={this.theme.styles.bodyFlex} contentContainerStyle={this.theme.styles.bodyScroll} enableOnAndroid>
                        <View style={iPadDynamicStyles}>
                            <View style={this.theme.styles.sectionContainerWide}>
                                <Text style={this.themeFTUI.styles.titleWithNoSpacing}>
                                    {pageTitle}
                                </Text>
                                <Text style={this.themeFTUI.styles.subtitle}>
                                    {pageSubtitle} <Text onPress={this.goToMap} style={this.themeForms.styles.buttonLink}>{pageSubtitleMapPreviewLink}</Text>
                                </Text>
                            </View>
                            <LanguageSelector
                                locale={this.props.user?.settings?.locale || 'en-us'}
                                onChangeLocale={this.onChangeLocale}
                                translate={this.translate}
                                theme={this.theme}
                                containerStyle={this.theme.styles.sectionContainerWide}
                            />
                            <RegisterForm
                                login={this.props.login}
                                register={this.props.register}
                                onSuccess={this.onSuccess}
                                theme={this.theme}
                                themeAlerts={this.themeAlerts}
                                themeAuthForm={this.themeAuthForm}
                                themeForms={this.themeForms}
                                toggleEULA={this.toggleEULA}
                                userSettings={this.props.user?.settings || {}}
                                inviteToken={this.props.route?.params?.inviteToken}
                                prefillEmail={this.state.prefillEmail}
                                inviterName={this.state.inviterName}
                            />
                        </View>
                    </KeyboardAwareScrollView>
                </SafeAreaView>
                <ConfirmModal
                    headerText={this.translate('modals.confirmModal.header.eula')}
                    isVisible={isEULAVisible}
                    onCancel={this.toggleEULA}
                    onConfirm={this.toggleEULA}
                    text={eula}
                    textConfirm={this.translate('modals.confirmModal.agree')}
                    translate={this.translate}
                    theme={this.theme}
                    themeButtons={this.themeButtons}
                    themeModal={this.themeConfirmModal}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(RegisterComponent);
