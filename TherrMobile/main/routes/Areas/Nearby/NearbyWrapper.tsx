import React from 'react';
import { PermissionsAndroid, Platform, Text, View } from 'react-native';
// import { Slider } from 'react-native-elements';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ContentActions, MapActions } from 'therr-react/redux/actions';
import { IContentState, IMapState, IUserState, IUserConnectionsState } from 'therr-react/types';
import { PushNotificationsService } from 'therr-react/services';
// import { Location } from 'therr-js-utilities/constants';
// import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import Geolocation from 'react-native-geolocation-service';
import { buildStyles } from '../../../styles';
import { buildStyles as buildButtonsStyles } from '../../../styles/buttons';
import { buildStyles as buildDisclosureStyles } from '../../../styles/modal/locationDisclosure';
import { buildStyles as buildLoaderStyles } from '../../../styles/loaders';
import { buildStyles as buildMenuStyles } from '../../../styles/navigation/buttonMenu';
import { buildStyles as buildMomentStyles } from '../../../styles/user-content/areas';
import { buildStyles as buildReactionsModalStyles } from '../../../styles/modal/areaReactionsModal';
import { buildStyles as buildFormStyles } from '../../../styles/forms';
// import { buttonMenuHeightCompact } from '../../../styles/navigation/buttonMenu';
import translator from '../../../services/translator';
import AreaCarousel from '../AreaCarousel';
import AreaOptionsModal, { ISelectionType } from '../../../components/Modals/AreaOptionsModal';
import LottieLoader, { ILottieId } from '../../../components/LottieLoader';
import getActiveCarouselData from '../../../utilities/getActiveCarouselData';
import { CAROUSEL_TABS } from '../../../constants';
import { handleAreaReaction, loadMoreAreas, navToViewContent } from '../../../utilities/postViewHelpers';
import requestLocationServiceActivation from '../../../utilities/requestLocationServiceActivation';
import { checkAndroidPermission, isLocationPermissionGranted, requestOSMapPermissions } from '../../../utilities/requestOSPermissions';
import LocationActions from '../../../redux/actions/LocationActions';
import { ILocationState } from '../../../types/redux/location';
import LocationUseDisclosureModal from '../../../components/Modals/LocationUseDisclosureModal';
import getDirections from '../../../utilities/getDirections';
import GpsEnableButtonDialog from './GPSEnableDialog';
import getReadableDistance from '../../../utilities/getReadableDistance';

function getRandomLoaderId(): ILottieId {
    const options: ILottieId[] = ['donut', 'earth', 'taco', 'shopping', 'happy-swing', 'karaoke', 'yellow-car', 'zeppelin', 'therr-black-rolling'];
    const selected = Math.floor(Math.random() * options.length);
    return options[selected] as ILottieId;
}

interface INearbyWrapperDispatchProps {
    updateUserCoordinates: Function;
    updateUserRadius: Function;

    searchActiveEvents: Function;
    updateActiveEventsStream: Function;
    createOrUpdateEventReaction: Function;

    searchActiveMoments: Function;
    updateActiveMomentsStream: Function;
    createOrUpdateMomentReaction: Function;

    searchActiveSpaces: Function;
    updateActiveSpacesStream: Function;
    createOrUpdateSpaceReaction: Function;

    updateGpsStatus: Function;
    updateLocationDisclosure: Function;
    updateLocationPermissions: Function;
}

