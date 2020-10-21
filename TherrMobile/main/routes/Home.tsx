import React from 'react';
import { SafeAreaView, ScrollView, View, Text, StatusBar } from 'react-native';
import { ListItem } from 'react-native-elements';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
import ActiveConnections from '../components/ActiveConnections';
import MainButtonMenu from '../components/ButtonMenu/MainButtonMenu';
import styles from '../styles';
import UsersActions from '../redux/actions/UsersActions';
import translator from '../services/translator';

interface IHomeDispatchProps {
    logout: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends IHomeDispatchProps {
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IHomeProps extends IStoreProps {
    navigation: any;
}

interface IHomeState {}

const mapStateToProps = (state: any) => ({
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            logout: UsersActions.logout,
            searchUserConnections: UserConnectionsActions.search,
        },
        dispatch
    );

class Home extends React.Component<IHomeProps, IHomeState> {
    private translate: Function; // eslint-disable-line react/sort-comp

    constructor(props) {
        super(props);

        this.state = {};

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { navigation, user, userConnections } = this.props;

        navigation.setOptions({
            title: this.translate('pages.home.headerTitle'),
        });

        if (!userConnections.connections.length) {
            this.props
                .searchUserConnections(
                    {
                        filterBy: 'acceptingUserId',
                        query: user.details && user.details.id,
                        itemsPerPage: 50,
                        pageNumber: 1,
                        orderBy: 'interactionCount',
                        order: 'desc',
                        shouldCheckReverse: true,
                    },
                    user.details && user.details.id
                )
                .catch(() => {});
        }
    }

    getConnectionDetails = (connection) => {
        const { user } = this.props;

        // Active connection format
        if (!connection.users) {
            return connection;
        }

        // User <-> User connection format
        return (
            connection.users.find(
                (u) => user.details && u.id !== user.details.id
            ) || {}
        );
    };

    getConnectionSubtitle = (connection) => {
        const connectionDetails = this.getConnectionDetails(connection);
        return `${connectionDetails.firstName || ''} ${
            connectionDetails.lastName || ''
        }`;
    };

    onConnectionPress = (connection) => {
        const { navigation } = this.props;

        const details = this.getConnectionDetails(connection);

        navigation.navigate('DirectMessage', {
            connectionDetails: details,
        });
    };

    render() {
        const { navigation, user, userConnections } = this.props;

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
                                    How It Works?
                                </Text>
                                <Text style={styles.sectionDescription}>
                                    Welcome to the homepage. This is a work in
                                    progress...share a moment with your
                                    connections from the map or send a DM.
                                </Text>
                            </View>
                            <ActiveConnections
                                getConnectionDetails={this.getConnectionDetails}
                                getConnectionSubtitle={
                                    this.getConnectionSubtitle
                                }
                                onConnectionPress={this.onConnectionPress}
                                translate={this.translate}
                                userConnections={userConnections}
                                user={user}
                            />
                            <View style={styles.sectionContainer}>
                                <Text style={styles.sectionTitle}>
                                    Connections
                                </Text>
                                {userConnections.connections &&
                                userConnections.connections.length ? (
                                        userConnections.connections.map(
                                            (connection) => (
                                                <ListItem
                                                    key={connection.id}
                                                    leftAvatar={{
                                                        source: {
                                                            uri: `https://robohash.org/${
                                                                connection.acceptingUserId ===
                                                                user.details &&
                                                            user.details.id
                                                                    ? connection.requestingUserId
                                                                    : connection.acceptingUserId
                                                            }?size=100x100`,
                                                        },
                                                    }}
                                                    onPress={() =>
                                                        this.onConnectionPress(
                                                            connection
                                                        )
                                                    }
                                                    title={
                                                        this.getConnectionDetails(
                                                            connection
                                                        ).userName
                                                    }
                                                    subtitle={this.getConnectionSubtitle(
                                                        connection
                                                    )}
                                                    bottomDivider
                                                />
                                            )
                                        )
                                    ) : (
                                        <Text style={styles.sectionDescription}>
                                            {this.translate(
                                                'pages.userProfile.requestRecommendation'
                                            )}
                                        </Text>
                                    )}
                            </View>
                        </View>
                    </ScrollView>
                </SafeAreaView>
                <MainButtonMenu navigation={navigation} user={user} />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Home);
