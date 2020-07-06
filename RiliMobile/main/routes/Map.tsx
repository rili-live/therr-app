import React from 'react';
import { SafeAreaView, ScrollView, View, Text, StatusBar } from 'react-native';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { IUserState } from 'rili-react/types';
import styles from '../styles';
import UsersActions from '../redux/actions/UsersActions';

interface IMapDispatchProps {
    login: Function;
    logout: Function;
}

interface IStoreProps extends IMapDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IMapProps extends IStoreProps {
    navigation: any;
}

interface IMapState {}

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

class Map extends React.Component<IMapProps, IMapState> {
    constructor(props) {
        super(props);

        this.state = {};
    }

    goToHome = () => {
        const { navigation } = this.props;

        navigation.navigate('Home');
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
                                    Map Page
                                </Text>
                                <Text style={styles.sectionDescription}>
                                    Welcome to the Map. This is a work in
                                    progress...
                                </Text>
                                <Button title="Home" onPress={this.goToHome} />
                            </View>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Map);
