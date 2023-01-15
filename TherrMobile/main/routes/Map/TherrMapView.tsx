import React, { Ref } from 'react';
import { View } from 'react-native';
import MapView from 'react-native-map-clustering';
import { PROVIDER_GOOGLE, Circle, Marker } from 'react-native-maps';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { PushNotificationsService } from 'therr-react/services';
import { IAreaType, ITherrMapViewState as ITherrMapViewReduxState, INotificationsState, IReactionsState, IUserState } from 'therr-react/types';
import { MapActions, ReactionActions } from 'therr-react/redux/actions';
import { distanceTo, insideCircle } from 'geolocation-utils';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { ILocationState } from '../../types/redux/location';
import translator from '../../services/translator';
import {
    ANIMATE_TO_REGION_DURATION_FAST,
    INITIAL_LATITUDE_DELTA,
    INITIAL_LONGITUDE_DELTA,
    PRIMARY_LATITUDE_DELTA,
    PRIMARY_LONGITUDE_DELTA,
    DEFAULT_MOMENT_PROXIMITY,
    MIN_ZOOM_LEVEL,
    LOCATION_PROCESSING_THROTTLE_MS,
    SECONDARY_LATITUDE_DELTA,
    SECONDARY_LONGITUDE_DELTA,
} from '../../constants';
import { buildStyles } from '../../styles';
import mapStyles from '../../styles/map';
import mapCustomStyle from '../../styles/map/googleCustom';
import MarkerIcon from './MarkerIcon';
import { isMyContent } from '../../utilities/content';

const hapticFeedbackOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
};


interface ITherrMapViewDispatchProps {
    createOrUpdateMomentReaction: Function;
    createOrUpdateSpaceReaction: Function;
    updateCoordinates: Function;
    setSearchDropdownVisibility: Function;
}

interface IStoreProps extends ITherrMapViewDispatchProps {
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
    animateToWithHelp: (doAnimate: any) => any;
    circleCenter: {longitude: number, latitude: number};
    expandBottomSheet: any;
    filteredMoments: any;
    filteredSpaces: any;
    hideCreateActions: () => any;
    isScrollEnabled: boolean;
    mapRef: any;
    navigation: any;
    route: any;
    showAreaAlert: () => any;
    shouldFollowUserLocation: boolean;
    shouldRenderMapCircles: boolean;
    updateCircleCenter: (center: {longitude: number, latitude: number}) => any;
}

interface ITherrMapViewState {
    activeMoment: any;
    activeMomentDetails: any;
    activeSpace: any;
    activeSpaceDetails: any;
    lastLocationSendForProcessing?: number,
    lastLocationSendForProcessingCoords?: {
        longitude: number,
        latitude: number,
    },
}

const mapStateToProps = (state: any) => ({
    location: state.location,
    map: state.map,
    notifications: state.notifications,
    reactions: state.reactions,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            updateCoordinates: MapActions.updateCoordinates,
            setSearchDropdownVisibility: MapActions.setSearchDropdownVisibility,
            createOrUpdateMomentReaction: ReactionActions.createOrUpdateMomentReaction,
            createOrUpdateSpaceReaction: ReactionActions.createOrUpdateSpaceReaction,
        },
        dispatch
    );

class TherrMapView extends React.Component<ITherrMapViewProps, ITherrMapViewState> {
    private localeShort = 'en-US'; // TODO: Derive from user locale
    private mapViewRef: any;
    private theme = buildStyles();
    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {
            activeMoment: {},
            activeMomentDetails: {},
            activeSpace: {},
            activeSpaceDetails: {},
        };

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount = () => {};

    componentWillUnmount() {}

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
    handleMapPress = ({ nativeEvent }) => {
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

        const pressedSpaces = filteredSpaces.filter((space) => {
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

            // this.props.expandBottomSheet();

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
                                // TODO: Consider requiring location to view an area
                                navigation.navigate('ViewSpace', {
                                    isMyContent: isMyContent(selectedSpace, user),
                                    space: selectedSpace,
                                    spaceDetails: details,
                                });
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

            const pressedMoments = filteredMoments.filter((moment) => {
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
                this.props.expandBottomSheet(0, true);
                this.setState({
                    activeMoment: {},
                    activeMomentDetails: {},
                });
            }
        }
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
    }

    onUserLocationChange = (event) => {
        const {
            lastLocationSendForProcessing,
            lastLocationSendForProcessingCoords,
        } = this.state;
        const {
            map,
            shouldFollowUserLocation,
            updateCoordinates,
            updateCircleCenter,
        } = this.props;
        const coords = {
            latitude: event.nativeEvent.coordinate.latitude,
            longitude: event.nativeEvent.coordinate.longitude,
        };
        // TODO: Add throttle
        updateCoordinates(coords);
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
    }

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
    }

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
    }

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
    }

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
    }

    render() {
        const {
            circleCenter,
            filteredMoments,
            filteredSpaces,
            isScrollEnabled,
            map,
            route,
            shouldFollowUserLocation,
            shouldRenderMapCircles,
        } = this.props;
        const getLatitudeDelta = () => {
            if (route.params?.latitude) {
                return SECONDARY_LATITUDE_DELTA;
            }
            return map.hasUserLocationLoaded ? PRIMARY_LATITUDE_DELTA : INITIAL_LATITUDE_DELTA;
        };
        const getLongitudeDelta = () => {
            if (route.params?.longitude) {
                return SECONDARY_LONGITUDE_DELTA;
            }
            return map.hasUserLocationLoaded ? PRIMARY_LONGITUDE_DELTA : INITIAL_LONGITUDE_DELTA;
        };

        return (
            <MapView
                mapRef={(ref: Ref<MapView>) => { this.props.mapRef(ref); this.mapViewRef = ref; }}
                provider={PROVIDER_GOOGLE}
                style={mapStyles.mapView}
                customMapStyle={mapCustomStyle}
                initialRegion={{
                    latitude: circleCenter.latitude,
                    longitude: circleCenter.longitude,
                    latitudeDelta: getLatitudeDelta(),
                    longitudeDelta: getLongitudeDelta(),
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
                // preserveClusterPressBehavior={true}
                animationEnabled={false} // iOS Only
                spiderLineColor="#FF0000"
            >
                <Circle
                    center={circleCenter}
                    radius={DEFAULT_MOMENT_PROXIMITY} /* meters */
                    strokeWidth={1}
                    strokeColor={this.theme.colors.secondary}
                    fillColor={this.theme.colors.map.userCircleFill}
                    zIndex={0}
                />
                {
                    filteredMoments.map((moment) => {
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
                    filteredMoments.map((moment) => {
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
                    filteredSpaces.map((space) => {
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
                                tracksViewChanges={false} // Note: Supposedly affects performance but not sure the implications
                            >
                                <View style={{ /* transform: [{ translateY: 0 }] */ }}>
                                    <MarkerIcon area={space} areaType="spaces" theme={this.theme} />
                                </View>
                            </Marker>
                        );
                    })
                }
                {
                    filteredSpaces.map((space) => {
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
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(React.memo(TherrMapView));
