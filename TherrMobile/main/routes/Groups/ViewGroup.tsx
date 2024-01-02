import React from 'react';
import {
    FlatList,
    SafeAreaView,
    Text,
    View,
} from 'react-native';
import { Button } from 'react-native-elements';
// import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
// import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import { MessageActions, SocketActions, UserConnectionsActions } from 'therr-react/redux/actions';
import { IMesssageState, IUserState, IUserConnectionsState } from 'therr-react/types';
// import ViewChatButtonMenu from '../../components/ButtonMenu/ViewChatButtonMenu';
import translator from '../../services/translator';
// import RoundInput from '../../components/Input/Round';
import { buildStyles } from '../../styles';
import { buildStyles as buildAccentStyles } from '../../styles/layouts/accent';
import { buildStyles as buildChatStyles } from '../../styles/user-content/groups/view-group';
import { buildStyles as buildMessageStyles } from '../../styles/user-content/messages';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildAccentFormStyles } from '../../styles/forms/accentEditForm';
import HashtagsContainer from '../../components/UserContent/HashtagsContainer';
import BaseStatusBar from '../../components/BaseStatusBar';
import { getUserImageUri } from '../../utilities/content';
import { PEOPLE_CAROUSEL_TABS } from '../../constants';
import RoundInput from '../../components/Input/Round';
import TherrIcon from '../../components/TherrIcon';
import ForumMessage from './ForumMessage';
import LoadingPlaceholder from './LoadingPlaceholder';

const ITEMS_PER_PAGE = 50;