interface IStoreProps extends INearbyWrapperDispatchProps {
    content: IContentState;
    location: ILocationState;
    map: IMapState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface INearbyWrapperProps extends IStoreProps {
    carouselRef?: any;
    displaySize: 'small' | 'medium' | 'large';
    navigation: any;
    shouldDisableLocationSendEvent: boolean;
    isInMapView?: boolean;
}

interface INearbyWrapperState {
    activeTab: string;
    isFirstLoad: boolean;
    isLoading: boolean;
    isLocationUseDisclosureModalVisible: boolean;
    isNearbyNewsfeedVisible: boolean;
    areAreaOptionsVisible: boolean;
    selectedArea: any;
}

const shouldRenderNearbyAreaFeed = (location) => {
    return location?.settings.isGpsEnabled
        && location?.settings?.isLocationDislosureComplete
        && isLocationPermissionGranted(location?.permissions);
};

const mapStateToProps = (state: any) => ({
    content: state.content,
    location: state.location,
    map: state.map,
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            updateUserCoordinates: MapActions.updateUserCoordinates,
            updateUserRadius: MapActions.updateUserRadius,

            searchActiveEvents: ContentActions.searchActiveEvents,
            updateActiveEventsStream: ContentActions.updateActiveEventsStream,
            createOrUpdateEventReaction: ContentActions.createOrUpdateEventReaction,

            searchActiveMoments: ContentActions.searchActiveMoments,
            updateActiveMomentsStream: ContentActions.updateActiveMomentsStream,
            createOrUpdateMomentReaction: ContentActions.createOrUpdateMomentReaction,

            searchActiveSpaces: ContentActions.searchActiveSpaces,
            updateActiveSpacesStream: ContentActions.updateActiveSpacesStream,
            createOrUpdateSpaceReaction: ContentActions.createOrUpdateSpaceReaction,

            updateGpsStatus: LocationActions.updateGpsStatus,
            updateLocationDisclosure: LocationActions.updateLocationDisclosure,
            updateLocationPermissions: LocationActions.updateLocationPermissions,
        },
        dispatch
    );

class NearbyWrapper extends React.Component<INearbyWrapperProps, INearbyWrapperState> {
    private carouselRef;
    private translate: (key: string, params?: any) => any;
    private loaderId: ILottieId;
    private loadTimeoutId: any;
    private locationListener: any;
    private unsubscribeNavigationBlurListener;
    private unsubscribeNavigationListener;
    private theme = buildStyles();
    private themeButtons = buildButtonsStyles();
    private themeDisclosure = buildDisclosureStyles();
    private themeLoader = buildLoaderStyles();
    private themeMenu = buildMenuStyles();
    private themeMoments = buildMomentStyles();
    private themeReactionsModal = buildReactionsModalStyles();
    private themeForms = buildFormStyles();
    private mapWatchId;

    // This allows us to fetch results when the user enables location from the map, then opens the Nearby bottom sheet
    static getDerivedStateFromProps(nextProps: INearbyWrapperProps, nextState: INearbyWrapperState) {
        if (!nextState.isNearbyNewsfeedVisible && shouldRenderNearbyAreaFeed(nextProps.location)) {
            return {
                isNearbyNewsfeedVisible: true,
            };
        }

        return null;
    }

    constructor(props) {
        super(props);

        this.state = {
            activeTab: CAROUSEL_TABS.DISCOVERIES,
            isFirstLoad: true,
            isLoading: true,
            isLocationUseDisclosureModalVisible: false,
            isNearbyNewsfeedVisible: false,
            areAreaOptionsVisible: false,
            selectedArea: {},
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
        this.themeDisclosure = buildDisclosureStyles(props.user.settings?.mobileThemeName);
        this.themeLoader = buildLoaderStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeMoments = buildMomentStyles(props.user.settings?.mobileThemeName);
        this.themeReactionsModal = buildReactionsModalStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
        this.loaderId = getRandomLoaderId();
    }

    componentDidMount() {
        const { navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.nearby.headerTitle'),
        });

        this.handleRefreshConditionally();

        this.unsubscribeNavigationBlurListener = navigation.addListener('blur', () => {
            this.clearTimeouts();
        });

        this.unsubscribeNavigationListener = navigation.addListener('focus', () => {
            this.handleRefreshConditionally();
        });
    }

