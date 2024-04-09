import React from 'react';
import { connect } from 'react-redux';
import { Text, View, SafeAreaView, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import 'react-native-gesture-handler';
import { IUserState } from 'therr-react/types';
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
import translator from '../../services/translator';
import BaseStatusBar from '../../components/BaseStatusBar';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import eula from '../Map/EULA';

interface IRegisterDispatchProps {
    login: Function;
    register: Function;
}

interface IStoreProps extends IRegisterDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IRegisterProps extends IStoreProps {
    navigation: any;
}

interface IRegisterState {
    isEULAVisible: boolean;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            login: UsersActions.login,
            register: UsersActions.register,
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
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeAlerts = buildAlertStyles(props.user.settings?.mobileThemeName);
        this.themeAuthForm = buildAuthFormStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
        this.themeConfirmModal = buildConfirmModalStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeFTUI = buildFTUIStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any): string =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        this.props.navigation.setOptions({
            title: this.translate('pages.register.headerTitle'),
        });
    }

    onSuccess = () => {
        this.props.navigation.navigate('Login', {
            userMessage: this.translate('pages.login.userAlerts.registerSuccess'),
        });
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
        const iPadDynamicStyles: any = (Platform.OS === 'ios' && Platform.isPad)
            ? { paddingHorizontal: '10%' }
            : {};

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView  style={this.theme.styles.safeAreaView}>
                    <KeyboardAwareScrollView style={this.theme.styles.bodyFlex} contentContainerStyle={this.theme.styles.bodyScroll} enableOnAndroid>
                        <View style={iPadDynamicStyles}>
                            <View style={this.theme.styles.sectionContainerWide}>
                                <Text style={this.themeFTUI.styles.titleWithNoSpacing}>
                                    {pageTitle}
                                </Text>
                                <Text style={this.themeFTUI.styles.subtitle}>
                                    {pageSubtitle}
                                </Text>
                            </View>
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
