import React from 'react';
import { SafeAreaView, FlatList, View } from 'react-native';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { MessageActions, SocketActions } from 'therr-react/redux/actions';
import { IUserState, IMessagesState } from 'therr-react/types';
import styles from '../styles';
import messageStyles from '../styles/user-content/messages';
import translator from '../services/translator';
import TextMessage from '../components/TextMessage';
import RoundInput from '../components/Input/Round';
import BaseStatusBar from '../components/BaseStatusBar';

const ITEMS_PER_PAGE = 50;

interface IDirectMessageDispatchProps {
    searchDms: Function;
    sendDirectMessage: Function;
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

interface IDirectMessageState {
    msgInputVal: string;
    msgScrollPosition: number;
    pageNumber: number;
}

const mapStateToProps = (state: any) => ({
    messages: state.messages,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            searchDms: MessageActions.searchDMs,
            sendDirectMessage: SocketActions.sendDirectMessage,
        },
        dispatch
    );

class DirectMessage extends React.Component<
    IDirectMessageProps,
    IDirectMessageState
> {
    private flatListRef: any;
    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {
            msgInputVal: '',
            msgScrollPosition: 0,
            pageNumber: 1,
        };

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { messages, navigation, route } = this.props;
        const { connectionDetails } = route.params;

        navigation.setOptions({
            title: connectionDetails.userName,
        });

        // TODO: Add logic to update this when user navigates away then returns
        if (!messages.dms || !messages.dms[connectionDetails.id]) {
            this.searchDmsByPage(1);
        }
    }

    searchDmsByPage = (pageNumber: number) => {
        const { route, searchDms } = this.props;
        const { connectionDetails } = route.params;

        if (connectionDetails) {
            searchDms(
                {
                    filterBy: 'fromUserId',
                    query: connectionDetails.id,
                    itemsPerPage: ITEMS_PER_PAGE,
                    pageNumber,
                    orderBy: 'interactionCount',
                    order: 'desc',
                    shouldCheckReverse: true,
                },
                connectionDetails
            );
        }
    }

    handleInputChange = (val) => {
        this.setState({
            msgInputVal: val,
        });
    };

    handleSend = () => {
        const { msgInputVal } = this.state;

        if (msgInputVal) {
            const { route, sendDirectMessage, user } = this.props;
            const { connectionDetails } = route.params;

            sendDirectMessage({
                message: msgInputVal,
                userId: user.details && user.details.id,
                userName: user.details && user.details.userName,
                to: connectionDetails,
            });

            this.setState({
                msgInputVal: '',
            });
        }
    };

    isFirstOfMessage = (messages, index) => {
        if (!messages[index + 1]) { return true; }

        return messages[index].fromUserName !== messages[index + 1].fromUserName;
    }

    tryLoadMore = () => {
        const { pageNumber } = this.state;
        const { messages, route } = this.props;
        const { connectionDetails } = route.params;
        const dms = messages.dms ? (messages.dms[connectionDetails.id] || []) : [];

        if (!dms.length || dms[dms.length - 1].isFirstMessage) {
            // Already loaded all historical messages
            return;
        }

        const nextPage = pageNumber + 1;
        this.searchDmsByPage(nextPage);
        this.setState({
            pageNumber: nextPage,
        });
    }

    render() {
        const { msgInputVal } = this.state;
        const { messages, route, user } = this.props;
        const { connectionDetails } = route.params;
        const dms = messages.dms ? (messages.dms[connectionDetails.id] || []) : [];

        return (
            <>
                <BaseStatusBar />
                <SafeAreaView style={[styles.safeAreaView]}>
                    <View style={messageStyles.container}>
                        <FlatList
                            data={dms}
                            inverted
                            keyExtractor={(item) => String(item.key)}
                            renderItem={({ item, index }) => (
                                <TextMessage
                                    connectionDetails={connectionDetails}
                                    userDetails={user.details}
                                    message={item}
                                    isLeft={!item.fromUserName?.toLowerCase().includes('you')}
                                    isFirstOfMessage={this.isFirstOfMessage(dms, index)}
                                />
                            )}
                            ref={(component) => (this.flatListRef = component)}
                            style={styles.stretch}
                            // onContentSizeChange={() => dms.length && this.flatListRef.scrollToEnd({ animated: true })}
                            onEndReached={this.tryLoadMore}
                            onEndReachedThreshold={10}
                        />
                        <View style={messageStyles.sendInputsContainer}>
                            <RoundInput
                                value={msgInputVal}
                                onChangeText={this.handleInputChange}
                                placeholder={this.translate(
                                    'pages.directMessage.inputPlaceholder'
                                )}
                                onSubmitEditing={() => this.handleSend()}
                                containerStyle={messageStyles.inputContainer}
                                errorStyle={styles.displayNone}
                            />
                            <Button
                                icon={<Icon name="send" size={26} style={messageStyles.icon} />}
                                buttonStyle={messageStyles.sendBtn}
                                containerStyle={messageStyles.sendBtnContainer}
                                onPress={this.handleSend}
                            />
                        </View>
                    </View>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(DirectMessage);
