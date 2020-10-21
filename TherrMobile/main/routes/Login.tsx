import React from 'react';
import { connect } from 'react-redux';
import { SafeAreaView, View, StatusBar } from 'react-native';
import 'react-native-gesture-handler';
import { IUserState } from 'therr-react/types';
import styles from '../styles';
import LoginForm from '../components/LoginForm';
import { bindActionCreators } from 'redux';
import UsersActions from '../redux/actions/UsersActions';
import translator from '../services/translator';

interface ILoginDispatchProps {
    login: Function;
}

interface IStoreProps extends ILoginDispatchProps {
    user: IUserState;
}

// Regular component props
export interface ILoginProps extends IStoreProps {
    navigation: any;
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
    constructor(props) {
        super(props);

        this.translate = (key: string, params: any): string =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        this.props.navigation.setOptions({
            title: this.translate('pages.login.headerTitle'),
        });
    }

    private translate;

    render() {
        return (
            <>
                <StatusBar barStyle="dark-content" />
                <SafeAreaView>
                    <View style={styles.body}>
                        <View style={styles.sectionContainer} />
                        <LoginForm login={this.props.login} />
                    </View>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(LoginComponent);
