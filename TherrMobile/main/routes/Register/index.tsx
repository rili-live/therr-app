import React from 'react';
import { connect } from 'react-redux';
import { Text, View, SafeAreaView } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import 'react-native-gesture-handler';
import { IUserState } from 'therr-react/types';
import { buildStyles } from '../../styles';
import RegisterForm from './RegisterForm';
import { bindActionCreators } from 'redux';
import UsersActions from '../../redux/actions/UsersActions';
import translator from '../../services/translator';
import firstTimeUIStyles from '../../styles/first-time-ui';
import BaseStatusBar from '../../components/BaseStatusBar';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import eula from '../Map/EULA';

interface IRegisterDispatchProps {
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
            register: UsersActions.register,
        },
        dispatch
    );

class RegisterComponent extends React.Component<IRegisterProps, IRegisterState> {
    private translate;
    private theme = buildStyles();

    constructor(props) {
        super(props);

        this.state = {
            isEULAVisible: false,
        };

        this.theme = buildStyles(props.user.settings.mobileThemeName);
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
    }

    toggleEULA = () => {
        const { isEULAVisible } = this.state;
        this.setState({
            isEULAVisible: !isEULAVisible,
        });
    }

    render() {
        const { isEULAVisible } = this.state;
        const pageTitle = this.translate('pages.register.pageTitle');

        return (
            <>
                <BaseStatusBar />
                <SafeAreaView  style={this.theme.styles.safeAreaView}>
                    <KeyboardAwareScrollView style={this.theme.styles.bodyFlex} contentContainerStyle={this.theme.styles.bodyScroll} enableOnAndroid>
                        <View style={this.theme.styles.sectionContainer}>
                            <Text style={firstTimeUIStyles.titleWithSpacing}>
                                {pageTitle}
                            </Text>
                        </View>
                        <RegisterForm register={this.props.register} onSuccess={this.onSuccess} toggleEULA={this.toggleEULA} />
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
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(RegisterComponent);
