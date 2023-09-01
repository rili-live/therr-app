import React from 'react';
import {
    Keyboard,
    SafeAreaView,
    View,
} from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Button } from 'react-native-elements';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
// import { Button }  from 'react-native-elements';
// import changeNavigationBarColor from 'react-native-navigation-bar-color';
import { IContentState, IUserState } from 'therr-react/types';
import { ContentActions } from 'therr-react/redux/actions';
import UsersActions from '../redux/actions/UsersActions';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import analytics from '@react-native-firebase/analytics';
// import YoutubePlayer from 'react-native-youtube-iframe';
// import Alert from '../components/Alert';
import translator from '../services/translator';
import { buildStyles } from '../styles';
import { buildStyles as buildReactionsModalStyles } from '../styles/modal/areaReactionsModal';
import { buildStyles as buildFormStyles } from '../styles/forms';
import { buildStyles as buildAccentFormStyles } from '../styles/forms/accentEditForm';
import { buildStyles as buildAccentStyles } from '../styles/layouts/accent';
import { buildStyles as buildButtonsStyles } from '../styles/buttons';
import { buildStyles as buildThoughtStyles } from '../styles/user-content/thoughts/viewing';
// import userContentStyles from '../styles/user-content';
// import { youtubeLinkRegex } from '../constants';
import ThoughtDisplay from '../components/UserContent/ThoughtDisplay';
import formatDate from '../utilities/formatDate';
import BaseStatusBar from '../components/BaseStatusBar';
import { isMyContent as checkIsMyContent } from '../utilities/content';
import ThoughtOptionsModal, { ISelectionType } from '../components/Modals/ThoughtOptionsModal';
import { getReactionUpdateArgs } from '../utilities/reactions';
import TherrIcon from '../components/TherrIcon';
import RoundTextInput from '../components/Input/TextInput/Round';
// import AccentInput from '../components/Input/Accent';

const hapticFeedbackOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
};

interface IViewThoughtDispatchProps {
    getThoughtDetails: Function;
    deleteThought: Function;
    createThought: Function;
    createOrUpdateThoughtReaction: Function;
}

interface IStoreProps extends IViewThoughtDispatchProps {
    content: IContentState;
    user: IUserState;
}

// Regular component props
export interface IViewThoughtProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IViewThoughtState {
    areThoughtOptionsVisible: boolean;
    errorMsg: string;
    successMsg: string;
    replies: any[],
    inputs: any;
    isSubmitting: boolean;
    isDeleting: boolean;
    isVerifyingDelete: boolean;
    fetchedThought: any;
    // previewLinkId?: string;
    // previewStyleState: any;
    selectedThought: any;
}

const mapStateToProps = (state) => ({
    content: state.content,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    createThought: UsersActions.createThought,
    getThoughtDetails: UsersActions.getThoughtDetails,
    deleteThought: UsersActions.deleteThought,
    createOrUpdateThoughtReaction: ContentActions.createOrUpdateThoughtReaction,
}, dispatch);

export class ViewThought extends React.Component<IViewThoughtProps, IViewThoughtState> {
    private date;
    private hashtags;
    private scrollViewRef;
    private translate: Function;
    private unsubscribeNavListener;
    private replyInput;
    private theme = buildStyles();
    private themeAccentLayout = buildAccentStyles();
    private themeButtons = buildButtonsStyles();
    private themeThought = buildThoughtStyles();
    private themeReactionsModal = buildReactionsModalStyles();
    private themeForms = buildFormStyles();
    private themeAccentForms = buildAccentFormStyles();

    constructor(props) {
        super(props);

        const { route } = props;
        const { thought } = route.params;

        // const youtubeMatches = (thought.message || '').match(youtubeLinkRegex);

        this.state = {
            areThoughtOptionsVisible: false,
            errorMsg: '',
            replies: [],
            successMsg: '',
            isDeleting: false,
            isSubmitting: false,
            isVerifyingDelete: false,
            inputs: {
                message: '',
            },
            fetchedThought: {},
            // previewStyleState: {},
            // previewLinkId: youtubeMatches && youtubeMatches[1],
            selectedThought: {},
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
        this.themeAccentLayout = buildAccentStyles(props.user.settings?.mobileThemeName);
        this.themeThought = buildThoughtStyles(props.user.settings?.mobileThemeName, true);
        this.themeReactionsModal = buildReactionsModalStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeAccentForms = buildAccentFormStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) => translator('en-us', key, params);

        this.hashtags = thought.hashTags ? thought.hashTags.split(',') : [];

        this.date = formatDate(thought.createdAt);

        // changeNavigationBarColor(therrTheme.colors.accent1, false, true);
    }

