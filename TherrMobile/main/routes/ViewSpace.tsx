import React from 'react';
import {
    Dimensions,
    Platform,
    SafeAreaView,
    Share,
    Text,
    View,
} from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Button } from 'react-native-elements';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Toast from 'react-native-toast-message';
// import { Button }  from 'react-native-elements';
// import changeNavigationBarColor from 'react-native-navigation-bar-color';
import { IContentState, IMapState as IMapReduxState, IReactionsState, IUserState } from 'therr-react/types';
import { ContentActions, MapActions } from 'therr-react/redux/actions';
// import { MapsService } from 'therr-react/services';
import { Content, IncentiveRequirementKeys } from 'therr-js-utilities/constants';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import YoutubePlayer from 'react-native-youtube-iframe';
import TherrIcon from '../components/TherrIcon';
import { ILocationState } from '../types/redux/location';
import LocationActions from '../redux/actions/LocationActions';
// import Alert from '../components/Alert';
import translator from '../services/translator';
import { buildStyles } from '../styles';
import { buildStyles as buildFormStyles } from '../styles/forms';
import { buildStyles as buildAccentFormStyles } from '../styles/forms/accentEditForm';
import { buildStyles as buildAccentStyles } from '../styles/layouts/accent';
import { buildStyles as buildButtonsStyles } from '../styles/buttons';
import { buildStyles as buildMomentStyles } from '../styles/user-content/areas/viewing';
import { buildStyles as buildReactionsModalStyles } from '../styles/modal/areaReactionsModal';
import userContentStyles from '../styles/user-content';
import spacingStyles from '../styles/layouts/spacing';
import { youtubeLinkRegex } from '../constants';
import AreaDisplay from '../components/UserContent/AreaDisplay';
import formatDate from '../utilities/formatDate';
import BaseStatusBar from '../components/BaseStatusBar';
import { isMyContent as checkIsMySpace, getUserContentUri } from '../utilities/content';
import AreaOptionsModal, { ISelectionType } from '../components/Modals/AreaOptionsModal';
import { getReactionUpdateArgs } from '../utilities/reactions';
import getDirections from '../utilities/getDirections';
import { MAX_DISTANCE_TO_NEARBY_SPACE } from '../constants';
import requestLocationServiceActivation from '../utilities/requestLocationServiceActivation';
import { isLocationPermissionGranted } from '../utilities/requestOSPermissions';
import getNearbySpaces from '../utilities/getNearbySpaces';
// import AccentInput from '../components/Input/Accent';

const { width: screenWidth } = Dimensions.get('window');

interface IViewSpaceDispatchProps {
    getSpaceDetails: Function;
    deleteSpace: Function;
    createOrUpdateSpaceReaction: Function;
    updateGpsStatus: Function;
    updateLocationDisclosure: Function;
    updateLocationPermissions: Function;
}

interface IStoreProps extends IViewSpaceDispatchProps {
    content: IContentState;
    location: ILocationState;
    map: IMapReduxState;
    reactions: IReactionsState;
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
    isUserInSpace: boolean;
    isVerifyingDelete: boolean;
    isViewingIncentives: boolean;
    fetchedSpace: any;
    previewLinkId?: string;
    previewStyleState: any;
    selectedSpace: any;
}

const mapStateToProps = (state) => ({
    content: state.content,
    location: state.location,
    map: state.map,
    reactions: state.reactions,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getSpaceDetails: MapActions.getSpaceDetails,
    deleteSpace: MapActions.deleteSpace,
    createOrUpdateSpaceReaction: ContentActions.createOrUpdateSpaceReaction,
    updateGpsStatus: LocationActions.updateGpsStatus,
    updateLocationDisclosure: LocationActions.updateLocationDisclosure,
    updateLocationPermissions: LocationActions.updateLocationPermissions,
}, dispatch);