    // This allows us to fetch results when the user enables location from the map, then opens the Nearby bottom sheet
    componentDidUpdate(prevProps: Readonly<INearbyWrapperProps>, prevState: Readonly<INearbyWrapperState>): void {
        if (!prevState.isNearbyNewsfeedVisible && this.state.isNearbyNewsfeedVisible) {
            this.handleRefreshConditionally(true);
        }
    }

    componentWillUnmount() {
        this.unsubscribeNavigationBlurListener();
        this.unsubscribeNavigationListener();
        if (this.locationListener) {
            this.locationListener();
        }
        this.clearTimeouts();
        Geolocation.clearWatch(this.mapWatchId);
        Geolocation.stopObserving();
    }

    clearTimeouts = () => {
        clearTimeout(this.loadTimeoutId);
    };

    getEmptyListMessage = () => this.translate('pages.areas.noNearbyAreasFound');

    goToMap = () => {
        const { navigation } = this.props;
        navigation.navigate('Map', {
            shouldShowPreview: false,
        });
    };

    goToArea = (area) => {
        const { navigation, user } = this.props;

        navToViewContent(area, user, navigation.navigate);
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

    handleRefreshConditionally = (shouldShowLoader = false) => {
        // const { activeTab, isFirstLoad } = this.state;
        const { location } = this.props;

        if (shouldShowLoader) {
            this.setState({
                isLoading: true,
            });
        }

        // const activeData = getActiveCarouselData({
        //     activeTab,
        //     content,
        //     isForBookmarks: false,
        //     shouldIncludeMoments: true,
        //     shouldIncludeSpaces: true,
        // }, 'distance');

        if (shouldRenderNearbyAreaFeed(location)
        ) {
            return this.handleRefresh(false);
        } else {
            this.setState({
                isLoading: false,
            });
            return Promise.resolve();
        }
    };

    handleRefresh = (shouldShowLoader = false) => {
        const { content, location, updateActiveMomentsStream, updateActiveSpacesStream, user } = this.props;
        const { activeTab } = this.state;

        if (shouldShowLoader) {
            this.setState({
                isLoading: true,
            });
        }

        const activeMomentsPromise = updateActiveMomentsStream({
            userLatitude: location?.user?.latitude,
            userLongitude: location?.user?.longitude,
            withMedia: true,
            withUser: true,
            offset: 0,
            ...content.activeAreasFilters,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        });

        const activeSpacesPromise = updateActiveSpacesStream({
            userLatitude: location?.user?.latitude,
            userLongitude: location?.user?.longitude,
            withMedia: true,
            withUser: true,
            offset: 0,
            ...content.activeAreasFilters,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        });

        return Promise.all([activeMomentsPromise, activeSpacesPromise])
            .then(() => {
                const data = getActiveCarouselData({
                    activeTab,
                    content,
                    isForBookmarks: false,
                    shouldIncludeMoments: true,
                    shouldIncludeSpaces: true,
                }, 'distance');
                const hasRenderedFirstContent = data?.[0]?.distance != null;
                if (hasRenderedFirstContent) {
                    this.setState({ isFirstLoad: false });
                }
            })
            .finally(() => {
                this.loadTimeoutId = setTimeout(() => {
                    this.setState({ isLoading: false });
                }, 400);
            });
    };

    tryLoadMore = () => {
        const { content, location, searchActiveEvents, searchActiveMoments, searchActiveSpaces, user } = this.props;

        loadMoreAreas({
            content,
            location,
            user,
            searchActiveEvents,
            searchActiveMoments,
            searchActiveSpaces,
        });
    };

    onAreaOptionSelect = (type: ISelectionType) => {
        const { selectedArea } = this.state;
        const { createOrUpdateEventReaction, createOrUpdateSpaceReaction, createOrUpdateMomentReaction, user } = this.props;

        if (type === 'getDirections') {
            getDirections({
                latitude: selectedArea.latitude,
                longitude: selectedArea.longitude,
                title: selectedArea.notificationMsg,
            });
        } else {
            handleAreaReaction(selectedArea, type, {
                user,
                createOrUpdateEventReaction,
                createOrUpdateMomentReaction,
                createOrUpdateSpaceReaction,
                toggleAreaOptions: this.toggleAreaOptions,
            });
        }
    };

    onTabSelect = (tabName: string) => {
        this.setState({
            activeTab: tabName,
        });
    };

    scrollTop = () => {
        this.carouselRef?.scrollToOffset({ animated: true, offset: 0 });
    };

    toggleAreaOptions = (area) => {
        const { areAreaOptionsVisible } = this.state;
        this.setState({
            areAreaOptionsVisible: !areAreaOptionsVisible,
            selectedArea: areAreaOptionsVisible ? {} : area,
        });
    };

    onSliderAwarenessChange = (value) => {
        const { map, updateUserRadius } = this.props;

        updateUserRadius({
            radiusOfAwareness: value || map.radiusOfAwareness,
            radiusOfInfluence: map.radiusOfInfluence,
        });
    };

    onSliderInfluenceChange = (value) => {
        const { map, updateUserRadius } = this.props;

        updateUserRadius({
            radiusOfAwareness: map.radiusOfAwareness,
            radiusOfInfluence: value || map.radiusOfInfluence,
        });
    };

    positionSuccessCallback = (position) => {
        const { shouldDisableLocationSendEvent, map, updateUserCoordinates, location } = this.props;
        const { isFirstLoad } = this.state;
        // TODO: Throttle to prevent too many requests
        // Only update when Map is not already handling this in the background
        if (isFirstLoad || !shouldDisableLocationSendEvent) {
            const coords = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
            };
            if (coords.latitude !== location?.user?.latitude || coords.longitude !== location?.user?.longitude) {
                updateUserCoordinates(coords);
                PushNotificationsService.postLocationChange({
                    longitude: position.coords.longitude,
                    latitude: position.coords.latitude,
                    // lastLocationSendForProcessing,
                    radiusOfAwareness: map.radiusOfAwareness,
                    radiusOfInfluence: map.radiusOfInfluence,
                });
            }
        }
    };