    componentDidMount() {
        const { getThoughtDetails, navigation, route } = this.props;
        const { thought } = route.params;

        // Move thought details out of route params and into redux
        getThoughtDetails(thought.id, {
            withUser: true, // This will also get reply users
            withReplies: true,
        }).then((response) => {
            this.setState({
                fetchedThought: response?.thought,
                replies: response?.thought?.replies?.sort((a, b) => new Date(b.createdAt).getTime()  - new Date(a.createdAt).getTime()) || [],
            });
        }).catch(() => {
            navigation.goBack();
        });

        navigation.setOptions({
            title: this.translate('pages.viewThought.headerTitle'),
        });

        this.unsubscribeNavListener = navigation.addListener('beforeRemove', () => {
            // changeNavigationBarColor(therrTheme.colors.primary, false, true);
        });
    }

    componentWillUnmount() {
        this.unsubscribeNavListener();
    }

    renderHashtagPill = (tag, key) => {
        return (
            <Button
                key={key}
                buttonStyle={this.themeForms.styles.buttonPill}
                containerStyle={this.themeForms.styles.buttonPillContainer}
                titleStyle={this.themeForms.styles.buttonPillTitle}
                title={`#${tag}`}
            />
        );
    };

    isFormDisabled() {
        const { inputs, isSubmitting } = this.state;

        return (
            !inputs.message ||
            isSubmitting
        );
    }

    // handlePreviewFullScreen = (isFullScreen) => {
    //     const previewStyleState = isFullScreen ? {
    //         top: 0,
    //         left: 0,
    //         padding: 0,
    //         margin: 0,
    //         position: 'absolute',
    //         zIndex: 20,
    //     } : {};
    //     this.setState({
    //         previewStyleState,
    //     });
    // }

    onDelete = () => {
        this.setState({
            isVerifyingDelete: true,
        });
    };

    onDeleteCancel = () => {
        this.setState({
            isVerifyingDelete: false,
        });
    };

    onDeleteConfirm = () => {
        const { deleteThought, navigation, route, user } = this.props;
        const { thought } = route.params;

        this.setState({
            isDeleting: true,
        });
        if (checkIsMyContent(thought, user)) {
            deleteThought({ ids: [thought.id] })
                .then(() => {
                    navigation.navigate('Areas');
                })
                .catch((err) => {
                    console.log('Error deleting thought', err);
                    this.setState({
                        isDeleting: true,
                        isVerifyingDelete: false,
                    });
                });
        }
    };

    onThoughtOptionSelect = (type: ISelectionType) => {
        const { selectedThought } = this.state;

        const requestArgs: any = getReactionUpdateArgs(type);

        this.onUpdateThoughtReaction(selectedThought.id, requestArgs).finally(() => {
            this.toggleThoughtOptions(selectedThought);
        });
    };

