import React from 'react';
import {
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
import { ContentActions, MapActions } from 'therr-react/redux/actions';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import YoutubePlayer from 'react-native-youtube-iframe';
// import Alert from '../components/Alert';
import translator from '../services/translator';
import styles from '../styles';
// import * as therrTheme from '../styles/themes';
import formStyles, { beemoEditForm as beemoFormStyles } from '../styles/forms';
import beemoLayoutStyles from '../styles/layouts/beemo';
import userContentStyles from '../styles/user-content';
import { viewing as viewSpaceStyles } from '../styles/user-content/moments';
import { youtubeLinkRegex } from '../constants';
import AreaDisplay from '../components/UserContent/AreaDisplay';
import formatDate from '../utilities/formatDate';
import BaseStatusBar from '../components/BaseStatusBar';
import { isMyArea as checkIsMySpace } from '../utilities/content';
import AreaOptionsModal, { ISelectionType } from '../components/Modals/AreaOptionsModal';
import { getReactionUpdateArgs } from '../utilities/reactions';
// import * as therrTheme from '../styles/themes';
// import formStyles, { settingsForm as settingsFormStyles } from '../styles/forms';
// import BeemoInput from '../components/Input/Beemo';

interface ISpaceDetails {
    userDetails?: any;
}

interface IViewSpaceDispatchProps {
    getSpaceDetails: Function;
    deleteSpace: Function;
    createOrUpdateSpaceReaction: Function;
}

interface IStoreProps extends IViewSpaceDispatchProps {
    content: IContentState;
    user: IUserState;
}

// Regular component props
export interface IViewSpaceProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IViewSpaceState {
    areAreaOptionsVisible: boolean;
    errorMsg: string;
    successMsg: string;
    isDeleting: boolean;
    isVerifyingDelete: boolean;
    previewLinkId?: string;
    previewStyleState: any;
    selectedSpace: any;
}

const mapStateToProps = (state) => ({
    content: state.content,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getSpaceDetails: MapActions.getSpaceDetails,
    deleteSpace: MapActions.deleteSpace,
    createOrUpdateSpaceReaction: ContentActions.createOrUpdateSpaceReaction,
}, dispatch);

export class ViewSpace extends React.Component<IViewSpaceProps, IViewSpaceState> {
    private date;
    private notificationMsg;
    private hashtags;
    private scrollViewRef;
    private translate: Function;
    private unsubscribeNavListener;

    constructor(props) {
        super(props);

        const { route } = props;
        const { space } = route.params;

        const youtubeMatches = (space.message || '').match(youtubeLinkRegex);

        this.state = {
            areAreaOptionsVisible: false,
            errorMsg: '',
            successMsg: '',
            isDeleting: false,
            isVerifyingDelete: false,
            previewStyleState: {},
            previewLinkId: youtubeMatches && youtubeMatches[1],
            selectedSpace: {},
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);

        this.notificationMsg = (space.notificationMsg || '').replace(/\r?\n+|\r+/gm, ' ');
        this.hashtags = space.hashTags ? space.hashTags.split(',') : [];

        this.date = formatDate(space.updatedAt);

        // changeNavigationBarColor(therrTheme.colors.beemo1, false, true);
    }

    componentDidMount() {
        const { content, getSpaceDetails, navigation, route, user } = this.props;
        const { isMyArea, space } = route.params;

        const spaceUserName = isMyArea ? user.details.userName : space.fromUserName;
        const mediaId = (space.media && space.media[0]?.id) || (space.mediaIds?.length && space.mediaIds?.split(',')[0]);
        const spaceMedia = content?.media[mediaId];

        // Move space details out of route params and into redux
        getSpaceDetails(space.id, {
            withMedia: !spaceMedia,
            withUser: !spaceUserName,
        });

        navigation.setOptions({
            title: this.notificationMsg,
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
                buttonStyle={formStyles.buttonPill}
                containerStyle={formStyles.buttonPillContainer}
                titleStyle={formStyles.buttonPillTitle}
                title={`#${tag}`}
            />
        );
    };

    handlePreviewFullScreen = (isFullScreen) => {
        const previewStyleState = isFullScreen ? {
            top: 0,
            left: 0,
            padding: 0,
            margin: 0,
            position: 'absolute',
            zIndex: 20,
        } : {};
        this.setState({
            previewStyleState,
        });
    }

    onDelete = () => {
        this.setState({
            isVerifyingDelete: true,
        });
    }

    onDeleteCancel = () => {
        this.setState({
            isVerifyingDelete: false,
        });
    }

    onDeleteConfirm = () => {
        const { deleteSpace, navigation, route, user } = this.props;
        const { space } = route.params;

        this.setState({
            isDeleting: true,
        });
        if (checkIsMySpace(space, user)) {
            deleteSpace({ ids: [space.id] })
                .then(() => {
                    navigation.navigate('Map');
                })
                .catch((err) => {
                    console.log('Error deleting space', err);
                    this.setState({
                        isDeleting: true,
                        isVerifyingDelete: false,
                    });
                });
        }
    }

    onSpaceOptionSelect = (type: ISelectionType) => {
        const { selectedSpace } = this.state;
        const { createOrUpdateSpaceReaction } = this.props;
        const requestArgs: any = getReactionUpdateArgs(type);

        createOrUpdateSpaceReaction(selectedSpace.id, requestArgs).finally(() => {
            this.toggleAreaOptions(selectedSpace);
        });
    }

    goBack = () => {
        const { navigation, route } = this.props;
        const { previousView } = route.params;
        if (previousView && previousView === 'Spaces') {
            navigation.goBack();
        } else {
            navigation.navigate('Map');
        }
    }

    goToViewUser = (userId) => {
        const { navigation } = this.props;

        navigation.navigate('ViewUser', {
            userInView: {
                id: userId,
            },
        });
    }

    onUpdateSpaceReaction = (spaceId, data) => {
        const { createOrUpdateSpaceReaction, navigation, route } = this.props;
        const { space } = route.params;
        navigation.setParams({
            space: {
                ...space,
                reaction: {
                    ...space.reaction,
                    userBookmarkCategory: !!space.reaction?.userBookmarkCategory ? null : 'Uncategorized',
                },
            },
        });
        return createOrUpdateSpaceReaction(spaceId, data);
    }

    toggleAreaOptions = (area) => {
        const { areAreaOptionsVisible } = this.state;

        this.setState({
            areAreaOptionsVisible: !areAreaOptionsVisible,
            selectedSpace: areAreaOptionsVisible ? {} : area,
        });
    }

    render() {
        const { areAreaOptionsVisible, isDeleting, isVerifyingDelete, previewLinkId, previewStyleState, selectedSpace } = this.state;
        const { content, route, user } = this.props;
        const { space, isMyArea } = route.params;
        // TODO: Fetch space media
        const mediaId = (space.media && space.media[0]?.id) || (space.mediaIds?.length && space.mediaIds?.split(',')[0]);
        const spaceMedia = content?.media[mediaId];
        const spaceUserName = isMyArea ? user.details.userName : space.fromUserName;

        return (
            <>
                <BaseStatusBar />
                <SafeAreaView  style={styles.safeAreaView}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        ref={(component) => (this.scrollViewRef = component)}
                        style={[styles.bodyFlex, beemoLayoutStyles.bodyView]}
                        contentContainerStyle={[styles.bodyScroll, beemoLayoutStyles.bodyViewScroll]}
                    >
                        <View style={[beemoLayoutStyles.container, viewSpaceStyles.areaContainer]}>
                            <AreaDisplay
                                translate={this.translate}
                                date={this.date}
                                toggleAreaOptions={() => this.toggleAreaOptions(space)}
                                hashtags={this.hashtags}
                                isDarkMode={true}
                                isExpanded={true}
                                area={space}
                                goToViewUser={this.goToViewUser}
                                updateAreaReaction={(spaceId, data) => this.onUpdateSpaceReaction(spaceId, data)}
                                // TODO: User Username from response
                                userDetails={{
                                    userName: spaceUserName || space.fromUserId,
                                }}
                                areaMedia={spaceMedia}
                            />
                        </View>
                        {
                            previewLinkId
                            && <View style={[userContentStyles.preview, previewStyleState]}>
                                <YoutubePlayer
                                    height={260}
                                    play={false}
                                    videoId={previewLinkId}
                                    onFullScreenChange={this.handlePreviewFullScreen}
                                />
                            </View>
                        }
                    </KeyboardAwareScrollView>
                    {
                        <View style={[beemoLayoutStyles.footer, viewSpaceStyles.footer]}>
                            <Button
                                containerStyle={beemoFormStyles.backButtonContainer}
                                buttonStyle={beemoFormStyles.backButton}
                                onPress={() => this.goBack()}
                                icon={
                                    <FontAwesome5Icon
                                        name="arrow-left"
                                        size={25}
                                        color={'black'}
                                    />
                                }
                                type="clear"
                            />
                            {
                                isMyArea &&
                                <>
                                    {
                                        !isVerifyingDelete &&
                                            <Button
                                                buttonStyle={beemoFormStyles.submitDeleteButton}
                                                disabledStyle={beemoFormStyles.submitButtonDisabled}
                                                disabledTitleStyle={beemoFormStyles.submitDisabledButtonTitle}
                                                titleStyle={beemoFormStyles.submitButtonTitle}
                                                containerStyle={beemoFormStyles.submitButtonContainer}
                                                title={this.translate(
                                                    'forms.editSpace.buttons.delete'
                                                )}
                                                icon={
                                                    <FontAwesome5Icon
                                                        name="trash-alt"
                                                        size={25}
                                                        color={'black'}
                                                        style={beemoFormStyles.submitButtonIcon}
                                                    />
                                                }
                                                onPress={this.onDelete}
                                                raised={true}
                                            />
                                    }
                                    {
                                        isVerifyingDelete &&
                                        <View style={beemoFormStyles.submitConfirmContainer}>
                                            <Button
                                                buttonStyle={beemoFormStyles.submitCancelButton}
                                                disabledStyle={beemoFormStyles.submitButtonDisabled}
                                                disabledTitleStyle={beemoFormStyles.submitDisabledButtonTitle}
                                                titleStyle={beemoFormStyles.submitButtonTitle}
                                                containerStyle={beemoFormStyles.submitCancelButtonContainer}
                                                title={this.translate(
                                                    'forms.editSpace.buttons.cancel'
                                                )}
                                                onPress={this.onDeleteCancel}
                                                disabled={isDeleting}
                                                raised={true}
                                            />
                                            <Button
                                                buttonStyle={beemoFormStyles.submitConfirmButton}
                                                disabledStyle={beemoFormStyles.submitButtonDisabled}
                                                disabledTitleStyle={beemoFormStyles.submitDisabledButtonTitle}
                                                titleStyle={beemoFormStyles.submitButtonTitleLight}
                                                containerStyle={beemoFormStyles.submitButtonContainer}
                                                title={this.translate(
                                                    'forms.editSpace.buttons.confirm'
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
                <AreaOptionsModal
                    isVisible={areAreaOptionsVisible}
                    onRequestClose={() => this.toggleAreaOptions(selectedSpace)}
                    translate={this.translate}
                    onSelect={this.onSpaceOptionSelect}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ViewSpace);