    positionErrorCallback = (error) => {
        console.log('geolocation error', error.code);
    };

    handleEnableLocationPress = () => {
        const {
            location,
            updateGpsStatus,
            updateLocationDisclosure,
            updateLocationPermissions,
        } = this.props;

        let perms;

        return requestLocationServiceActivation({
            isGpsEnabled: location?.settings?.isGpsEnabled,
            translate: this.translate,
            shouldIgnoreRequirement: false,
        }).then((response: any) => {
            // TODO: if location is set to never_ask_again, display modal to encourage enabling in settings
            if (response?.status || Platform.OS === 'ios') {
                if (response?.alreadyEnabled && isLocationPermissionGranted(location.permissions)) {
                    // Ensure that the user sees location disclosure even if gps is already enabled (otherwise requestOSMapPermissions will handle it)
                    if (!location?.settings?.isLocationDislosureComplete) {
                        this.setState({
                            isLocationUseDisclosureModalVisible: true,
                        });
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
        }).then((shouldAbort: boolean) => {
            if (shouldAbort) { // short-circuit because backup disclosure is in progress
                return;
            }

            return requestOSMapPermissions(updateLocationPermissions).then((permissions) => {
                // TODO: If permissions are never ask again, display instructions for user to go to app settings and allow
                return new Promise((resolve, reject) => {
                    let extraPromise = Promise.resolve(false);
                    if (Platform.OS === 'android' && permissions[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] !== 'granted') {
                        extraPromise = checkAndroidPermission(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION, updateLocationPermissions);
                    }

                    return extraPromise.then((isCoarseLocationGranted) => {
                        perms = {
                            ...permissions,
                            [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]: isCoarseLocationGranted ? 'granted' : 'denied',
                        };
                        // If permissions are granted
                        if (isLocationPermissionGranted(perms)) {
                            Geolocation.getCurrentPosition(
                                this.positionSuccessCallback,
                                this.positionErrorCallback,
                                {
                                    enableHighAccuracy: true,
                                },
                            );
                            this.mapWatchId = Geolocation.watchPosition(
                                this.positionSuccessCallback,
                                this.positionErrorCallback,
                                {
                                    enableHighAccuracy: true,
                                },
                            );

                            return resolve(null);
                        } else {
                            console.log('Location permission denied');
                            return reject('permissionDenied');
                        }
                    });
                });
            })
                .catch((error) => {
                    console.log('requestOSPermissionsError', error);
                    // TODO: Display message encouraging user to turn on location permissions in settings
                    // this.goToHome();
                });
        }).catch((error) => {
            console.log('gps activation error', error);
            // this.goToHome();
        });
    };

    handleLocationDisclosureSelect = (/* selection */) => {
        const { updateLocationDisclosure } = this.props;
        // TODO: Decide if selection should be dynamic
        updateLocationDisclosure(true).then(() => {
            this.toggleLocationUseDisclosure();
            this.handleEnableLocationPress();
        });
    };

    toggleLocationUseDisclosure = () => {
        const { isLocationUseDisclosureModalVisible } = this.state;
        this.setState({
            isLocationUseDisclosureModalVisible: !isLocationUseDisclosureModalVisible,
        });
    };



    renderHeader = () => {
        // const { radiusOfAwareness, radiusOfInfluence } = this.props.map;

        // const radiusOfAwarenessMiles = Math.round(radiusOfAwareness * 0.000621371 * 100) / 100;
        // const radiusOfInfluenceMiles = Math.round(radiusOfInfluence * 0.000621371 * 100) / 100;


        return (
            <>
                <View style={[this.theme.styles.sectionContainerBottomSheet, { backgroundColor: this.theme.colors.brandingWhite }]}>
                    <Text style={this.theme.styles.sectionTitleBottomSheet}>
                        {this.translate('components.nearbyBottomSheet.title')}
                    </Text>
                </View>
                {/* <View style={[this.themeMoments.styles.areaCarouselHeaderSliders, { backgroundColor: this.theme.colors.backgroundWhite }]}>
                    <View style={this.themeForms.styles.inputSliderContainerTight}>
                        <Text style={this.themeForms.styles.inputLabelDark}>
                            {`${this.translate('forms.nearbyForm.labels.radiusOfAwareness', { miles: radiusOfAwarenessMiles })}`}
                        </Text>
                        <Slider
                            value={radiusOfAwareness}
                            // onValueChange={(value) => this.onSliderAwarenessChange(value)}
                            maximumValue={Location.MAX_RADIUS_OF_AWARENESS}
                            minimumValue={Location.MIN_RADIUS_OF_AWARENESS}
                            step={2500}
                            thumbStyle={{ backgroundColor: this.theme.colors.accentBlue, height: 20, width: 20 }}
                            thumbTouchSize={{ width: 30, height: 30 }}
                            minimumTrackTintColor={this.theme.colorVariations.accentBlueLightFade}
                            maximumTrackTintColor={this.theme.colorVariations.accentBlueHeavyFade}
                            onSlidingStart={Keyboard.dismiss}
                            onSlidingComplete={(value) => this.onSliderAwarenessChange(value)}
                        />
                    </View>
                    <View style={this.themeForms.styles.inputSliderContainerTight}>
                        <Text style={this.themeForms.styles.inputLabelDark}>
                            {`${this.translate('forms.nearbyForm.labels.radiusOfInfluence', { miles: radiusOfInfluenceMiles })}`}
                        </Text>
                        <Slider
                            value={radiusOfInfluence}
                            // onValueChange={(value) => this.onSliderInfluenceChange(value)}
                            maximumValue={Location.MAX_RADIUS_OF_INFLUENCE}
                            minimumValue={Location.MIN_RADIUS_OF_INFLUENCE}
                            step={250}
                            thumbStyle={{ backgroundColor: this.theme.colors.brandingOrange, height: 20, width: 20 }}
                            thumbTouchSize={{ width: 30, height: 30 }}
                            minimumTrackTintColor={this.theme.colorVariations.brandingOrangeLightFade}
                            maximumTrackTintColor={this.theme.colorVariations.brandingOrangeHeavyFade}
                            onSlidingStart={Keyboard.dismiss}
                            onSlidingComplete={(value) => this.onSliderInfluenceChange(value)}
                        />
                    </View>
                </View> */}
            </>
        );
    };

    render() {
        const {
            activeTab,
            areAreaOptionsVisible,
            isLocationUseDisclosureModalVisible,
            isLoading,
            selectedArea,
        } = this.state;
        const {
            carouselRef,
            createOrUpdateEventReaction,
            createOrUpdateMomentReaction,
            createOrUpdateSpaceReaction,
            content,
            displaySize,
            isInMapView,
            location,
            user,
        } = this.props;

        // TODO: Fetch missing media
        const fetchMedia = () => {};
        const activeData = isLoading ? [] : getActiveCarouselData({
            activeTab,
            content,
            isForBookmarks: false,
            isForDrafts: false,
            shouldIncludeMoments: true,
            shouldIncludeSpaces: false, // spaces are best viewed in the animated preview
        }, 'distance');
        const formattedActiveData = activeData.map(d => {
            const formatted = {
                ...d,
            };
            if (d.distance != null && !d.distance.toString().includes(' ')) {
                formatted.distance = getReadableDistance(formatted.distance);
            }

            return formatted;
        });
        const shouldRenderAreaFeed = shouldRenderNearbyAreaFeed(location);

        return (
            <>
                {
                    shouldRenderAreaFeed &&
                        <AreaCarousel
                            activeData={formattedActiveData}
                            content={content}
                            displaySize={displaySize}
                            fetchMedia={fetchMedia}
                            inspectContent={this.goToArea}
                            goToViewMap={this.goToViewMap}
                            goToViewUser={this.goToViewUser}
                            toggleAreaOptions={this.toggleAreaOptions}
                            translate={this.translate}
                            containerRef={(component) => { this.carouselRef = component; carouselRef && carouselRef(component); }}
                            handleRefresh={this.handleRefresh}
                            isLoading={isLoading}
                            onEndReached={this.tryLoadMore}
                            updateEventReaction={createOrUpdateEventReaction}
                            updateMomentReaction={createOrUpdateMomentReaction}
                            updateSpaceReaction={createOrUpdateSpaceReaction}
                            emptyListMessage={this.getEmptyListMessage()}
                            renderHeader={this.renderHeader}
                            renderLoader={() => <LottieLoader id={this.loaderId} theme={this.themeLoader} />}
                            user={user}
                            rootStyles={this.theme.styles}
                            renderFooter={
                                isInMapView
                                    ? () => <View style={this.theme.styles.nearbyWrapperFooter} />
                                    : null
                            }
                            // viewportHeight={viewportHeight}
                            // viewportWidth={viewportWidth}
                        />
                }
                {
                    !shouldRenderAreaFeed && <GpsEnableButtonDialog
                        handleEnableLocationPress={this.handleEnableLocationPress}
                        theme={this.theme}
                        themeForms={this.themeForms}
                        translate={this.translate}
                    />
                }
                <AreaOptionsModal
                    isVisible={areAreaOptionsVisible}
                    onRequestClose={() => this.toggleAreaOptions(selectedArea)}
                    translate={this.translate}
                    onSelect={this.onAreaOptionSelect}
                    themeButtons={this.themeButtons}
                    themeReactionsModal={this.themeReactionsModal}
                />
                <LocationUseDisclosureModal
                    isVisible={isLocationUseDisclosureModalVisible}
                    translate={this.translate}
                    onRequestClose={this.toggleLocationUseDisclosure}
                    onSelect={this.handleLocationDisclosureSelect}
                    themeButtons={this.themeButtons}
                    themeDisclosure={this.themeDisclosure}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(NearbyWrapper);
