import React from 'react';
import { SafeAreaView, FlatList, View, KeyboardAvoidingView, Platform } from 'react-native';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { MessageActions, SocketActions } from 'therr-react/redux/actions';
import { IUserState, IMessagesState } from 'therr-react/types';
import { buildStyles } from '../../styles';
import { buildStyles as buildFormsStyles } from '../../styles/forms';
import { buildStyles as buildMessageStyles } from '../../styles/user-content/messages';
import translator from '../../services/translator';
import TextMessage from '../../components/TextMessage';
import RoundInput from '../../components/Input/Round';
import BaseStatusBar from '../../components/BaseStatusBar';
import TherrIcon from '../../components/TherrIcon';
import LoadingPlaceholder from './LoadingPlaceholder';
import spacingStyles from '../../styles/layouts/spacing';
import ListEmpty from '../../components/ListEmpty';

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
    isLoading: boolean;
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
    private theme = buildStyles();
    private themeForms = buildFormsStyles();
    private themeMessage = buildMessageStyles();

    constructor(props) {
        super(props);

        this.state = {
            isLoading: false,
            msgInputVal: '',
            msgScrollPosition: 0,
            pageNumber: 1,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormsStyles(props.user.settings?.mobileThemeName);
        this.themeMessage = buildMessageStyles(props.user.settings?.mobileThemeName);
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

    goToUser = (userId) => {
        const { navigation } = this.props;
        navigation.navigate('ViewUser', {
            userInView: {
                id: userId,
            },
        });
    };

    searchDmsByPage = (pageNumber: number) => {
        const { route, searchDms } = this.props;
        const { connectionDetails } = route.params;

        if (connectionDetails) {
            this.setState({
                isLoading: true,
            });
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
            ).finally(() => {
                this.setState({
                    isLoading: false,
                });
            });
        }
    };

    handleInputChange = (val) => {
        this.setState({
            msgInputVal: val,
        });
    };

    handleSend = (e) => {
        e.preventDefault();
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
    };

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
    };

    render() {
        const { isLoading, msgInputVal } = this.state;
        const { messages, route, user } = this.props;
        const { connectionDetails } = route.params;
        const dms = messages.dms ? (messages.dms[connectionDetails.id] || []) : [];

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView style={[this.theme.styles.safeAreaView]}>
                    <KeyboardAvoidingView
                        behavior="padding"
                        style={this.themeMessage.styles.container}
                        keyboardVerticalOffset={this.themeMessage.styles.sendInputsContainer.height}
                        enabled={Platform.OS === 'ios'}
                    >
                        {
                            isLoading ?
                                <View style={spacingStyles.flex}>
                                    <LoadingPlaceholder />
                                    <LoadingPlaceholder />
                                    <LoadingPlaceholder />
                                    <LoadingPlaceholder />
                                </View> :
                                <FlatList
                                    data={dms}
                                    inverted
                                    keyExtractor={(item) => String(item.id || item.key)}
                                    renderItem={({ item, index }) => (
                                        <TextMessage
                                            connectionDetails={connectionDetails}
                                            goToUser={this.goToUser}
                                            userDetails={user.details}
                                            message={item}
                                            isLeft={!item.fromUserName?.toLowerCase().includes('you')}
                                            isFirstOfMessage={this.isFirstOfMessage(dms, index)}
                                            theme={this.theme}
                                            themeMessage={this.themeMessage}
                                            translate={this.translate}
                                        />
                                    )}
                                    ref={(component) => (this.flatListRef = component)}
                                    style={this.theme.styles.stretch}
                                    // onContentSizeChange={() => dms.length && this.flatListRef.scrollToEnd({ animated: true })}
                                    onEndReached={this.tryLoadMore}
                                    onEndReachedThreshold={0.5}
                                    ListEmptyComponent={<View>
                                        <ListEmpty theme={this.theme} text={this.translate(
                                            'pages.directMessage.noMessagesFound',
                                            {
                                                userName: connectionDetails.userName,
                                            }
                                        )} />
                                    </View>}
                                />
                        }
                        <View style={this.themeMessage.styles.sendInputsContainer}>
                            <RoundInput
                                value={msgInputVal}
                                onChangeText={this.handleInputChange}
                                placeholder={this.translate(
                                    'pages.directMessage.inputPlaceholder'
                                )}
                                onSubmitEditing={this.handleSend}
                                containerStyle={this.themeMessage.styles.inputContainer}
                                errorStyle={this.theme.styles.displayNone}
                                themeForms={this.themeForms}
                            />
                            <Button
                                icon={<TherrIcon name="send" size={26} style={this.themeMessage.styles.icon} />}
                                buttonStyle={this.themeMessage.styles.sendBtn}
                                containerStyle={this.themeMessage.styles.sendBtnContainer}
                                onPress={this.handleSend}
                            />
                        </View>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(DirectMessage);
