import React from 'react';
import { connect } from 'react-redux';
import { Linking, Platform, SafeAreaView, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { AccessCheckType } from '../../types';
import Image from '../../components/BaseImage';
import 'react-native-gesture-handler';
import { AccessLevels } from 'therr-js-utilities/constants';
import { IUserState } from 'therr-react/types';
import { UsersService } from 'therr-react/services';
import { createIconSetFromIcoMoon } from 'react-native-vector-icons';
import styles from '../../styles';
import mixins from '../../styles/mixins';
import LoginForm from './LoginForm';
import { bindActionCreators } from 'redux';
import UsersActions from '../../redux/actions/UsersActions';
import translator from '../../services/translator';
import BaseStatusBar from '../../components/BaseStatusBar';
import therrIconConfig from '../../assets/therr-font-config.json';

const LogoIcon = createIconSetFromIcoMoon(
    therrIconConfig,
    'TherrFont',
    'TherrFont.ttf'
);


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
    private cachedUserId;
    private urlEventListener;

    constructor(props) {
        super(props);

        this.translate = (key: string, params: any): string =>
            translator('en-us', key, params);
        this.cachedUserId = (props.user && props.user.details && props.user.details.id);
    }

    // TODO: On logout, ignore any deep link logic
    componentDidMount() {
        const { navigation, route } = this.props;
        const isVerifySuccess = route.params?.isVerifySuccess;

        if (!isVerifySuccess) {
            navigation.setOptions({
                title: this.translate('pages.login.headerTitle'),
            });

            if (Platform.OS === 'android') {
                Linking.getInitialURL().then(this.handleAppUniversalLinkURL);
            }

            // Do this for both Android and IOS
            this.urlEventListener = Linking.addEventListener('url', this.handleUrlEvent);
        }
    }

    componentWillUnmount() {
        this.urlEventListener?.remove();
    }

    handleUrlEvent = (event) => {
        this.handleAppUniversalLinkURL(event.url);
    }

    handleAppUniversalLinkURL = (url) => {
        const { navigation, user } = this.props;
        const urlSplit = url?.split('?') || [];

        if (url?.includes('verify-account')) {
            if (urlSplit[1] && urlSplit[1].includes('token=')) {
                const verificationToken = urlSplit[1]?.split('token=')[1];
                const isAuthorized = UsersService.isAuthorized(
                    {
                        type: AccessCheckType.NONE,
                        levels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                        isPublic: true,
                    },
                    user
                );
                if (isAuthorized) {
                    navigation.navigate('EmailVerification', {
                        verificationToken,
                    });
                }
            }
        }
    }

    render() {
        const { route } = this.props;
        const { userMessage } = route?.params || '';

        return (
            <>
                <BaseStatusBar />
                <SafeAreaView  style={styles.safeAreaView}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        style={styles.bodyFlex}
                        contentContainerStyle={styles.bodyScroll}
                    >
                        {
                            this.cachedUserId ?
                                <View style={[mixins.flexCenter, mixins.marginMediumBot, mixins.marginMediumTop]}>
                                    <Image source={{ uri: `https://robohash.org/${this.cachedUserId}?size=200x200` }} loaderSize="large" />
                                </View> :
                                <View style={[mixins.flexCenter, mixins.marginMediumBot, mixins.marginMediumTop]}>
                                    <LogoIcon
                                        name="therr-logo"
                                        size={140}
                                        style={[styles.logoIcon, { marginLeft: 0 }]}
                                    />
                                </View>
                        }
                        <LoginForm login={this.props.login} navigation={this.props.navigation} userMessage={userMessage} />
                    </KeyboardAwareScrollView>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(LoginComponent);
