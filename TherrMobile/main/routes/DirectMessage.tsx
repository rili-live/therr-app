import React from 'react';
import { SafeAreaView, FlatList, View, Text, StatusBar } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { MessageActions } from 'therr-react/redux/actions';
import { IUserState, IMessagesState } from 'therr-react/types';
import styles from '../styles';
import messageStyles from '../styles/messages';
import translator from '../services/translator';

interface IDirectMessageDispatchProps {
    searchDms: Function;
}

interface IStoreProps extends IDirectMessageDispatchProps {
    messages?: IMessagesState;
    user: IUserState;
}

// Regular component props
export interface IDirectMessageProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IDirectMessageState {}

const mapStateToProps = (state: any) => ({
    messages: state.messages,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            searchDms: MessageActions.search,
        },
        dispatch
    );

class DirectMessage extends React.Component<
    IDirectMessageProps,
    IDirectMessageState
> {
    private translate: Function; // eslint-disable-line react/sort-comp

    constructor(props) {
        super(props);

        this.state = {};

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { messages, route, searchDms } = this.props;
        const { connectionDetails } = route.params;

        if (!messages.dms[connectionDetails.id]) {
            searchDms(
                {
                    filterBy: 'fromUserId',
                    query: connectionDetails.id,
                    itemsPerPage: 50,
                    pageNumber: 1,
                    orderBy: 'interactionCount',
                    order: 'desc',
                    shouldCheckReverse: true,
                },
                connectionDetails
            );
        }
    }

    render() {
        const { messages, route } = this.props;
        const { connectionDetails } = route.params;
        const dms = messages.dms[connectionDetails.id];
        console.log('DMS', dms);

        return (
            <>
                <StatusBar barStyle="dark-content" />
                <SafeAreaView style={messageStyles.container}>
                    <View style={styles.body}>
                        <View style={styles.sectionContainer}>
                            <Text style={styles.sectionTitle}>
                                {connectionDetails.firstName}{' '}
                                {connectionDetails.lastName} -{' '}
                                {connectionDetails.userName}
                            </Text>
                        </View>
                    </View>
                    <FlatList
                        data={dms}
                        keyExtractor={(item) => String(item.key)}
                        renderItem={({ item }) => (
                            <Text
                                style={messageStyles.item}
                            >{`(${item.time}) ${item.text}`}</Text>
                        )}
                    />
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(DirectMessage);
