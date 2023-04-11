import React, { Ref } from 'react';
import { Animated, Dimensions, View } from 'react-native';
import MapView from 'react-native-map-clustering';
import { PROVIDER_GOOGLE, Circle, Marker, MapPressEvent, MarkerPressEvent } from 'react-native-maps';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { PushNotificationsService } from 'therr-react/services';
import { ITherrMapViewState as ITherrMapViewReduxState, INotificationsState, IReactionsState, IUserState } from 'therr-react/types';
import { MapActions, ReactionActions } from 'therr-react/redux/actions';
import { IAreaType, IContentState } from 'therr-js-utilities/types';
import { distanceTo, insideCircle } from 'geolocation-utils';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { ILocationState } from '../../types/redux/location';
import translator from '../../services/translator';
import {
    ANIMATE_TO_REGION_DURATION_FAST,
    ANIMATE_TO_REGION_DURATION_RAPID,
    INITIAL_LATITUDE_DELTA,
    INITIAL_LONGITUDE_DELTA,
    PRIMARY_LATITUDE_DELTA,
    PRIMARY_LONGITUDE_DELTA,
    DEFAULT_MOMENT_PROXIMITY,
    MIN_ZOOM_LEVEL,
    LOCATION_PROCESSING_THROTTLE_MS,
    SECONDARY_LATITUDE_DELTA,
    SECONDARY_LONGITUDE_DELTA,
    MAX_ANIMATION_LATITUDE_DELTA,
    MAX_ANIMATION_LONGITUDE_DELTA,
} from '../../constants';
import { buildStyles } from '../../styles';
import { buildStyles as buildBottomSheetStyles } from '../../styles/bottom-sheet';
import { buildStyles as buildViewAreaStyles } from '../../styles/user-content/areas/viewing';
import mapStyles from '../../styles/map';
import mapCustomStyle from '../../styles/map/googleCustom';
import MarkerIcon from './MarkerIcon';
import { isMyContent } from '../../utilities/content';
import formatDate from '../../utilities/formatDate';
import AreaDisplayCard from '../../components/UserContent/AreaDisplayCard';

const { width: viewPortWidth, height: viewPortHeight } = Dimensions.get('window');

const CARD_HEIGHT = viewPortHeight / 5;
const CARD_WIDTH = CARD_HEIGHT - 50;
const spaceBubbleWidth = viewPortWidth / 8;
const MAX_CIRCLE_DIAMETER_SCALE = 2;

const hapticFeedbackOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
};


interface ITherrMapViewDispatchProps {
    fetchMedia: Function;
    createOrUpdateMomentReaction: Function;
    createOrUpdateSpaceReaction: Function;
    updateUserCoordinates: Function;
    setSearchDropdownVisibility: Function;
}

interface IStoreProps extends ITherrMapViewDispatchProps {
    content: IContentState;
    location: ILocationState;
    map: ITherrMapViewReduxState;
    notifications: INotificationsState;
    reactions: IReactionsState;
    user: IUserState;
    onRegionChange: any;
    onRegionChangeComplete: any;
}

// Regular component props
export interface ITherrMapViewProps extends IStoreProps {
    areMapActionsVisible: boolean;
    animateToWithHelp: (doAnimate: any) => any;
    circleCenter: { longitude: number, latitude: number };
    expandBottomSheet: any;
    filteredMoments: any;
    filteredSpaces: any;
    hideCreateActions: () => any;
    isScrollEnabled: boolean;
    onPreviewBottomSheetClose: any;
    onPreviewBottomSheetOpen: any;
    onMapLayout: any;
    mapRef: any;
    navigation: any;
    route: any;
    showAreaAlert: () => any;
    shouldFollowUserLocation: boolean;
    shouldRenderMapCircles: boolean;
    updateCircleCenter: (center: { longitude: number, latitude: number }) => any;
}

interface ITherrMapViewState {
    activeMoment: any;
    activeMomentDetails: any;
    activeSpace: any;
    activeSpaceDetails: any;
    areasInPreview: any[];
    isMapReady: boolean;
    isPreviewBottomSheetVisible: boolean;
    lastLocationSendForProcessing?: number,
    lastLocationSendForProcessingCoords?: {
        longitude: number,
        latitude: number,
    },
}