    onInputChange = (name: string, value: string) => {
        // const { hashtags } = this.state;
        // let modifiedHashtags = [ ...hashtags ];
        let modifiedValue = value;
        const newInputChanges = {
            [name]: modifiedValue,
        };

        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
            isSubmitting: false,
        });
    };

    onSubmitReply = () => {
        const {
            category,
            message,
        } = this.state.inputs;
        const {
            route,
            user,
        } = this.props;
        const { thought } = route.params;

        const hashTags = message.match(/#[a-z0-9_]+/g) || [];
        const parentId = thought.id;
        const hashTagsString = hashTags.join(',');
        const isDraft = false;
        const isPublic = false;

        const createArgs: any = {
            parentId,
            category,
            fromUserId: user.details.id,
            isPublic,
            message,
            hashTags: hashTagsString,
            isDraft,
        };

        if (!this.isFormDisabled()) {
            ReactNativeHapticFeedback.trigger('impactLight', hapticFeedbackOptions);

            this.setState({
                isSubmitting: true,
            });

            this.props.createThought(createArgs)
                .then((newReply) => {
                    const { replies } = this.state;
                    const newReplies = [ newReply, ...replies ];
                    this.setState({
                        replies: newReplies,
                        successMsg: this.translate('forms.editThought.backendSuccessMessage'),
                    });

                    analytics().logEvent('thought_reply_create', {
                        parentId,
                        category,
                        fromUserId: user.details.id,
                        isPublic,
                        message,
                        hashTags: hashTagsString,
                        isDraft,
                    }).catch((err) => console.log(err));
                })
                .catch((error: any) => {
                    if (
                        error.statusCode === 400 ||
                        error.statusCode === 401 ||
                        error.statusCode === 404
                    ) {
                        this.setState({
                            errorMsg: `${error.message}${
                                error.parameters
                                    ? '(' + error.parameters.toString() + ')'
                                    : ''
                            }`,
                        });
                    } else if (error.statusCode >= 500) {
                        this.setState({
                            errorMsg: this.translate('forms.editThought.backendErrorMessage'),
                        });
                    }
                })
                .finally(() => {
                    this.onInputChange('message', '');
                    if (this.replyInput) {
                        this.replyInput.clear();
                    }
                    this.setState({
                        isSubmitting: false,
                    });
                    Keyboard.dismiss();
                    this.scrollViewRef.scrollToOffset({ animated: true, offset: 0 });
                });
        }
    };

    getReplyUserName = (reply) => {
        const { user } = this.props;
        return checkIsMyContent(reply, user) ? user.details.userName : reply.fromUserName;
    };

    getReplyUserMedia = (reply) => {
        const { user } = this.props;
        return checkIsMyContent(reply, user) ? user.details.media : reply.fromUserMedia;
    };

    goBack = () => {
        const { navigation, route } = this.props;
        const { previousView } = route.params;
        if (previousView && (previousView === 'Areas' || previousView === 'Notifications')) {
            if (previousView === 'Areas') {
                navigation.goBack();
            } else if (previousView === 'Notifications') {
                navigation.navigate('Notifications');
            }
        } else {
            navigation.navigate('Map', {
                shouldShowPreview: false,
            });
        }
    };

    goToViewUser = (userId) => {
        const { navigation } = this.props;

        navigation.navigate('ViewUser', {
            userInView: {
                id: userId,
            },
        });
    };

    onUpdateThoughtReaction = (thoughtId, data) => {
        const { createOrUpdateThoughtReaction, navigation, route, user } = this.props;
        const { thought } = route.params;
        navigation.setParams({
            thought: {
                ...thought,
                reaction: {
                    ...thought.reaction,
                    ...data,
                },
            },
        });
        return createOrUpdateThoughtReaction(thoughtId, data, thought.fromUserId, user.details.userName);
    };

    toggleThoughtOptions = (area) => {
        const { areThoughtOptionsVisible } = this.state;

        this.setState({
            areThoughtOptionsVisible: !areThoughtOptionsVisible,
            selectedThought: areThoughtOptionsVisible ? {} : area,
        });
    };

    render() {
        const {
            areThoughtOptionsVisible,
            inputs,
            isDeleting,
            isSubmitting,
            isVerifyingDelete,
            replies,
            fetchedThought,
            // previewLinkId,
            // previewStyleState,
            selectedThought,
        } = this.state;
        const { route, user } = this.props;
        const { thought, isMyContent } = route.params;
        // TODO: Fetch thought media
        const thoughtUserName = isMyContent ? user.details.userName : thought.fromUserName;
        const thoughtInView = {
            ...thought,
            ...fetchedThought,
        };

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView  style={this.theme.styles.safeAreaView}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        ref={(component) => (this.scrollViewRef = component)}
                        style={[this.theme.styles.bodyFlex, this.themeAccentLayout.styles.bodyView]}
                        contentContainerStyle={[this.theme.styles.bodyScroll, this.themeAccentLayout.styles.bodyViewScroll]}
                    >
                        <View style={[this.themeAccentLayout.styles.container, this.themeThought.styles.inspectThoughtContainer, { paddingHorizontal: 4 }]}>
                            <ThoughtDisplay
                                translate={this.translate}
                                date={this.date}
                                toggleThoughtOptions={() => this.toggleThoughtOptions(thoughtInView)}
                                hashtags={this.hashtags}
                                isDarkMode={true}
                                isExpanded={true}
                                isRepliable={true}
                                inspectThought={() => null}
                                thought={thoughtInView}
                                goToViewUser={this.goToViewUser}
                                updateThoughtReaction={this.onUpdateThoughtReaction}
                                // TODO: User Username from response
                                user={user}
                                contentUserDetails={{
                                    userName: thoughtUserName || thoughtInView.fromUserId,
                                }}
                                theme={this.theme}
                                themeForms={this.themeForms}
                                themeViewContent={this.themeThought}
                            />
                            <View style={this.themeThought.styles.sendInputsContainer}>
                                <RoundTextInput
                                    ref={input => { this.replyInput = input; }}
                                    autoFocus
                                    placeholder={this.translate(
                                        'forms.editThought.labels.messageReply'
                                    )}
                                    value={inputs.message}
                                    onSubmitEditing={this.onSubmitReply}
                                    onChangeText={(text) =>
                                        this.onInputChange('message', text)
                                    }
                                    minHeight={40}
                                    numberOfLines={1}
                                    maxLength={255}
                                    themeForms={this.themeForms}
                                    style={[this.themeForms.styles.textInputRound, this.themeThought.styles.sendBtnInput]}
                                />
                                <Button
                                    icon={<TherrIcon name="send" size={26} style={this.themeThought.styles.sendBtnIcon} />}
                                    buttonStyle={this.themeThought.styles.sendBtn}
                                    containerStyle={[this.themeThought.styles.sendBtnContainer]}
                                    onPress={this.onSubmitReply}
                                    disabled={isSubmitting}
                                />
                            </View>
                            {
                                replies?.map((reply) => (
                                    <ThoughtDisplay
                                        translate={this.translate}
                                        date={formatDate(reply.createdAt)}
                                        toggleThoughtOptions={() => this.toggleThoughtOptions(reply)}
                                        hashtags={this.hashtags}
                                        isDarkMode={true}
                                        isExpanded={false}
                                        inspectThought={() => null}
                                        key={reply.id}
                                        thought={reply}
                                        goToViewUser={this.goToViewUser}
                                        updateThoughtReaction={(thoughtId, data) => this.onUpdateThoughtReaction(thoughtId, data)}
                                        // TODO: User Username from response
                                        user={user}
                                        contentUserDetails={{
                                            userName: this.getReplyUserName(reply),
                                            media: this.getReplyUserMedia(reply),
                                        }}
                                        theme={this.theme}
                                        themeForms={this.themeForms}
                                        themeViewContent={this.themeThought}
                                    />
                                ))
                            }
                        </View>
                        {/* {
                            previewLinkId
                            && <View style={[userContentStyles.preview, previewStyleState]}>
                                <YoutubePlayer
                                    height={260}
                                    play={false}
                                    videoId={previewLinkId}
                                    onFullScreenChange={this.handlePreviewFullScreen}
                                />
                            </View>
                        } */}
                    </KeyboardAwareScrollView>
                    {
                        <View style={[this.themeAccentLayout.styles.footer, this.themeThought.styles.footer]}>
                            <Button
                                containerStyle={this.themeAccentForms.styles.backButtonContainer}
                                buttonStyle={this.themeAccentForms.styles.backButton}
                                onPress={() => this.goBack()}
                                icon={
                                    <TherrIcon
                                        name="go-back"
                                        size={25}
                                        color={'black'}
                                    />
                                }
                                type="clear"
                            />
                            {
                                isMyContent &&
                                <>
                                    {
                                        !isVerifyingDelete &&
                                            <Button
                                                buttonStyle={this.themeAccentForms.styles.submitDeleteButton}
                                                disabledStyle={this.themeAccentForms.styles.submitButtonDisabled}
                                                disabledTitleStyle={this.themeAccentForms.styles.submitDisabledButtonTitle}
                                                titleStyle={this.themeAccentForms.styles.submitButtonTitle}
                                                containerStyle={this.themeAccentForms.styles.submitButtonContainer}
                                                title={this.translate(
                                                    'forms.editThought.buttons.delete'
                                                )}
                                                icon={
                                                    <FontAwesome5Icon
                                                        name="trash-alt"
                                                        size={25}
                                                        color={'black'}
                                                        style={this.themeAccentForms.styles.submitButtonIcon}
                                                    />
                                                }
                                                onPress={this.onDelete}
                                                raised={true}
                                            />
                                    }
                                    {
                                        isVerifyingDelete &&
                                        <View style={this.themeAccentForms.styles.submitConfirmContainer}>
                                            <Button
                                                buttonStyle={this.themeAccentForms.styles.submitCancelButton}
                                                disabledStyle={this.themeAccentForms.styles.submitButtonDisabled}
                                                disabledTitleStyle={this.themeAccentForms.styles.submitDisabledButtonTitle}
                                                titleStyle={this.themeAccentForms.styles.submitButtonTitle}
                                                containerStyle={this.themeAccentForms.styles.submitCancelButtonContainer}
                                                title={this.translate(
                                                    'forms.editThought.buttons.cancel'
                                                )}
                                                onPress={this.onDeleteCancel}
                                                disabled={isDeleting}
                                                raised={true}
                                            />
                                            <Button
                                                buttonStyle={this.themeAccentForms.styles.submitConfirmButton}
                                                disabledStyle={this.themeAccentForms.styles.submitButtonDisabled}
                                                disabledTitleStyle={this.themeAccentForms.styles.submitDisabledButtonTitle}
                                                titleStyle={this.themeAccentForms.styles.submitButtonTitleLight}
                                                containerStyle={this.themeAccentForms.styles.submitButtonContainer}
                                                title={this.translate(
                                                    'forms.editThought.buttons.confirm'
                                                )}
                                                onPress={this.onDeleteConfirm}
                                                disabled={isDeleting}
                                                raised={true}
                                            />
                                        </View>
                                    }
                                </>
                            }
                        </View>
                    }
                </SafeAreaView>
                <ThoughtOptionsModal
                    isVisible={areThoughtOptionsVisible}
                    onRequestClose={() => this.toggleThoughtOptions(selectedThought)}
                    translate={this.translate}
                    onSelect={this.onThoughtOptionSelect}
                    themeButtons={this.themeButtons}
                    themeReactionsModal={this.themeReactionsModal}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ViewThought);
