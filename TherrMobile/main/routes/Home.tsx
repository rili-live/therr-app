import React from 'react';
import { SafeAreaView, ScrollView, View, Text, StatusBar } from 'react-native';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { IUserState } from 'rili-react/types';
import styles from '../styles';
import UsersActions from '../redux/actions/UsersActions';

interface IHomeDispatchProps {
    login: Function;
    logout: Function;
}

interface IStoreProps extends IHomeDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IHomeProps extends IStoreProps {
    navigation: any;
}

interface IHomeState {}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            login: UsersActions.login,
            logout: UsersActions.logout,
        },
        dispatch
    );

class Home extends React.Component<IHomeProps, IHomeState> {
    constructor(props) {
        super(props);

        this.state = {};
    }

    goToMap = () => {
        const { navigation } = this.props;

        navigation.navigate('Map');
    };

    handleLogout = () => {
        const { user, logout, navigation } = this.props;

        logout(user.details)
            .then(() => {
                navigation.navigate('Login');
            })
            .catch((e) => {
                console.log(e);
            });
    };

    render() {
        return (
            <>
                <StatusBar barStyle="dark-content" />
                <SafeAreaView>
                    <ScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        style={styles.scrollView}
                    >
                        <View style={styles.body}>
                            <View style={styles.sectionContainer}>
                                <Text style={styles.sectionTitle}>
                                    Home Page
                                </Text>
                                <Text style={styles.sectionDescription}>
                                    Welcome to the homepage. This is a work in
                                    progress...
                                </Text>
                                <Button
                                    title="MAP"
                                    onPress={this.goToMap}
                                    containerStyle={{
                                        marginBottom: 10,
                                    }}
                                />
                                <Button
                                    title="LOGOUT"
                                    onPress={this.handleLogout}
                                />
                            </View>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Home);
