import React from 'react';
import { SafeAreaView, Text, StatusBar } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
// import HostedChatButtonMenu from '../../components/ButtonMenu/HostedChatButtonMenu';
import styles from '../../styles';
import translator from '../../services/translator';

interface IHostedChatDispatchProps {
    logout: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends IHostedChatDispatchProps {
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IHostedChatProps extends IStoreProps {
    navigation: any;
}

interface IHostedChatState {}

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

class HostedChat extends React.Component<IHostedChatProps, IHostedChatState> {
    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {};

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.contacts.headerTitle'),
        });

        // TODO: Fetch available rooms on first load
    }

    render() {
        // const { navigation, user } = this.props;

        return (
            <>
                <StatusBar barStyle="light-content" animated={true} translucent={true} />
                <SafeAreaView style={styles.safeAreaView}>
                    {/* Chat search input and horizontal scroll, recommended categories list */}
                    <Text>Placeholder...</Text>
                    {/* Filterable list of hosted chats (category headers) */}
                </SafeAreaView>
                {/* <HostedChatButtonMenu navigation={navigation} translate={this.translate} user={user} /> */}
                {/* Create Chat button */}
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(HostedChat);
