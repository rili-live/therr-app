import React from 'react';
import { connect } from 'react-redux';
import { Text, View, SafeAreaView } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import 'react-native-gesture-handler';
import { IUserState } from 'therr-react/types';
import styles from '../../styles';
import RegisterForm from './RegisterForm';
import { bindActionCreators } from 'redux';
import UsersActions from '../../redux/actions/UsersActions';
import translator from '../../services/translator';
import firstTimeUIStyles from '../../styles/first-time-ui';
import BaseStatusBar from '../../components/BaseStatusBar';

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
    isAuthenticating: boolean;
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

    constructor(props) {
        super(props);

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

    render() {
        const pageTitle = this.translate('pages.register.pageTitle');

        return (
            <>
                <BaseStatusBar />
                <SafeAreaView  style={styles.safeAreaView}>
                    <KeyboardAwareScrollView style={styles.bodyFlex} contentContainerStyle={styles.bodyScroll} enableOnAndroid>
                        <View style={styles.sectionContainer}>
                            <Text style={firstTimeUIStyles.titleWithSpacing}>
                                {pageTitle}
                            </Text>
                        </View>
                        <RegisterForm register={this.props.register} onSuccess={this.onSuccess}/>
                    </KeyboardAwareScrollView>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(RegisterComponent);