const mapStateToProps = (state: any) => ({
    content: state.content,
    location: state.location,
    map: state.map,
    notifications: state.notifications,
    reactions: state.reactions,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            fetchMedia: MapActions.fetchMedia,
            updateUserCoordinates: MapActions.updateUserCoordinates,
            setSearchDropdownVisibility: MapActions.setSearchDropdownVisibility,
            createOrUpdateMomentReaction: ReactionActions.createOrUpdateMomentReaction,
            createOrUpdateSpaceReaction: ReactionActions.createOrUpdateSpaceReaction,
        },
        dispatch
    );

class TherrMapView extends React.PureComponent<ITherrMapViewProps, ITherrMapViewState> {
    static getDerivedStateFromProps(nextProps: ITherrMapViewProps, nextState: ITherrMapViewState) {
        if (nextProps.areMapActionsVisible && nextState.isPreviewBottomSheetVisible) {
            return {
                isPreviewBottomSheetVisible: false,
            };
        }
        return {};
    }

    private localeShort = 'en-US'; // TODO: Derive from user locale
    private mapViewRef: any;
    private theme = buildStyles();
    private themeBottomSheet = buildBottomSheetStyles();
    private themeViewArea = buildViewAreaStyles();
    private translate: Function;
    private previewAnimation;
    private previewScrollIndex;
    private timeoutIdPreviewRegion;
    private unsubscribeBlurListener;
    private unsubscribeFocusListener;

