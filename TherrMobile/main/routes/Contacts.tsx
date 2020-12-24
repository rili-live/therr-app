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
import ContactsSearch from '../components/ContactsSearch';

interface IContactsDispatchProps {
    logout: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends IContactsDispatchProps {
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IContactsProps extends IStoreProps {
    navigation: any;
}

interface IContactsState {}

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

class Contacts extends React.Component<IContactsProps, IContactsState> {
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
            title: this.translate('pages.contacts.headerTitle'),
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

    getConnectionSubtitle = (connectionDetails) => {
        return `${connectionDetails.firstName || ''} ${
            connectionDetails.lastName || ''
        }`;
    };

    onConnectionPress = (connectionDetails) => {
        const { navigation } = this.props;

        navigation.navigate('DirectMessage', {
            connectionDetails,
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
                            <ContactsSearch
                                getConnectionDetails={this.getConnectionDetails}
                                getConnectionSubtitle={
                                    this.getConnectionSubtitle
                                }
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

export default connect(mapStateToProps, mapDispatchToProps)(Contacts);
