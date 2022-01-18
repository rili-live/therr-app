import React from 'react';
import { SafeAreaView, FlatList, Text, View } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import translator from '../../services/translator';
import CreateConnectionButton from '../../components/CreateConnectionButton';
import BaseStatusBar from '../../components/BaseStatusBar';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import ConnectionItem from './ConnectionItem';
import MessagesContactsTabs from '../../components/FlatListHeaderTabs/MessagesContactsTabs';

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
    private theme = buildStyles();
    private themeMenu = buildMenuStyles();

    constructor(props) {
        super(props);

        this.state = {};

        this.theme = buildStyles(props.user.settings.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings.mobileThemeName);
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

    handleRefresh = () => {
        console.log('refresh');
    }

    render() {
        const { navigation, user, userConnections } = this.props;
        const connections = userConnections?.activeConnections || [];

        return (
            <>
                <BaseStatusBar />
                <SafeAreaView style={this.theme.styles.safeAreaView}>
                    <FlatList
                        data={connections}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={({ item: connection }) => (
                            <ConnectionItem
                                key={connection.id}
                                connectionDetails={this.getConnectionDetails(connection)}
                                getConnectionSubtitle={this.getConnectionSubtitle}
                                onConnectionPress={this.onConnectionPress}
                            />
                        )}
                        ListEmptyComponent={() => (
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionDescription}>
                                    {this.translate(
                                        'components.activeConnections.noActiveConnections'
                                    )}
                                </Text>
                            </View>
                        )}
                        ListHeaderComponent={() => (
                            <MessagesContactsTabs
                                tabName="ActiveConnections"
                                navigation={navigation}
                                translate={this.translate}
                                containerStyles={this.themeMenu.styles.tabsContainer}
                            />
                        )}
                        stickyHeaderIndices={[0]}
                        // onContentSizeChange={() => connections.length && flatListRef.scrollToOffset({ animated: true, offset: 0 })}
                    />
                </SafeAreaView>
                <CreateConnectionButton navigation={navigation} />
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={this.handleRefresh}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />
            </>
        );
    }
}

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ActiveConnectionsComponent);