    constructor(props) {
        super(props);

        this.state = {
            activeMoment: {},
            activeMomentDetails: {},
            activeSpace: {},
            activeSpaceDetails: {},
            areasInPreview: [],
            isMapReady: false,
            isPreviewBottomSheetVisible: false,
        };

        this.reloadTheme();
        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount = () => {
        const { navigation } = this.props;
        this.previewAnimation = new Animated.Value(0);
        this.addAnimationListener();

        this.unsubscribeFocusListener = navigation.addListener('focus', () => {
            this.setState({
                isPreviewBottomSheetVisible: false,
            });
        });

        this.unsubscribeBlurListener = navigation.addListener('blur', () => {
            this.setState({
                isPreviewBottomSheetVisible: false,
            });
        });
    };

    componentDidUpdate(prevProps: ITherrMapViewProps) {
        const { user } = this.props;

        if (prevProps.user?.settings?.mobileThemeName !== user?.settings?.mobileThemeName) {
            this.reloadTheme();
        }
    }

    componentWillUnmount() {
        if (this.unsubscribeBlurListener) {
            this.unsubscribeBlurListener();
        }
        if (this.unsubscribeFocusListener) {
            this.unsubscribeFocusListener();
        }
        this.removeAnimation();
        this.setState({
            isMapReady: false,
        });
    }

    reloadTheme = (shouldForceUpdate: boolean = false) => {
        const themeName = this.props.user.settings?.mobileThemeName;
        this.theme = buildStyles(themeName);
        this.themeBottomSheet = buildBottomSheetStyles(themeName);
        this.themeViewArea = buildViewAreaStyles(themeName);

        if (shouldForceUpdate) {
            this.forceUpdate();
        }
    };

    addAnimationListener = () => {
        this.previewAnimation.addListener(({ value }) => {
            const { areasInPreview } = this.state;
            if (areasInPreview.length && value) {
                clearTimeout(this.timeoutIdPreviewRegion);
                let index = Math.floor(value / CARD_WIDTH + 0.2); // animate 20% away from landing on the next item
                if (index >= areasInPreview.length) {
                    index = areasInPreview.length - 1;
                }
                if (index <= 0) {
                    index = 0;
                }

                this.timeoutIdPreviewRegion = setTimeout(() => {
                    if (this.previewScrollIndex !== index) {
                        this.previewScrollIndex = index;
                        const { latitude, longitude } = areasInPreview[index] || {};
                        if (latitude && longitude) {
                            const { location } = this.props;
                            let animationLatitudeDelta = PRIMARY_LATITUDE_DELTA * 2;
                            let animationLongitudeDelta = PRIMARY_LONGITUDE_DELTA * 2;

                            if (location?.user?.latitudeDelta && location?.user?.latitudeDelta <= MAX_ANIMATION_LATITUDE_DELTA) {
                                animationLatitudeDelta = location?.user?.latitudeDelta;
                            }
                            if (location?.user?.longitudeDelta && location?.user?.longitudeDelta <= MAX_ANIMATION_LONGITUDE_DELTA) {
                                animationLongitudeDelta = location?.user?.longitudeDelta;
                            }
                            const loc = {
                                latitude,
                                longitude,
                                latitudeDelta: animationLatitudeDelta,
                                longitudeDelta: animationLongitudeDelta,
                            };
                            this.props.animateToWithHelp(
                                () => this.mapViewRef && this.mapViewRef.animateToRegion(loc, ANIMATE_TO_REGION_DURATION_RAPID)
                            );
                        }
                    }
                }, 50);
            }
        });
    };

    removeAnimation = () => {
        // removes the listener
        this.previewAnimation = new Animated.Value(0);
        clearTimeout(this.timeoutIdPreviewRegion);
        this.previewScrollIndex = 0;
    };

    getAreaDetails = (area) => new Promise((resolve) => {
        const { user } = this.props;
        const details: any = {};

        if (isMyContent(area, user)) {
            details.userDetails = user.details;
        }

        return resolve(details);
    });

    /**
     * On press handler for any map press. Handles pressing an area, and determines when view or bottom-sheet menu to open
     */
    handleMapPress = (event: MapPressEvent | MarkerPressEvent) => {
        const { nativeEvent } = event;
        const {
            circleCenter,
            createOrUpdateMomentReaction,
            createOrUpdateSpaceReaction,
            filteredMoments,
            filteredSpaces,
            navigation,
            setSearchDropdownVisibility,
            user,
        } = this.props;

        this.props.hideCreateActions();

        setSearchDropdownVisibility(false);

        const pressedSpaces: any[] = Object.values(filteredSpaces).filter((space: any) => {
            if (!space.longitude || !space.latitude) {
                return false;
            }
            return insideCircle(nativeEvent.coordinate, {
                lon: space.longitude,
                lat: space.latitude,
            }, space.radius);
        });

        if (pressedSpaces.length) {
            ReactNativeHapticFeedback.trigger('impactLight', hapticFeedbackOptions);

            this.setState({
                activeMoment: {},
                activeMomentDetails: {},
            });

            const selectedSpace = pressedSpaces[0];

            const distToCenter = distanceTo({
                lon: circleCenter.longitude,
                lat: circleCenter.latitude,
            }, {
                lon: selectedSpace.longitude,
                lat: selectedSpace.latitude,
            });
            const isProximitySatisfied = distToCenter - selectedSpace.radius <= selectedSpace.maxProximity;
            if (!isProximitySatisfied
                && !isMyContent(selectedSpace, user)
                && !(this.isAreaActivated('spaces', selectedSpace) && !selectedSpace.doesRequireProximityToView)) {
                // Deny activation
                this.props.showAreaAlert();
            } else {
                // Activate space
                createOrUpdateSpaceReaction(selectedSpace.id, {
                    userViewCount: 1,
                    userHasActivated: true,
                }).then(() => {
                    this.getAreaDetails(selectedSpace)
                        .then((details) => {
                            this.setState({
                                activeSpace: selectedSpace,
                                activeSpaceDetails: details,
                            }, () => {
                                // navigation.navigate('ViewSpace', {
                                //     isMyContent: isMyContent(selectedSpace, user),
                                //     space: selectedSpace,
                                //     spaceDetails: details,
                                // });
                                // Showing a preview is a better experience then jumping right to the space
                                const loc = {
                                    longitude: selectedSpace.longitude,
                                    latitude: selectedSpace.latitude,
                                    latitudeDelta: PRIMARY_LATITUDE_DELTA * 2,
                                    longitudeDelta: PRIMARY_LONGITUDE_DELTA * 2,
                                };
                                this.props.animateToWithHelp(
                                    () => this.mapViewRef && this.mapViewRef.animateToRegion(loc, ANIMATE_TO_REGION_DURATION_RAPID)
                                );
                                this.togglePreviewBottomSheet(nativeEvent.coordinate, selectedSpace.id);
                            });
                        })
                        .catch(() => {
                            // TODO: Add error handling
                            console.log('Failed to get space details!');
                        });
                });
            }
        } else {
            this.setState({
                activeSpace: {},
                activeSpaceDetails: {},
            });

            const pressedMoments: any[] = Object.values(filteredMoments).filter((moment: any) => {
                if (!moment.longitude || !moment.latitude) {
                    return false;
                }
                return insideCircle(nativeEvent.coordinate, {
                    lon: moment.longitude,
                    lat: moment.latitude,
                }, moment.radius);
            });

            if (pressedMoments.length) {
                const selectedMoment = pressedMoments[0];

                // this.props.expandBottomSheet();

                const distToCenter = distanceTo({
                    lon: circleCenter.longitude,
                    lat: circleCenter.latitude,
                }, {
                    lon: selectedMoment.longitude,
                    lat: selectedMoment.latitude,
                });
                const isProximitySatisfied = distToCenter - selectedMoment.radius <= selectedMoment.maxProximity;
                if (!isProximitySatisfied
                    && !isMyContent(selectedMoment, user)
                    && !(this.isAreaActivated('moments', selectedMoment) && !selectedMoment.doesRequireProximityToView)) {
                    // Deny activation
                    this.props.showAreaAlert();
                } else {
                    // Activate moment
                    createOrUpdateMomentReaction(selectedMoment.id, {
                        userViewCount: 1,
                        userHasActivated: true,
                    }, selectedMoment.fromUserId, user.details.userName);
                    this.getAreaDetails(selectedMoment)
                        .then((details) => {
                            this.setState({
                                activeMoment: selectedMoment,
                                activeMomentDetails: details,
                            }, () => {
                                // TODO: Consider requiring location to view an area
                                navigation.navigate('ViewMoment', {
                                    isMyContent: isMyContent(selectedMoment, user),
                                    moment: selectedMoment,
                                    momentDetails: details,
                                });
                            });
                        })
                        .catch(() => {
                            // TODO: Add error handling
                            console.log('Failed to get moment details!');
                        });
                }
            } else {
                this.togglePreviewBottomSheet(nativeEvent.coordinate);
                this.setState({
                    activeMoment: {},
                    activeMomentDetails: {},
                });
            }
        }
    };

    togglePreviewBottomSheet = (pressedCoords: { latitude: number, longitude: number }, pressedAreaId?: any) => {
        const { content, location } = this.props;
        const { areasInPreview, isPreviewBottomSheetVisible } = this.state;

        if (isPreviewBottomSheetVisible && pressedAreaId) {
            return;
        }

        let modifiedAreasInPreview = [...areasInPreview];
        if (!isPreviewBottomSheetVisible) {
            // TODO: Fetch media
            const { filteredSpaces } = this.props;

            // Label with user's location if available, but sort by distance from pressedCoord
            const sortedAreasWithDistance = Object.values(filteredSpaces).map((area: any) => {
                const milesFromPress = distanceTo({
                    lon: pressedCoords.longitude,
                    lat: pressedCoords.latitude,
                }, {
                    lon: area.longitude,
                    lat: area.latitude,
                }) / 1069.344; // convert meters to miles
                const milesFromUser = !(location?.user?.longitude && location?.user?.latitude)
                    ? milesFromPress
                    : distanceTo({
                        lon: location?.user?.longitude,
                        lat: location?.user?.latitude,
                    }, {
                        lon: area.longitude,
                        lat: area.latitude,
                    }) / 1069.344; // convert meters to miles
                return {
                    ...area,
                    distanceFromUser: milesFromUser,
                    distanceFromPress: milesFromPress,
                };
            }).sort((a, b) => a.distanceFromPress - b.distanceFromPress);

            const areasArray: any[] = [];
            let pressedAreas: any[] = [];
            let featuredAreas: any[] = [];
            let missingMediaIds: any[] = [];

            // TODO: Only select spaces within distance of the current map view?
            sortedAreasWithDistance.some((area: any, index: number) => {
                // Prevent loading spaces from too far away to be relevant
                // Stop after 200 miles
                if (index >= 10 && area.distanceFromUser && area.distanceFromUser > 200) {
                    return true;
                }

                if (area.mediaIds?.length && !area?.media?.length) {
                    const areaMediaIds = area.mediaIds.split(",");
                    if (!content?.media[areaMediaIds[0]]) {
                        missingMediaIds.push(...area.mediaIds.split(","));
                    }
                }
                const readableDistance = area.distanceFromUser < 0.1
                    ? `${Math.round(area.distanceFromUser * 5280)} ft`
                    : `${Math.round(10 * area.distanceFromUser) / 10} mi`;
                area.distance = readableDistance;

                if (pressedAreaId && area.id === pressedAreaId) {
                    pressedAreas.push(area);
                } else if (area.featuredIncentiveRewardKey) {
                    featuredAreas.push(area);
                } else {
                    areasArray.push(area);
                }

                // Prevent loading too many areas in preview
                return index >= 99;
            });

            modifiedAreasInPreview = pressedAreas.concat(featuredAreas).concat(areasArray);
            if (missingMediaIds.length) {
                this.fetchMissingMedia(missingMediaIds).catch((err) => {
                    console.log(err);
                });
            }
            if (modifiedAreasInPreview?.length > 0) {
                this.props.onPreviewBottomSheetOpen();
            }
        } else {
            this.props.onPreviewBottomSheetClose();
            // Reset to zero to review marker highlight
            this.removeAnimation();
            this.addAnimationListener();
        }

        this.setState({
            areasInPreview: modifiedAreasInPreview,
            isPreviewBottomSheetVisible: modifiedAreasInPreview?.length < 1 ? false : !isPreviewBottomSheetVisible,
        });
    };

    isAreaActivated = (type: IAreaType, area) => {
        const { reactions, user } = this.props;

        if (isMyContent(area, user)) {
            return true;
        }

        if (type === 'moments') {
            return !!reactions.myMomentReactions[area.id];
        }

        return !!reactions.mySpaceReactions[area.id];
    };

    onUserLocationChange = (event) => {
        const {
            lastLocationSendForProcessing,
            lastLocationSendForProcessingCoords,
        } = this.state;
        const {
            map,
            shouldFollowUserLocation,
            updateUserCoordinates,
            updateCircleCenter,
        } = this.props;
        const coords = {
            latitude: event.nativeEvent.coordinate.latitude,
            longitude: event.nativeEvent.coordinate.longitude,
        };
        // TODO: Add throttle
        updateUserCoordinates(coords);
        updateCircleCenter(coords);

        if (shouldFollowUserLocation) {
            const loc = {
                latitude: coords.latitude,
                longitude: coords.longitude,
                latitudeDelta: PRIMARY_LATITUDE_DELTA,
                longitudeDelta: PRIMARY_LONGITUDE_DELTA,
            };
            this.props.animateToWithHelp(() => this.mapViewRef && this.mapViewRef.animateToRegion(loc, ANIMATE_TO_REGION_DURATION_FAST));
        }


        if (!map.hasUserLocationLoaded) {
            return;
        }

        if (lastLocationSendForProcessing) {
            if (Date.now() - lastLocationSendForProcessing <= LOCATION_PROCESSING_THROTTLE_MS) {
                return;
            }

            if (lastLocationSendForProcessingCoords) {
                const timeOfTravel = Date.now() - lastLocationSendForProcessing;
                const distanceTraveledMeters = distanceTo({
                    lon: coords.longitude,
                    lat: coords.latitude,
                }, {
                    lon: lastLocationSendForProcessingCoords.longitude,
                    lat: lastLocationSendForProcessingCoords.latitude,
                });
                const kmPerHour = distanceTraveledMeters / (timeOfTravel * 60 * 60);

                if (distanceTraveledMeters < 5) {
                    return;
                }

                if (kmPerHour > 15) { // Don't send location until user slows down to a walking pace
                    return;
                }
            }
        }

        // Send location to backend for processing
        PushNotificationsService.postLocationChange({
            longitude: coords.longitude,
            latitude: coords.latitude,
            lastLocationSendForProcessing,
            radiusOfAwareness: map.radiusOfAwareness,
            radiusOfInfluence: map.radiusOfInfluence,
        });

        this.setState({
            lastLocationSendForProcessing: Date.now(),
            lastLocationSendForProcessingCoords: {
                longitude: coords.longitude,
                latitude: coords.latitude,
            },
        });
    };

    onClusterPress = (/* cluster, markers */) => {
        // if (Platform.OS === 'android') {
        // }
    };

    fetchMissingMedia = (mediaIds: string[]) => {
        const { fetchMedia } = this.props;
        return fetchMedia(mediaIds);
    };

    getMomentCircleFillColor = (moment) => {
        const { user } = this.props;
        const { activeMoment } = this.state;

        if (isMyContent(moment, user)) {
            if (moment.id === activeMoment.id) {
                return this.theme.colors.map.myMomentsCircleFillActive;
            }

            return this.theme.colors.map.myMomentsCircleFill;
        }

        if (this.isAreaActivated('moments', moment)) {
            return this.theme.colors.map.momentsCircleFill;
        }

        // Not yet activated/discovered
        return this.theme.colors.map.undiscoveredMomentsCircleFill;
    };

    getSpaceCircleFillColor = (space) => {
        const { user } = this.props;
        const { activeSpace } = this.state;

        if (isMyContent(space, user)) {
            if (space.id === activeSpace.id) {
                return this.theme.colors.map.mySpacesCircleFillActive;
            }

            return this.theme.colors.map.mySpacesCircleFill;
        }

        if (this.isAreaActivated('spaces', space)) {
            return this.theme.colors.map.spacesCircleFill;
        }

        // Not yet activated/discovered
        return this.theme.colors.map.undiscoveredSpacesCircleFill;
    };

    getMomentCircleStrokeColor = (moment) => {
        const { user } = this.props;

        if (isMyContent(moment, user)) {
            return this.theme.colors.map.myMomentsCircleStroke;
        }

        if (this.isAreaActivated('moments', moment)) {
            return this.theme.colors.map.momentsCircleStroke;
        }

        // Not yet activated/discovered
        return this.theme.colors.map.undiscoveredMomentsCircleStroke;
    };

    getSpaceCircleStrokeColor = (space) => {
        const { user } = this.props;

        if (isMyContent(space, user)) {
            return this.theme.colors.map.mySpacesCircleStroke;
        }

        if (this.isAreaActivated('spaces', space)) {
            return this.theme.colors.map.spacesCircleStroke;
        }

        // Not yet activated/discovered
        return this.theme.colors.map.undiscoveredSpacesCircleStroke;
    };

    getLatitudeDelta = () => {
        const { map, route } = this.props;
        if (route.params?.latitude) {
            return SECONDARY_LATITUDE_DELTA;
        }
        return map.hasUserLocationLoaded ? PRIMARY_LATITUDE_DELTA : INITIAL_LATITUDE_DELTA;
    };

    getLongitudeDelta = () => {
        const { map, route } = this.props;
        if (route.params?.longitude) {
            return SECONDARY_LONGITUDE_DELTA;
        }
        return map.hasUserLocationLoaded ? PRIMARY_LONGITUDE_DELTA : INITIAL_LONGITUDE_DELTA;
    };

    goToArea = (area: any) => {
        const { navigation, user } = this.props;

        // TODO: Should handle space or moment
        // TODO: Activate spaces on click
        this.getAreaDetails(area)
            .then((details) => {
                navigation.navigate('ViewSpace', {
                    isMyContent: isMyContent(area, user),
                    space: area,
                    spaceDetails: details,
                });
            })
            .catch(() => {
                // TODO: Add error handling
                console.log('Failed to get space details!');
            });
    };

    updateOuterMapRef = (ref: Ref<MapView>) => {
        this.props.mapRef(ref);
    };

    onMapLayout = () => {
        this.setState({ isMapReady: true });
        this.props.onMapLayout();
    };

    render() {
        const {
            circleCenter,
            content,
            filteredMoments,
            filteredSpaces,
            isScrollEnabled,
            shouldFollowUserLocation,
            shouldRenderMapCircles,
        } = this.props;
        const { areasInPreview, isPreviewBottomSheetVisible, isMapReady } = this.state;

        return (
            <>
                <MapView
                    mapRef={(ref: Ref<MapView>) => { this.updateOuterMapRef(ref); this.mapViewRef = ref; }}
                    provider={PROVIDER_GOOGLE}
                    style={mapStyles.mapView}
                    customMapStyle={mapCustomStyle}
                    initialRegion={{
                        latitude: circleCenter.latitude,
                        longitude: circleCenter.longitude,
                        latitudeDelta: this.getLatitudeDelta(),
                        longitudeDelta: this.getLongitudeDelta(),
                    }}
                    onPress={this.handleMapPress}
                    onRegionChange={this.props.onRegionChange}
                    onRegionChangeComplete={this.props.onRegionChangeComplete}
                    onUserLocationChange={this.onUserLocationChange}
                    showsUserLocation={true}
                    showsBuildings={true}
                    showsMyLocationButton={false}
                    showsCompass={false}
                    followsUserLocation={shouldFollowUserLocation}
                    scrollEnabled={isScrollEnabled}
                    minZoomLevel={MIN_ZOOM_LEVEL}
                    /* react-native-map-clustering */
                    clusterColor={this.theme.colors.brandingBlueGreen}
                    clusterFontFamily={this.theme.styles.headerTitleStyle.fontFamily}
                    clusterTextColor={this.theme.colors.brandingWhite}
                    onClusterPress={this.onClusterPress}
                    onLayout={this.onMapLayout}
                    // preserveClusterPressBehavior={true}
                    animationEnabled={false} // iOS Only
                    spiderLineColor="#FF0000"
                >
                    {
                        isMapReady &&
                        <Circle
                            center={circleCenter}
                            radius={DEFAULT_MOMENT_PROXIMITY} /* meters */
                            strokeWidth={1}
                            strokeColor={this.theme.colors.secondary}
                            fillColor={this.theme.colors.map.userCircleFill}
                            zIndex={0}
                        />
                    }
                    {
                        isMapReady && Object.values(filteredMoments).map((moment: any) => {
                            return (
                                <Marker
                                    anchor={{
                                        x: 0.5,
                                        y: 0.5,
                                    }}
                                    key={moment.id}
                                    coordinate={{
                                        longitude: moment.longitude,
                                        latitude: moment.latitude,
                                    }}
                                    onPress={this.handleMapPress}
                                    stopPropagation={true}
                                    tracksViewChanges={false} // Note: Supposedly affects performance but not sure the implications
                                >
                                    <View style={{ /* transform: [{ translateY: 0 }] */ }}>
                                        <MarkerIcon area={moment} areaType="moments" theme={this.theme} />
                                    </View>
                                </Marker>
                            );
                        })
                    }
                    {
                        isMapReady && areasInPreview.map((space: any, index) => {
                            const inputRange = [
                                (index - 1) * CARD_WIDTH,
                                index * CARD_WIDTH,
                                (index + 1) * CARD_WIDTH,
                            ];
                            const scale = this.previewAnimation.interpolate({
                                inputRange,
                                outputRange: [1, MAX_CIRCLE_DIAMETER_SCALE, 1],
                                extrapolate: 'clamp',
                            });
                            const opacity = this.previewAnimation.interpolate({
                                inputRange,
                                outputRange: [0.35, 1, 0.35],
                                extrapolate: 'clamp',
                            });
                            const scaleStyle = {
                                transform: [
                                    {
                                        scale: scale || 1,
                                    },
                                ],
                            };
                            const opacityStyle = {
                                opacity: opacity || 0.35,
                            };

                            return (
                                <Marker
                                    anchor={{
                                        x: 0.5,
                                        y: 0.5,
                                    }}
                                    key={space.id}
                                    coordinate={{
                                        longitude: space.longitude,
                                        latitude: space.latitude,
                                    }}
                                    onPress={this.handleMapPress}
                                    stopPropagation={true}
                                    tracksViewChanges={true} // Note: Supposedly affects performance but not sure the implications
                                >
                                    <Animated.View style={[{
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        /* transform: [{ translateY: 0 }] */
                                        width: (spaceBubbleWidth * MAX_CIRCLE_DIAMETER_SCALE),
                                        height: (spaceBubbleWidth * MAX_CIRCLE_DIAMETER_SCALE),
                                    }, opacityStyle]}>
                                        <Animated.View style={[{
                                            width: spaceBubbleWidth,
                                            height: spaceBubbleWidth,
                                            borderRadius: spaceBubbleWidth / 2,
                                            backgroundColor: 'rgba(170,10,170, 0.3)',
                                            position: 'absolute',
                                            borderWidth: 1,
                                            borderColor: 'rgba(170,10,170, 0.5)',
                                        }, scaleStyle]} />
                                        <MarkerIcon area={space} areaType="spaces" theme={this.theme} />
                                    </Animated.View>
                                </Marker>
                            );
                        })
                    }
                    {
                        isMapReady && Object.values(filteredMoments).map((moment: any) => {
                            if (!shouldRenderMapCircles) {
                                return null;
                            }
                            return (
                                <Circle
                                    key={moment.id}
                                    center={{
                                        longitude: moment.longitude,
                                        latitude: moment.latitude,
                                    }}
                                    radius={moment.radius} /* meters */
                                    strokeWidth={0}
                                    strokeColor={this.getMomentCircleStrokeColor(moment)}
                                    fillColor={this.getMomentCircleFillColor(moment)}
                                    zIndex={1}
                                />
                            );
                        })
                    }
                    {
                        isMapReady && Object.values(filteredSpaces).map((space: any) => {
                            if (!shouldRenderMapCircles) {
                                return null;
                            }
                            return (
                                <Circle
                                    key={space.id}
                                    center={{
                                        longitude: space.longitude,
                                        latitude: space.latitude,
                                    }}
                                    radius={space.radius} /* meters */
                                    strokeWidth={0}
                                    strokeColor={this.getSpaceCircleStrokeColor(space)}
                                    fillColor={this.getSpaceCircleFillColor(space)}
                                    zIndex={1}
                                />
                            );
                        })
                    }
                </MapView>
                {
                    isPreviewBottomSheetVisible &&
                    <View style={this.themeBottomSheet.styles.scrollViewOuterContainer}>
                        <Animated.ScrollView
                            horizontal
                            scrollEventThrottle={20}
                            showsHorizontalScrollIndicator={false}
                            snapToInterval={CARD_WIDTH}
                            onScroll={Animated.event(
                                [
                                    {
                                        nativeEvent: {
                                            contentOffset: {
                                                x: this.previewAnimation,
                                            },
                                        },
                                    },
                                ],
                                {
                                    useNativeDriver: true,
                                }
                            )}
                            style={[
                                this.themeBottomSheet.styles.scrollView,
                                {
                                    backgroundColor: 'transparent',
                                },
                            ]}
                            contentContainerStyle={[this.themeBottomSheet.styles.scrollViewContainer, {
                                paddingRight: viewPortWidth - CARD_WIDTH,
                            }]}
                        // snapToAlignment="start"
                        >
                            {
                                areasInPreview.map((area) => {
                                    const formattedDate = formatDate(area.createdAt);
                                    const mediaIdsSplit = (area.mediaIds || '').split(',');
                                    const areaMedia = content.media
                                        && (content.media[area.media && area.media[0]?.id] || content.media[mediaIdsSplit && mediaIdsSplit[0]]);
                                    return (
                                        <AreaDisplayCard
                                            area={area}
                                            areaMedia={areaMedia}
                                            cardWidth={CARD_WIDTH}
                                            date={formattedDate}
                                            isDarkMode={false}
                                            key={area.id}
                                            onPress={this.goToArea}
                                            theme={this.theme}
                                            themeViewArea={this.themeViewArea}
                                            translate={this.translate}
                                        />
                                    );
                                })
                            }
                        </Animated.ScrollView>
                    </View>
                }
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(TherrMapView);
