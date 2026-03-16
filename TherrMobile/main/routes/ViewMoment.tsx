import React from 'react';
import {
    Dimensions,
    SafeAreaView,
    Share,
    StyleSheet,
    View,
} from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Button as PaperButton } from 'react-native-paper';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { IContentState, IUserState } from 'therr-react/types';
import { ContentActions, MapActions } from 'therr-react/redux/actions';
import { Content } from 'therr-js-utilities/constants';
import YoutubePlayer from 'react-native-youtube-iframe';
import translator from '../services/translator';
import { buildMomentUrl } from '../utilities/shareUrls';
import { isDarkTheme } from '../styles/themes';
import { buildStyles } from '../styles';
import { buildStyles as buildFormStyles } from '../styles/forms';
import { buildStyles as buildAccentStyles } from '../styles/layouts/accent';
import { buildStyles as buildMomentStyles } from '../styles/user-content/areas/viewing';
import { buildStyles as buildConfirmModalStyles } from '../styles/modal/confirmModal';
import { buildStyles as buildButtonsStyles } from '../styles/buttons';
import userContentStyles from '../styles/user-content';
import { youtubeLinkRegex } from '../constants';
import AreaDisplay from '../components/UserContent/AreaDisplay';
import formatDate from '../utilities/formatDate';
import BaseStatusBar from '../components/BaseStatusBar';
import ConfirmModal from '../components/Modals/ConfirmModal';
import { isMyContent as checkIsMyMoment, getUserContentUri } from '../utilities/content';
import { SheetManager } from 'react-native-actions-sheet';
import { IContentSelectionType } from '../components/ActionSheet/ContentOptionsSheet';
import { getReactionUpdateArgs } from '../utilities/reactions';
import getDirections from '../utilities/getDirections';
const { width: screenWidth } = Dimensions.get('window');

interface IViewMomentDispatchProps {
    getMomentDetails: Function;
    deleteMoment: Function;
    createOrUpdateMomentReaction: Function;
}

interface IStoreProps extends IViewMomentDispatchProps {
    content: IContentState;
    user: IUserState;
}

// Regular component props
export interface IViewMomentProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IViewMomentState {
    isDeleting: boolean;
    isDeleteDialogVisible: boolean;
    fetchedMoment: any;
    previewLinkId?: string;
    previewStyleState: any;
}

const mapStateToProps = (state) => ({
    content: state.content,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getMomentDetails: MapActions.getMomentDetails,
    deleteMoment: MapActions.deleteMoment,
    createOrUpdateMomentReaction: ContentActions.createOrUpdateMomentReaction,
}, dispatch);

export class ViewMoment extends React.Component<IViewMomentProps, IViewMomentState> {
    private date;
    private notificationMsg;
    private hashtags;
    private scrollViewRef;
    private translate: Function;
    private unsubscribeNavListener;
    private theme = buildStyles();
    private themeAccentLayout = buildAccentStyles();
    private themeArea = buildMomentStyles();
    private themeForms = buildFormStyles();
    private themeConfirmModal = buildConfirmModalStyles();
    private themeButtons = buildButtonsStyles();

    constructor(props) {
        super(props);

        const { route } = props;
        const { moment } = route.params;

        const youtubeMatches = (moment.message || '').match(youtubeLinkRegex);

        this.state = {
            isDeleting: false,
            isDeleteDialogVisible: false,
            fetchedMoment: {},
            previewStyleState: {},
            previewLinkId: youtubeMatches && youtubeMatches[1],
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeAccentLayout = buildAccentStyles(props.user.settings?.mobileThemeName);
        this.themeArea = buildMomentStyles(props.user.settings?.mobileThemeName, true);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeConfirmModal = buildConfirmModalStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) => translator(props.user.settings?.locale || 'en-us', key, params);

        this.notificationMsg = (moment.notificationMsg || '').replace(/\r?\n+|\r+/gm, ' ');
        this.hashtags = moment.hashTags ? moment.hashTags.split(',') : [];

        const dateTime = formatDate(moment.updatedAt);
        this.date = !dateTime.date ? '' : `${dateTime.date} | ${dateTime.time}`;

        // changeNavigationBarColor(therrTheme.colors.accent1, false, true);
    }