export class ViewSpace extends React.Component<IViewSpaceProps, IViewSpaceState> {
    private date;
    private notificationMsg;
    private hashtags;
    private scrollViewRef;
    private translate: Function;
    private unsubscribeNavListener;
    private theme = buildStyles();
    private themeAccentLayout = buildAccentStyles();
    private themeButtons = buildButtonsStyles();
    private themeArea = buildMomentStyles();
    private themeReactionsModal = buildReactionsModalStyles();
    private themeForms = buildFormStyles();
    private themeAccentForms = buildAccentFormStyles();

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
            isUserInSpace: true,
            isVerifyingDelete: false,
            isViewingIncentives: false,
            fetchedSpace: {},
            previewStyleState: {},
            previewLinkId: youtubeMatches && youtubeMatches[1],
            selectedSpace: {},
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeAccentLayout = buildAccentStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
        this.themeArea = buildMomentStyles(props.user.settings?.mobileThemeName, true);
        this.themeReactionsModal = buildReactionsModalStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeAccentForms = buildAccentFormStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) => translator('en-us', key, params);

        this.notificationMsg = (space.notificationMsg || '').replace(/\r?\n+|\r+/gm, ' ');
        this.hashtags = space.hashTags ? space.hashTags.split(',') : [];

        const dateTime = formatDate(space.updatedAt);
        this.date = !dateTime.date ? '' : `${dateTime.date} | ${dateTime.time}`;

        // changeNavigationBarColor(therrTheme.colors.accent1, false, true);
    }

    componentDidMount() {
        const { content, getSpaceDetails, navigation, route } = this.props;
        const { space } = route.params;

        const shouldFetchUser = !space?.fromUserMedia || !space.fromUserName;
        const mediaId = (space.media && space.media[0]?.id) || (space.mediaIds?.length && space.mediaIds?.split(',')[0]);
        const spaceMedia = content?.media[mediaId];

        // Move space details out of route params and into redux
        getSpaceDetails(space.id, {
            withMedia: !spaceMedia,
            withUser: shouldFetchUser,
        }).then((data) => {
            if (data?.space?.notificationMsg) {
                this.notificationMsg = (data?.space?.notificationMsg || '').replace(/\r?\n+|\r+/gm, ' ');
                navigation.setOptions({
                    title: this.notificationMsg,
                });
            }
            this.setState({
                fetchedSpace: data?.space,
            });
        }).catch(() => {
            // Happens when space is not yet activated, but that is OK
        });

        navigation.setOptions({
            title: this.notificationMsg,
        });

        this.unsubscribeNavListener = navigation.addListener('beforeRemove', (e) => {
            const { isViewingIncentives } = this.state;
            // changeNavigationBarColor(therrTheme.colors.primary, false, true);
            if (isViewingIncentives && (e.data.action.type === 'GO_BACK' || e.data.action.type === 'POP')) {
                e.preventDefault();
                this.setState({
                    isViewingIncentives: false,
                });
            }
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
        const { deleteSpace, navigation, route, user } = this.props;
        const { space } = route.params;

        this.setState({
            isDeleting: true,
        });
        if (checkIsMySpace(space, user)) {
            deleteSpace({ ids: [space.id] })
                .then(() => {
                    navigation.navigate('Map', {
                        shouldShowPreview: false,
                    });
                })
                .catch((err) => {
                    console.log('Error deleting space', err);
                    this.setState({
                        isDeleting: true,
                        isVerifyingDelete: false,
                    });
                });
        }
    };

    onSpaceOptionSelect = (type: ISelectionType) => {
        const { selectedSpace } = this.state;

        if (type === 'getDirections') {
            getDirections({
                latitude: selectedSpace.latitude,
                longitude: selectedSpace.longitude,
                title: selectedSpace.notificationMsg,
            });
        } else if (type === 'shareALink') {
            Share.share({
                message: this.translate('modals.contentOptions.shareLink.message', {
                    spaceId: selectedSpace.id,
                }),
                url: `https://www.therr.com/spaces/${selectedSpace.id}`,
                title: this.translate('modals.contentOptions.shareLink.title', {
                    spaceTitle: selectedSpace.notificationMsg,
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

            this.onUpdateSpaceReaction(selectedSpace.id, requestArgs).finally(() => {
                this.toggleAreaOptions();
            });
        }
    };

    goBack = () => {
        if (this.state.isViewingIncentives) {
            this.setState({
                isViewingIncentives: false,
            });
            return;
        }
        const { navigation, route } = this.props;
        const { previousView } = route.params;
        if (previousView === 'Areas') {
            navigation.goBack();
        } else if (previousView === 'Notifications') {
            navigation.navigate('Notifications');
        } else {
            navigation.navigate('Map', {
                shouldShowPreview: true,
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

    goToViewUser = (userId) => {
        const { navigation } = this.props;

        navigation.navigate('ViewUser', {
            userInView: {
                id: userId,
            },
        });
    };

    goToViewIncentives = () => {
        const { navigation } = this.props;

        this.setState({
            isViewingIncentives: true,
        });

        // This is necessary to allow intercepting the back swipe gesture and prevent it from animating
        // before preventDefault is called in the beforeRemove listener
        navigation.setOptions({
            // animation: 'none', // navigation v6
            animationEnabled: false,
            gestureEnabled: true, // must be set to true or it gets animationEnabled with animationEnabled=false
        });
    };

    onUpdateSpaceReaction = (spaceId, data) => {
        const { createOrUpdateSpaceReaction, navigation, route, user } = this.props;
        const { space } = route.params;
        navigation.setParams({
            space: {
                ...space,
                reaction: {
                    ...space.reaction,
                    ...data,
                },
            },
        });
        return createOrUpdateSpaceReaction(spaceId, data, space.fromUserId, user.details.userName);
    };

    toggleAreaOptions = (displayArea?: any) => {
        const { areAreaOptionsVisible, fetchedSpace } = this.state;
        const { space } = this.props.route.params;
        const area = {
            ...space,
            ...fetchedSpace,
        };

        this.setState({
            areAreaOptionsVisible: !areAreaOptionsVisible,
            selectedSpace: areAreaOptionsVisible ? {} : (area || displayArea),
        });
    };

    handleCreateMoment = () => {
        const {
            location,
            map,
            navigation,
            reactions,
            updateGpsStatus,
            updateLocationDisclosure,
            user,
        } = this.props;

        return requestLocationServiceActivation({
            isGpsEnabled: location?.settings?.isGpsEnabled,
            translate: this.translate,
            shouldIgnoreRequirement: false,
        }).then((response: any) => {
            if (response?.status || Platform.OS === 'ios') {
                if (response?.alreadyEnabled && isLocationPermissionGranted(location.permissions)) {
                    // Ensure that the user sees location disclosure even if gps is already enabled (otherwise requestOSMapPermissions will handle it)
                    if (!location?.settings?.isLocationDislosureComplete) {
                        // TODO: Show location disclosure modal
                        return true;
                    } else {
                        return false;
                    }
                }

                updateLocationDisclosure(true);
                updateGpsStatus(response?.status || 'enabled');

                return false;
            }

            return Promise.resolve(false);
        }).then((shouldAbort) => {
            // TODO: Consider also calling requestOSMapPermissions here
            if (!shouldAbort && location.user?.latitude && location.user?.longitude) {
                const userCenter = {
                    latitude: location.user.latitude,
                    longitude: location.user.longitude,
                };
                const nearbySpaces = getNearbySpaces(userCenter, user, reactions, map?.spaces);
                if (nearbySpaces.length > 0) {
                    // CAUTION: Do not use navigation.reset. It seems to cause the app to crash on Android when
                    // setting the 1st route to Map and 2nd round to EditMoment
                    navigation.navigate({
                        name: 'EditMoment',
                        params: {
                            ...userCenter,
                            imageDetails: {},
                            nearbySpaces,
                            area: {},
                        },
                    });
                } else {
                    Toast.show({
                        type: 'warnBig',
                        text1: this.translate('alertTitles.walkCloser'),
                        text2: this.translate('alertMessages.walkCloser'),
                    });
                    this.setState({
                        isUserInSpace: false,
                    });
                }
            }
        });
    };

    renderViewIncentives({
        spaceInView,
    }) {
        const { isUserInSpace } = this.state;
        const stepContainerStyle = [{ width: 50 }, spacingStyles.alignCenter];

        return (
            <View style={spacingStyles.fullWidth}>
                <View style={this.theme.styles.sectionContainer}>
                    <Text style={this.theme.styles.sectionTitleCenter}>
                        {this.translate('pages.viewSpace.h2.claimRewards')}
                    </Text>
                    {
                        spaceInView.featuredIncentiveKey === IncentiveRequirementKeys.SHARE_A_MOMENT &&
                        <Text style={this.theme.styles.sectionDescription}>
                            {this.translate('pages.viewSpace.info.shareAMoment.claimRewards')}
                        </Text>
                    }
                </View>
                <View style={this.themeArea.styles.banner}>
                    <View style={this.themeArea.styles.bannerTitle}>
                        <Button
                            type="clear"
                            icon={
                                <TherrIcon
                                    name="gift"
                                    size={28}
                                    style={this.themeArea.styles.bannerTitleIcon}
                                />
                            }
                            onPress={() =>{}}
                        />
                        <Text numberOfLines={1} style={[this.themeArea.styles.bannerTitleTextCenter, spacingStyles.flexOne]}>
                            {this.translate('pages.viewSpace.buttons.coinReward', {
                                count: spaceInView.featuredIncentiveRewardValue,
                            })}
                        </Text>
                    </View>
                    <Button
                        icon={
                            <TherrIcon
                                name="hand-coin"
                                size={28}
                                color={this.theme.colors.accentYellow}
                            />
                        }
                        iconRight
                        onPress={() =>{}}
                        type="clear"
                    />
                </View>
                {
                    spaceInView.featuredIncentiveKey === IncentiveRequirementKeys.SHARE_A_MOMENT &&
                        <View style={this.theme.styles.sectionContainer}>
                            <Text style={this.theme.styles.sectionTitleCenter}>
                                {this.translate('pages.viewSpace.h2.requirements')}
                            </Text>
                            <View style={spacingStyles.flexRow}>
                                <View style={stepContainerStyle}>
                                    <MaterialIcon
                                        name="looks-one"
                                        size={23}
                                        style={{ color: this.theme.colors.primary4 }}
                                    />
                                </View>
                                <Text style={[this.theme.styles.sectionDescription16, spacingStyles.flexOne]}>
                                    {this.translate('pages.viewSpace.info.shareAMoment.stepOne', {
                                        maxDistance: MAX_DISTANCE_TO_NEARBY_SPACE,
                                    })}
                                </Text>
                            </View>
                            <View style={spacingStyles.flexRow}>
                                <View style={stepContainerStyle}>
                                    <MaterialIcon
                                        name="looks-two"
                                        size={23}
                                        style={{ color: this.theme.colors.primary4 }}
                                    />
                                </View>
                                <Text style={[this.theme.styles.sectionDescription16, spacingStyles.flexOne]}>
                                    {this.translate('pages.viewSpace.info.shareAMoment.stepTwo')}
                                </Text>
                            </View>
                            <View style={spacingStyles.flexRow}>
                                <View style={stepContainerStyle}>
                                    <MaterialIcon
                                        name="looks-3"
                                        size={23}
                                        style={{ color: this.theme.colors.primary4 }}
                                    />
                                </View>
                                <Text style={[this.theme.styles.sectionDescription16, spacingStyles.flexOne]}>
                                    {this.translate('pages.viewSpace.info.shareAMoment.stepThree')}
                                </Text>
                            </View>
                            <View style={spacingStyles.flexRow}>
                                <View style={stepContainerStyle}>
                                    <MaterialIcon
                                        name="priority-high"
                                        size={23}
                                        style={{ color: this.theme.colors.primary4 }}
                                    />
                                </View>
                                <Text style={[this.theme.styles.sectionDescription16, spacingStyles.flexOne]}>
                                    {this.translate('pages.viewSpace.info.shareAMoment.protip')}
                                </Text>
                            </View>
                        </View>
                }
                <View style={this.theme.styles.sectionContainer}>
                    {/* TODO: Conditionally Show text if user has already claimed reward (or needs to walk closer) */}
                    <Button
                        containerStyle={this.themeButtons.styles.btnContainer}
                        buttonStyle={this.themeButtons.styles.btnLargeWithText}
                        // disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                        disabledStyle={this.themeForms.styles.buttonRoundDisabled}
                        disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                        titleStyle={this.themeButtons.styles.btnMediumTitle}
                        title={this.translate(
                            'menus.mapActions.uploadAMoment'
                        )}
                        icon={
                            <TherrIcon
                                name="map-marker-clock"
                                size={24}
                                style={this.themeButtons.styles.btnIcon}
                            />
                        }
                        onPress={() => this.handleCreateMoment()}
                        raised={false}
                    />
                    {
                        !isUserInSpace &&
                        <Text style={[this.theme.styles.sectionDescriptionNote, spacingStyles.marginTopSm]}>
                            {this.translate('pages.viewSpace.info.walkCloser')}
                        </Text>
                    }
                </View>
            </View>
        );
    }

    render() {
        const {
            areAreaOptionsVisible,
            isDeleting,
            isVerifyingDelete,
            isViewingIncentives,
            fetchedSpace,
            previewLinkId,
            previewStyleState,
        } = this.state;
        const { content, route, user } = this.props;
        const { space, isMyContent } = route.params;
        const spaceInView = {
            ...space,
            ...fetchedSpace,
        };
        const spaceUserName = isMyContent ? user.details.userName : spaceInView.fromUserName;
        const mediaId = (spaceInView.media && spaceInView.media[0]?.id) || (spaceInView.mediaIds?.length && spaceInView.mediaIds?.split(',')[0]);
        // Use the cacheable api-gateway media endpoint when image is public otherwise fallback to signed url
        const mediaPath = (spaceInView.media && spaceInView.media[0]?.path);
        const mediaType = (spaceInView.media && spaceInView.media[0]?.type);
        const spaceMedia = mediaPath && mediaType === Content.mediaTypes.USER_IMAGE_PUBLIC
            ? getUserContentUri(spaceInView.media[0], screenWidth, screenWidth)
            : content?.media[mediaId];
        let areaUserName = spaceUserName || this.translate('alertTitles.nameUnknown');
        if (areaUserName === 'therr_it_is') {
            // This allows us to hide the user name/image when space is create by (essentially) our admin account
            areaUserName = this.translate('alertTitles.nameUnknown');
        }

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
                            {
                                isViewingIncentives ?
                                    this.renderViewIncentives({
                                        spaceInView,
                                    }) :
                                    <AreaDisplay
                                        translate={this.translate}
                                        date={this.date}
                                        toggleAreaOptions={this.toggleAreaOptions}
                                        hashtags={this.hashtags}
                                        isDarkMode={true}
                                        isExpanded={true}
                                        inspectContent={() => null}
                                        area={spaceInView}
                                        goToViewMap={this.goToViewMap}
                                        goToViewUser={this.goToViewUser}
                                        goToViewIncentives={this.goToViewIncentives}
                                        updateAreaReaction={this.onUpdateSpaceReaction}
                                        // TODO: User Username from response
                                        user={user}
                                        areaUserDetails={{
                                            userName: areaUserName,
                                        }}
                                        areaMedia={spaceMedia}
                                        placeholderMediaType="autoplay"
                                        theme={this.theme}
                                        themeForms={this.themeForms}
                                        themeViewArea={this.themeArea}
                                    />
                            }
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
                        <View style={[this.themeAccentLayout.styles.footer, this.themeArea.styles.footer]}>
                            <Button
                                containerStyle={this.themeAccentForms.styles.backButtonContainer}
                                buttonStyle={this.themeAccentForms.styles.backButton}
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
                                                    'forms.editSpace.buttons.delete'
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
                                                    'forms.editSpace.buttons.cancel'
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
                    onRequestClose={this.toggleAreaOptions}
                    translate={this.translate}
                    onSelect={this.onSpaceOptionSelect}
                    themeButtons={this.themeButtons}
                    themeReactionsModal={this.themeReactionsModal}
                    shouldIncludeShareButton={true}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ViewSpace);
