import React from 'react';
import { connect } from 'react-redux';
import { SafeAreaView, View, Text, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Image from '../../components/BaseImage';
import 'react-native-gesture-handler';
import { IUserState } from 'therr-react/types';
import { buildStyles } from '../../styles';
import { buildStyles as buildFTUIStyles } from '../../styles/first-time-ui';
import { buildStyles as buildAuthFormStyles } from '../../styles/forms/authenticationForms';
import { buildStyles as buildAlertStyles } from '../../styles/alerts';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import mixins from '../../styles/mixins';
import LoginForm from './LoginForm';
import { bindActionCreators } from 'redux';
import UsersActions from '../../redux/actions/UsersActions';
import translator from '../../services/translator';
import BaseStatusBar from '../../components/BaseStatusBar';
import { getUserImageUri } from '../../utilities/content';

interface ILoginDispatchProps {
    login: Function;
}

interface IStoreProps extends ILoginDispatchProps {
    user: IUserState;
}

// Regular component props
export interface ILoginProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface ILoginState {
    isAuthenticating: boolean;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            login: UsersActions.login,
        },
        dispatch
    );

class LoginComponent extends React.Component<ILoginProps, ILoginState> {
    private translate;
    private cachedUserDetails;
    private theme = buildStyles();
    private themeAlerts = buildAlertStyles();
    private themeAuthForm = buildAuthFormStyles();
    private themeFTUI = buildFTUIStyles();
    private themeForms = buildFormStyles();

    constructor(props) {
        super(props);

        this.theme = buildStyles(props.user?.settings?.mobileThemeName);
        this.themeAlerts = buildAlertStyles(props.user.settings?.mobileThemeName);
        this.themeAuthForm = buildAuthFormStyles(props.user.settings?.mobileThemeName);
        this.themeFTUI = buildFTUIStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any): string =>
            translator('en-us', key, params);
        this.cachedUserDetails = props.user?.details;
    }

    // TODO: On logout, ignore any deep link logic
    componentDidMount() {
        const { navigation, route } = this.props;
        const isVerifySuccess = route.params?.isVerifySuccess;

        if (!isVerifySuccess) {
            navigation.setOptions({
                title: this.translate('pages.login.headerTitle'),
            });
        }
    }

    render() {
        const { route, user } = this.props;
        const { userMessage } = route?.params || '';
        const pageTitle = this.translate('pages.login.pageTitle');
        const pageSubtitle = this.translate('pages.login.pageSubtitle');
        const iPadDynamicStyles: any = (Platform.OS === 'ios' && Platform.isPad)
            ? { paddingHorizontal: '10%' }
            : {};

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView  style={this.theme.styles.safeAreaView}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        style={this.theme.styles.bodyFlex}
                        contentContainerStyle={this.theme.styles.bodyScroll}
                    >
                        <View style={iPadDynamicStyles}>
                            {
                                this.cachedUserDetails?.media ?
                                    <View style={[mixins.flexCenter, mixins.marginMediumBot, mixins.marginMediumTop]}>
                                        <Image source={{ uri: getUserImageUri({ details: this.cachedUserDetails }, 200) }}
                                            loaderSize="large"
                                            theme={this.theme}
                                        />
                                    </View> :
                                    <View style={this.theme.styles.sectionContainerWide}>
                                        <Text style={this.themeFTUI.styles.titleWithNoSpacing}>
                                            {pageTitle}
                                        </Text>
                                        <Text style={this.themeFTUI.styles.subtitle}>
                                            {pageSubtitle}
                                        </Text>
                                    </View>
                            }
                            <LoginForm
                                login={this.props.login}
                                navigation={this.props.navigation}
                                themeAlerts={this.themeAlerts}
                                themeAuthForm={this.themeAuthForm}
                                themeForms={this.themeForms}
                                userMessage={userMessage}
                                userSettings={user?.settings || {}} />
                        </View>
                    </KeyboardAwareScrollView>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(LoginComponent);