    componentDidMount() {
        const { content, getMomentDetails, navigation, route } = this.props;
        const { moment } = route.params;

        const shouldFetchUser = !moment?.fromUserMedia || !moment.fromUserName;
        const mediaPath = moment.medias?.[0]?.path;
        const momentMedia = content?.media[mediaPath];

        // Move moment details out of route params and into redux
        getMomentDetails(moment.id, {
            withMedia: !momentMedia,
            withUser: shouldFetchUser,
        }).then((data) => {
            if (data?.moment?.notificationMsg) {
                this.notificationMsg = (data?.moment?.notificationMsg || '').replace(/\r?\n+|\r+/gm, ' ');
                navigation.setOptions({
                    title: this.notificationMsg,
                });
            }
            this.setState({
                fetchedMoment: data?.moment,
            });
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
    };

    onDeleteConfirm = () => {
        const { deleteMoment, navigation, route, user } = this.props;
        const { moment } = route.params;

        this.setState({
            isDeleting: true,
        });
        if (checkIsMyMoment(moment, user)) {
            deleteMoment({ ids: [moment.id] })
                .then(() => {
                    navigation.navigate('Map', {
                        shouldShowPreview: false,
                    });
                })
                .catch((err) => {
                    console.log('Error deleting moment', err);
                    this.setState({
                        isDeleting: false,
                        isDeleteDialogVisible: false,
                    });
                });
        } else {
            this.setState({
                isDeleting: false,
                isDeleteDialogVisible: false,
            });
        }
    };

    onMomentOptionSelect = (type: IContentSelectionType, moment: any) => {
        if (type === 'getDirections') {
            getDirections({
                latitude: moment.latitude,
                longitude: moment.longitude,
                title: moment.notificationMsg,
            });
        } else if (type === 'shareALink') {
            const locale = this.props.user?.settings?.locale || 'en-us';
            const shareUrl = buildMomentUrl(locale, moment.id);
            Share.share({
                message: this.translate('modals.contentOptions.shareLink.messageMoment', {
                    momentId: moment.id,
                    shareUrl,
                }),
                url: shareUrl,
                title: this.translate('modals.contentOptions.shareLink.titleMoment', {
                    momentTitle: moment.notificationMsg,
                }),
            }).then((response) => {
                if (response.action === Share.sharedAction) {
                    if (response.activityType) {
                        // shared with activity type of response.activityType
                    } else {
                        // shared
                    }
                } else if (response.action === Share.dismissedAction) {
                    // dismissed
                }
            }).catch((err) => {
                console.error(err);
            });
        } else {
            const requestArgs: any = getReactionUpdateArgs(type);

            this.onUpdateMomentReaction(moment.id, requestArgs);
        }
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

    goToViewMap = (lat, long) => {
        const { navigation } = this.props;

        navigation.replace('Map', {
            latitude: lat,
            longitude: long,
        });
    };

    goToViewSpace = (moment) => {
        const { navigation, user } = this.props;

        if (moment.spaceId) {
            navigation.navigate('ViewSpace', {
                isMyContent: moment.space?.fromUserId === user.details.id,
                previousView: 'Areas',
                space: {
                    id: moment.spaceId,
                },
                spaceDetails: {},
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

    onUpdateMomentReaction = (momentId, data) => {
        const { createOrUpdateMomentReaction, navigation, route, user } = this.props;
        const { moment } = route.params;
        navigation.setParams({
            moment: {
                ...moment,
                reaction: {
                    ...moment.reaction,
                    ...data,
                },
            },
        });
        return createOrUpdateMomentReaction(momentId, data, moment.fromUserId, user.details.userName);
    };

    toggleAreaOptions = (displayArea?: any) => {
        const { fetchedMoment } = this.state;
        const { moment } = this.props.route.params;
        const area = displayArea || {
            ...moment,
            ...fetchedMoment,
        };

        SheetManager.show('content-options-sheet', {
            payload: {
                contentType: 'area',
                shouldIncludeShareButton: true,
                translate: this.translate,
                themeForms: this.themeForms,
                onSelect: (type: IContentSelectionType) => this.onMomentOptionSelect(type, area),
            },
        });
    };

    render() {
        const {
            fetchedMoment,
            isDeleting,
            isDeleteDialogVisible,
            previewLinkId,
            previewStyleState,
        } = this.state;
        const { content, route, user } = this.props;
        const { moment, isMyContent } = route.params;
        const momentInView = {
            ...moment,
            ...fetchedMoment,
        };
        const momentUserName = isMyContent ? user.details.userName : momentInView.fromUserName;
        const momentUserMedia = isMyContent ? user.details.media : (momentInView.fromUserMedia || {});
        const momentUserIsSuperUser = isMyContent ? user.details.isSuperUser : (momentInView.fromUserIsSuperUser || {});

        // TODO: Everything should use post.medias after migrations
        // Use the cacheable api-gateway media endpoint when image is public otherwise fallback to signed url
        const mediaPath = (momentInView.medias?.[0]?.path);
        const mediaType = (momentInView.medias?.[0]?.type);
        const momentMedia = mediaPath && mediaType === Content.mediaTypes.USER_IMAGE_PUBLIC
            ? getUserContentUri(momentInView.medias?.[0], screenWidth, screenWidth)
            : content?.media[mediaPath];

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
                        <View style={[this.themeAccentLayout.styles.container, this.themeArea.styles.areaContainer]}>
                            <AreaDisplay
                                translate={this.translate}
                                toggleAreaOptions={this.toggleAreaOptions}
                                hashtags={this.hashtags}
                                isDarkMode={isDarkTheme(user.settings?.mobileThemeName)}
                                isExpanded={true}
                                inspectContent={() => null}
                                area={momentInView}
                                goToViewMap={this.goToViewMap}
                                goToViewSpace={this.goToViewSpace}
                                goToViewUser={this.goToViewUser}
                                updateAreaReaction={this.onUpdateMomentReaction}
                                // TODO: User Username from response
                                user={user}
                                areaUserDetails={{
                                    media: momentUserMedia,
                                    userName: momentUserName || this.translate('alertTitles.nameUnknown') || '',
                                    isSuperUser: momentUserIsSuperUser,
                                }}
                                areaMedia={momentMedia}
                                theme={this.theme}
                                themeForms={this.themeForms}
                                themeViewArea={this.themeArea}
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
                    {/* Footer */}
                    <View style={[this.themeAccentLayout.styles.footer, localStyles.footer]}>
                        <PaperButton
                            mode="outlined"
                            onPress={() => this.goBack()}
                            icon="arrow-left"
                            textColor={this.theme.colors.brandingBlueGreen}
                            style={localStyles.footerButton}
                        >
                            {this.translate('forms.editMoment.buttons.back')}
                        </PaperButton>
                        {isMyContent && (
                            <PaperButton
                                mode="contained"
                                onPress={() => this.setState({ isDeleteDialogVisible: true })}
                                icon="trash-can-outline"
                                buttonColor={this.theme.colors.accentRed}
                                textColor={this.theme.colors.brandingWhite}
                                style={localStyles.footerButton}
                                disabled={isDeleting}
                                loading={isDeleting}
                            >
                                {this.translate('forms.editMoment.buttons.delete')}
                            </PaperButton>
                        )}
                    </View>
                </SafeAreaView>

                {/* Delete confirmation modal */}
                <ConfirmModal
                    isConfirming={isDeleting}
                    isVisible={isDeleteDialogVisible}
                    onCancel={() => this.setState({ isDeleteDialogVisible: false })}
                    onConfirm={this.onDeleteConfirm}
                    text={this.translate('forms.editMoment.deleteConfirmation')}
                    textConfirm={this.translate('forms.editMoment.buttons.confirm')}
                    textCancel={this.translate('forms.editMoment.buttons.cancel')}
                    translate={this.translate}
                    theme={this.theme}
                    themeModal={this.themeConfirmModal}
                    themeButtons={this.themeButtons}
                />
            </>
        );
    }
}

const localStyles = StyleSheet.create({
    footer: {
        justifyContent: 'space-between',
        paddingHorizontal: 10,
    },
    footerButton: {
        flex: 1,
        marginHorizontal: 4,
    },
});

export default connect(mapStateToProps, mapDispatchToProps)(ViewMoment);
