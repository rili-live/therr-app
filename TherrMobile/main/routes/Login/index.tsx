import React from 'react';
import { connect } from 'react-redux';
import { SafeAreaView, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Image from '../../components/BaseImage';
import 'react-native-gesture-handler';
import { IUserState } from 'therr-react/types';
import { createIconSetFromIcoMoon } from 'react-native-vector-icons';
import { buildStyles } from '../../styles';
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
    private theme = buildStyles();

    constructor(props) {
        super(props);

        this.theme = buildStyles(props.user?.settings?.mobileThemeName);
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
        }
    }

    render() {
        const { route, user } = this.props;
        const { userMessage } = route?.params || '';

        return (
            <>
                <BaseStatusBar />
                <SafeAreaView  style={this.theme.styles.safeAreaView}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        style={this.theme.styles.bodyFlex}
                        contentContainerStyle={this.theme.styles.bodyScroll}
                    >
                        {
                            this.cachedUserId ?
                                <View style={[mixins.flexCenter, mixins.marginMediumBot, mixins.marginMediumTop]}>
                                    <Image source={{ uri: `https://robohash.org/${this.cachedUserId}?size=200x200` }} loaderSize="large" theme={this.theme} />
                                </View> :
                                <View style={[mixins.flexCenter, mixins.marginMediumBot, mixins.marginMediumTop]}>
                                    <LogoIcon
                                        name="therr-logo"
                                        size={140}
                                        style={[this.theme.styles.logoIcon, { marginLeft: 0 }]}
                                    />
                                </View>
                        }
                        <LoginForm
                            login={this.props.login}
                            navigation={this.props.navigation}
                            userMessage={userMessage}
                            userSettings={user?.settings || {}} />
                    </KeyboardAwareScrollView>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(LoginComponent);
