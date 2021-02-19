import React from 'react';
import { SafeAreaView, ActivityIndicator, FlatList, View, Text, StatusBar } from 'react-native';
import { Button, Image } from 'react-native-elements';
import 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { MessageActions, SocketActions } from 'therr-react/redux/actions';
import { IUserState, IMessagesState } from 'therr-react/types';
import styles from '../styles';
import messageStyles from '../styles/messages';
import translator from '../services/translator';
import TextMessage from '../components/TextMessage';
import RoundInput from '../components/Input/Round';

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
    private mountTimeoutId;
    private failTimeoutId;
    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {
            msgInputVal: '',
            msgScrollPosition: 0,
        };

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { messages, navigation, route, searchDms } = this.props;
        const { connectionDetails } = route.params;

        navigation.setOptions({
            title: connectionDetails.userName,
        });

        if (connectionDetails && !messages.dms[connectionDetails.id]) {
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

        const { msgScrollPosition } = this.state;
        // To prevent FlatList scrolls to top automatically,
        // we have to delay scroll to the original position
        this.mountTimeoutId = setTimeout(() => {
            if (this.flatListRef && this.flatListRef.props.data && this.flatListRef.props.data.length) {
                msgScrollPosition
                    ? this.flatListRef.scrollToOffset({
                        offset: msgScrollPosition,
                        animated: true,
                    })
                    : this.flatListRef.scrollToIndex({
                        index: this.flatListRef.props.data
                            ? this.flatListRef.props.data.length - 1
                            : 0,
                        animated: true,
                    });
            }
        }, 500);
    }

    componentDidUpdate(prevProps: IDirectMessageProps) {
        const { route, messages } = this.props;
        const { connectionDetails } = route.params;
        const dms =
            (messages.dms &&
                messages.dms[connectionDetails && connectionDetails.id]) ||
            [];
        const prevMessages =
            (prevProps.messages.dms &&
                prevProps.messages.dms[
                    connectionDetails && connectionDetails.id
                ]) ||
            [];

        if (dms && dms.length > 3 && dms.length > prevMessages.length) {
            this.scrollToListEnd();
        }
    }

    componentWillUnmount = () => {
        clearTimeout(this.mountTimeoutId);
        clearTimeout(this.failTimeoutId);
    };

    handleInputChange = (val) => {
        this.setState({
            msgInputVal: val,
        });
    };

    handleScroll = (event) => {
        this.setState({ msgScrollPosition: event.nativeEvent.contentOffset.y });
    };

    handleScrollToIndexFailed = (info) => {
        this.failTimeoutId = setTimeout(() => {
            if (this.flatListRef) {
                this.flatListRef.scrollToIndex({
                    index: info.index,
                    animated: true,
                });
            }
        }, 500);
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

    scrollToListEnd = () => {
        if (this.flatListRef) {
            this.flatListRef.scrollToIndex({
                index: this.flatListRef.props.data.length - 1,
                animated: true,
            });
        }
    };

    render() {
        const { msgInputVal } = this.state;
        const { messages, route } = this.props;
        const { connectionDetails } = route.params;
        const dms = messages.dms[connectionDetails.id];

        return (
            <>
                <StatusBar barStyle="light-content" animated={true} translucent={true} />
                <SafeAreaView style={[styles.safeAreaView]}>
                    <View style={messageStyles.container}>
                        <View style={styles.body}>
                            <View style={messageStyles.sectionContainer}>
                                <Image
                                    source={{ uri: `https://robohash.org/${connectionDetails.id}?size=50x50` }}
                                    style={messageStyles.userImage}
                                    PlaceholderContent={<ActivityIndicator />}
                                />
                                <Text style={styles.sectionTitle}>
                                    {connectionDetails.firstName}{' '}
                                    {connectionDetails.lastName}
                                </Text>
                            </View>
                        </View>
                        <FlatList
                            data={dms}
                            keyExtractor={(item) => String(item.key)}
                            onScroll={this.handleScroll}
                            renderItem={({ item }) => (
                                <TextMessage
                                    message={item}
                                    isLeft={item.fromUserName.includes('You')}
                                />
                            )}
                            ref={(component) => (this.flatListRef = component)}
                            initialScrollIndex={0}
                            onScrollToIndexFailed={this.handleScrollToIndexFailed}
                            style={styles.stretch}
                        />
                        <View style={messageStyles.sendInputsContainer}>
                            <RoundInput
                                value={msgInputVal}
                                onChangeText={this.handleInputChange}
                                placeholder={this.translate(
                                    'pages.directMessage.inputPlaceholder'
                                )}
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
