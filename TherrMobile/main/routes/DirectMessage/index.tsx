import React from 'react';
import { FlatList, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/BaseButton';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { MessageActions, SocketActions } from 'therr-react/redux/actions';
import { IUserState, IMessagesState } from 'therr-react/types';
import { buildStyles } from '../../styles';
import { buildStyles as buildFormsStyles } from '../../styles/forms';
import { buildStyles as buildMessageStyles } from '../../styles/user-content/messages';
import translator from '../../utilities/translator';
import TextMessage from '../../components/TextMessage';
import RoundInput from '../../components/Input/Round';
import BaseStatusBar from '../../components/BaseStatusBar';
import TherrIcon from '../../components/TherrIcon';
import LoadingPlaceholder from './LoadingPlaceholder';
import spacingStyles from '../../styles/layouts/spacing';
import ListEmpty from '../../components/ListEmpty';
import permissions from '../../utilities/permissionsOrchestrator';

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
    isSending: boolean;
    msgInputVal: string;
    msgScrollPosition: number;
    pageNumber: number;
}

/**
 * Virtualization window for the message thread. Wider than the default so scrolling back
 * through history cannot outrun the render batch.
 */
const LIST_INITIAL_NUM_TO_RENDER = 10;
const LIST_MAX_TO_RENDER_PER_BATCH = 10;
const LIST_WINDOW_SIZE = 21;

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
    private translate: Function;
    private theme = buildStyles();
    private themeForms = buildFormsStyles();
    private themeMessage = buildMessageStyles();

    constructor(props) {
        super(props);

        this.state = {
            isLoading: false,
            isSending: false,
            msgInputVal: '',
            msgScrollPosition: 0,
            pageNumber: 1,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormsStyles(props.user.settings?.mobileThemeName);
        this.themeMessage = buildMessageStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount() {
        const { navigation, route } = this.props;
        const { connectionDetails } = route.params;

        navigation.setOptions({
            title: connectionDetails.userName,
        });

        // Always refetch on mount. A cached `dms[peerId]` may hold a single
        // socket-pushed message or a stale snapshot, which otherwise short-
        // circuits the fetch and leaves the user staring at an empty/partial
        // thread (typical when opening from the Connect → Messages tab).
        this.searchDmsByPage(1);

        // TODO: Fetch user details if missing username, name, image, etc.
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
        const { isSending, msgInputVal } = this.state;

        if (msgInputVal && !isSending) {
            const { route, sendDirectMessage, user } = this.props;
            const { connectionDetails } = route.params;

            this.setState({ isSending: true });

            sendDirectMessage({
                message: msgInputVal,
                userId: user.details && user.details.id,
                userName: user.details && user.details.userName,
                to: connectionDetails,
            });

            this.setState({
                msgInputVal: '',
            });

            // Engagement-anchored soft-ask. The first DM a user sends is when
            // the value of receiving notifications becomes obvious. No-op if
            // already asked, granted, or blocked.
            permissions.requestIfAppropriate('notifications', {
                trigger: 'firstMessageSent',
            });

            // Brief cooldown to prevent double-tap
            setTimeout(() => {
                this.setState({ isSending: false });
            }, 500);
        }
    };

    isFirstOfMessage = (messages, index) => {
        if (!messages[index + 1]) { return true; }

        const curr = messages[index];
        const next = messages[index + 1];
        if (curr.fromUserId && next.fromUserId) {
            return curr.fromUserId !== next.fromUserId;
        }
        return curr.fromUserName?.toLowerCase() !== next.fromUserName?.toLowerCase();
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
        const { isLoading, isSending, msgInputVal } = this.state;
        const { messages, route, user } = this.props;
        const { connectionDetails } = route.params;
        const dms = messages.dms ? (messages.dms[connectionDetails.id] || []) : [];

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView edges={[]} style={[this.theme.styles.safeAreaView]}>
                    {/*
                      * `behavior` has to be set on Android too. Without it the component is a
                      * documented no-op, and under edge-to-edge (API 36) the window no longer
                      * resizes for the keyboard either — so the composer stayed put and the
                      * keyboard covered it. `automaticOffset` measures this view's true position
                      * on screen, which is what the hand-tuned iOS `keyboardVerticalOffset={90}`
                      * used to approximate.
                      */}
                    <KeyboardAvoidingView
                        behavior="padding"
                        automaticOffset
                        style={this.themeMessage.styles.container}
                    >
                        {
                            isLoading ?
                                <View style={spacingStyles.flexOne}>
                                    <LoadingPlaceholder />
                                    <LoadingPlaceholder />
                                    <LoadingPlaceholder />
                                    <LoadingPlaceholder />
                                </View> :
                                dms.length === 0 ?
                                    <View style={[spacingStyles.flexOne, { justifyContent: 'center', alignItems: 'center' }]}>
                                        <ListEmpty theme={this.theme} text={this.translate(
                                            'pages.directMessage.noMessagesFound',
                                            {
                                                userName: connectionDetails.userName,
                                            }
                                        )} />
                                    </View> :
                                    <View style={spacingStyles.flexOne}>
                                        <FlatList<any>
                                            data={dms}
                                            inverted
                                            keyExtractor={(item) => String(item.id || item.key)}
                                            renderItem={({ item, index }) => {
                                                // Prefer fromUserId when available (authoritative); fall back
                                                // to the 'you' name convention for messages cached before
                                                // fromUserId started being persisted.
                                                const isFromMe = item.fromUserId
                                                    ? item.fromUserId === user.details?.id
                                                    : !!item.fromUserName?.toLowerCase().includes('you');
                                                return (
                                                    <TextMessage
                                                        connectionDetails={connectionDetails}
                                                        goToUser={this.goToUser}
                                                        userDetails={user.details}
                                                        message={item}
                                                        isLeft={!isFromMe}
                                                        isFirstOfMessage={this.isFirstOfMessage(dms, index)}
                                                        theme={this.theme}
                                                        themeMessage={this.themeMessage}
                                                        translate={this.translate}
                                                    />
                                                );
                                            }}
                                            onEndReached={this.tryLoadMore}
                                            onEndReachedThreshold={0.5}
                                            /*
                                             * Was a FlashList sized from `estimatedItemSize={60}`.
                                             * Chat bubbles are the most variable-height rows in the
                                             * app — a one-word reply and a ten-line paragraph are
                                             * the same row type — so the recycler positioned cells
                                             * from that single estimate and corrected them once the
                                             * real heights arrived, which reads as bubbles landing
                                             * in the wrong place or a blank gap mid-thread. Same
                                             * failure as the Connect lists; FlashList v1 offers no
                                             * per-row size hint, so this is a plain FlatList.
                                             *
                                             * `removeClippedSubviews` stays unset (see
                                             * routes/Areas/AreaCarousel.tsx), and it would be a
                                             * particularly bad fit here: `inverted` lists are where
                                             * its missing-content bug is most often reported.
                                             */
                                            initialNumToRender={LIST_INITIAL_NUM_TO_RENDER}
                                            maxToRenderPerBatch={LIST_MAX_TO_RENDER_PER_BATCH}
                                            windowSize={LIST_WINDOW_SIZE}
                                        />
                                    </View>
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
                                disabled={isSending || !msgInputVal}
                            />
                        </View>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(DirectMessage);
