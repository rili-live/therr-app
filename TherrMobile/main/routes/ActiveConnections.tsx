import React from 'react';
import { SafeAreaView, ScrollView, View, StatusBar } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
import ConnectionsButtonMenu from '../components/ButtonMenu/ConnectionsButtonMenu';
import styles from '../styles';
import translator from '../services/translator';
import ActiveConnections from '../components/ActiveConnections';

interface IActiveConnectionsDispatchProps {
    logout: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends IActiveConnectionsDispatchProps {
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IActiveConnectionsProps extends IStoreProps {
    navigation: any;
}

interface IActiveConnectionsState {}

const mapStateToProps = (state) => ({
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            searchUserConnections: UserConnectionsActions.search,
        },
        dispatch
    );

class ActiveConnectionsComponent extends React.Component<
    IActiveConnectionsProps,
    IActiveConnectionsState
> {
    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {};

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { navigation, user, userConnections } = this.props;

        navigation.setOptions({
            title: this.translate('pages.activeConnections.headerTitle'),
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
        return `${connection.firstName || ''} ${
            connection.lastName || ''
        }`;
    };

    onConnectionPress = (connection) => {
        const { navigation } = this.props;

        navigation.navigate('DirectMessage', {
            connectionDetails: connection,
        });
    };

    render() {
        const { navigation, user, userConnections } = this.props;

        return (
            <>
                <StatusBar barStyle="light-content" animated={true} translucent={true} />
                <SafeAreaView>
                    <ScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        style={styles.scrollView}
                    >
                        <View style={styles.body}>
                            <ActiveConnections
                                getConnectionSubtitle={this.getConnectionSubtitle}
                                onConnectionPress={this.onConnectionPress}
                                translate={this.translate}
                                userConnections={userConnections}
                                user={user}
                            />
                        </View>
                    </ScrollView>
                </SafeAreaView>
                <ConnectionsButtonMenu navigation={navigation} user={user} />
            </>
        );
    }
}

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ActiveConnectionsComponent);