interface IViewChatDispatchProps {
    joinForum: Function;
    logout: Function;
    searchForumMessages: Function;
    sendForumMessage: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends IViewChatDispatchProps {
    messages: IMesssageState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IViewChatProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IViewChatState {
    msgInputVal: string;
    isLoading: boolean;
    pageNumber: number;
}

const mapStateToProps = (state) => ({
    messages: state.messages,
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            joinForum: SocketActions.joinForum,
            searchForumMessages: MessageActions.searchForumMessages,
            sendForumMessage: SocketActions.sendForumMessage,
            searchUserConnections: UserConnectionsActions.search,
        },
        dispatch
    );

class ViewChat extends React.Component<IViewChatProps, IViewChatState> {
    private hashtags;
    private flatListRef: FlatList<any> | null = null;
    private scrollViewRef;
    private translate: Function;
    private theme = buildStyles();
    private themeChat = buildChatStyles();
    private themeAccentLayout = buildAccentStyles();
    private themeMessage = buildMessageStyles();
    private themeForms = buildFormStyles();
    private themeAccentForms = buildAccentFormStyles();

    constructor(props) {
        super(props);

        const { hashTags } = props.route.params;
        this.hashtags = hashTags ? hashTags.split(',') : [];

        this.state = {
            msgInputVal: '',
            isLoading: false,
            pageNumber: 1,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeAccentLayout = buildAccentStyles(props.user.settings?.mobileThemeName);
        this.themeChat = buildChatStyles(props.user.settings?.mobileThemeName);
        this.themeMessage = buildMessageStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeAccentForms = buildAccentFormStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const {
            joinForum,
            navigation,
            route,
            user,
        } = this.props;
        const { title, id: forumId } = route.params;

        navigation.setOptions({
            title,
        });

        joinForum({
            roomId: forumId,
            roomName: title,
            userId: user.details.id,
            userName: user.details.userName,
            userImgSrc: getUserImageUri(user.details, 100),
        });

        // TODO: Add logic to update this when user navigates away then returns
        this.searchForumMsgsByPage(1);
    }

    searchForumMsgsByPage = (pageNumber: number) => {
        const { searchForumMessages, user, route } = this.props;
        const { id: forumId } = route.params;

        this.setState({
            isLoading: true,
        });
        return new Promise((resolve) => searchForumMessages(
            forumId,
            user.details.id,
            {
                itemsPerPage: ITEMS_PER_PAGE,
                pageNumber,
                // order: 'desc',
            }
        ).finally(() => {
            this.setState({
                isLoading: false,
            }, () => resolve(null));
        }));
    };

    tryLoadMore = () => {
        const { pageNumber } = this.state;
        const { messages, route } = this.props;
        const { id: forumId } = route.params;
        const msgs = messages.forumMsgs ? (messages.forumMsgs[forumId] || []) : [];

        if (!msgs.length || msgs[msgs.length - 1].isFirstMessage || msgs.length > 200) {
            // Don't load more than 200 historical messages
            return;
        }

        const nextPage = pageNumber + 1;
        this.searchForumMsgsByPage(nextPage);
        this.setState({
            pageNumber: nextPage,
        });
    };

    goToUser = (userId) => {
        const { navigation } = this.props;
        navigation.navigate('ViewUser', {
            userInView: {
                id: userId,
            },
        });
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
            const { sendForumMessage, user } = this.props;

            sendForumMessage({
                roomId: user.socketDetails.currentRoom,
                message: msgInputVal,
                userId: user.details.id,
                userName: user.details.userName,
                userImgSrc: getUserImageUri(user.details, 100),
            });

            this.setState({
                msgInputVal: '',
            });
        }
    };

    render() {
        const { isLoading, msgInputVal } = this.state;
        const { messages, navigation, route, user } = this.props;
        const { description, subtitle, id: forumId } = route.params;
        const mgs = messages.forumMsgs[forumId] || [];

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView style={this.theme.styles.safeAreaView}>
                    <View
                        style={[this.theme.styles.bodyFlex, this.themeAccentLayout.styles.bodyEdit]}
                    >
                        <View style={this.themeAccentLayout.styles.containerHeader}>
                            {
                                subtitle &&
                                <Text>
                                    <Text style={{ fontWeight: 'bold' }}>{this.translate('pages.groups.labels.subtitle')}</Text> {subtitle}
                                </Text>
                            }
                            <Text>
                                <Text style={{ fontWeight: 'bold' }}>
                                    {this.translate('pages.groups.labels.description')}
                                </Text> {description}
                            </Text>
                            <HashtagsContainer
                                hasIcon={false}
                                hashtags={this.hashtags}
                                onHashtagPress={() => {}}
                                styles={this.themeForms.styles}
                            />
                        </View>
                        <View style={[this.themeAccentLayout.styles.container, this.themeChat.styles.container]}>
                            {
                                isLoading ?
                                    <>
                                        <LoadingPlaceholder />
                                        <LoadingPlaceholder />
                                        <LoadingPlaceholder />
                                        <LoadingPlaceholder />
                                    </> :
                                    <FlatList
                                        data={mgs}
                                        inverted
                                        stickyHeaderIndices={[0]}
                                        renderItem={({ item }) => (
                                            <ForumMessage
                                                item={item}
                                                theme={this.theme}
                                                themeChat={this.themeChat}
                                                themeMessage={this.themeMessage}
                                                userDetails={user.details}
                                                fromUserDetails={{
                                                    id: item.fromUserId,
                                                    userName: item.fromUserName,
                                                    firstName: item.fromUserFirstName,
                                                    lastName: item.fromUserLastName,
                                                    media: item.fromUserMedia,
                                                }}
                                                goToUser={this.goToUser}
                                            />
                                        )}
                                        ref={(component) => (this.flatListRef = component)}
                                        style={this.theme.styles.stretch}
                                        // onContentSizeChange={() => mgs.length && this.flatListRef.scrollToEnd({ animated: true })}
                                        // onEndReached={this.tryLoadMore}
                                        // onEndReachedThreshold={0.5}
                                    />
                            }
                        </View>
                    </View>
                    <View style={[this.themeAccentLayout.styles.footer, this.themeChat.styles.footer]}>
                        <Button
                            containerStyle={this.themeAccentForms.styles.backButtonContainerFixed}
                            buttonStyle={this.themeAccentForms.styles.backButton}
                            onPress={() => navigation.navigate('Contacts', {
                                activeTab: PEOPLE_CAROUSEL_TABS.GROUPS,
                            })}
                            icon={
                                <FontAwesome5Icon
                                    name="arrow-left"
                                    size={25}
                                    color={'black'}
                                />
                            }
                            type="clear"
                        />
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
                            containerStyle={[this.themeMessage.styles.sendBtnContainer, this.themeChat.styles.sendBtnContainer]}
                            onPress={this.handleSend}
                        />
                    </View>
                </SafeAreaView>
                {/* <ViewChatButtonMenu navigation={navigation} translate={this.translate} user={user} /> */}
                {/* Create Chat button */}
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ViewChat);
