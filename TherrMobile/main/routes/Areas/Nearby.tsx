import React from 'react';
import { Keyboard, PermissionsAndroid, Platform, SafeAreaView, Text, View } from 'react-native';
import { Button, Slider } from 'react-native-elements';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import LottieView from 'lottie-react-native';
import { ContentActions, MapActions } from 'therr-react/redux/actions';
import { IContentState, IMapState, IUserState, IUserConnectionsState } from 'therr-react/types';
import { PushNotificationsService } from 'therr-react/services';
import { Location } from 'therr-js-utilities/constants';
// import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import Geolocation from 'react-native-geolocation-service';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import { buildStyles as buildDisclosureStyles } from '../../styles/modal/locationDisclosure';
import { buildStyles as buildLoaderStyles } from '../../styles/loaders';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildMomentStyles } from '../../styles/user-content/areas';
import { buildStyles as buildReactionsModalStyles } from '../../styles/modal/areaReactionsModal';
import { buildStyles as buildFormStyles } from '../../styles/forms';
// import { buttonMenuHeightCompact } from '../../styles/navigation/buttonMenu';
import translator from '../../services/translator';
import AreaCarousel from './AreaCarousel';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import BaseStatusBar from '../../components/BaseStatusBar';
import AreaOptionsModal, { ISelectionType } from '../../components/Modals/AreaOptionsModal';
import { getReactionUpdateArgs } from '../../utilities/reactions';
import LottieLoader, { ILottieId } from '../../components/LottieLoader';
import getActiveCarouselData from '../../utilities/getActiveCarouselData';
import { CAROUSEL_TABS } from '../../constants';
import { handleAreaReaction, loadMoreAreas, navToViewArea } from './areaViewHelpers';
import requestLocationServiceActivation from '../../utilities/requestLocationServiceActivation';
import { checkAndroidPermission, isLocationPermissionGranted, requestOSMapPermissions } from '../../utilities/requestOSPermissions';
import LocationActions from '../../redux/actions/LocationActions';
import { ILocationState } from '../../types/redux/location';
import earthLoader from '../../assets/earth-loader.json';
import LocationUseDisclosureModal from '../../components/Modals/LocationUseDisclosureModal';

function getRandomLoaderId(): ILottieId {
    const options: ILottieId[] = ['donut', 'earth', 'taco', 'shopping', 'happy-swing', 'karaoke', 'yellow-car', 'zeppelin', 'therr-black-rolling'];
    const selected = Math.floor(Math.random() * options.length);
    return options[selected] as ILottieId;
}

interface INearbyDispatchProps {
    updateUserRadius: Function;

    searchActiveMoments: Function;
    updateActiveMoments: Function;
    createOrUpdateMomentReaction: Function;

    searchActiveSpaces: Function;
    updateActiveSpaces: Function;
    createOrUpdateSpaceReaction: Function;

    updateGpsStatus: Function;
    updateLocationDisclosure: Function;
    updateLocationPermissions: Function;

    logout: Function;
}

interface IStoreProps extends INearbyDispatchProps {
    content: IContentState;
    location: ILocationState;
    map: IMapState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface INearbyProps extends IStoreProps {
    navigation: any;
}

interface INearbyState {
    activeTab: string;
    isFirstLoad: boolean;
    isLoading: boolean;
    isLocationUseDisclosureModalVisible: boolean;
    areAreaOptionsVisible: boolean;
    selectedArea: any;
}

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
            updateUserRadius: MapActions.updateUserRadius,

            searchActiveMoments: ContentActions.searchActiveMoments,
            updateActiveMoments: ContentActions.updateActiveMoments,
            createOrUpdateMomentReaction: ContentActions.createOrUpdateMomentReaction,

            searchActiveSpaces: ContentActions.searchActiveSpaces,
            updateActiveSpaces: ContentActions.updateActiveSpaces,
            createOrUpdateSpaceReaction: ContentActions.createOrUpdateSpaceReaction,

            updateGpsStatus: LocationActions.updateGpsStatus,
            updateLocationDisclosure: LocationActions.updateLocationDisclosure,
            updateLocationPermissions: LocationActions.updateLocationPermissions,
        },
        dispatch
    );

class Nearby extends React.Component<INearbyProps, INearbyState> {
    private carouselRef;
    private translate: Function;
    private loaderId: ILottieId;
    private loadTimeoutId: any;
    private locationListener: any;
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

    constructor(props) {
        super(props);

        this.state = {
            activeTab: CAROUSEL_TABS.SOCIAL,
            isFirstLoad: true,
            isLoading: true,
            isLocationUseDisclosureModalVisible: false,
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
        const { activeTab, isFirstLoad } = this.state;
        const { content, navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.nearby.headerTitle'),
        });

        const activeData = getActiveCarouselData({
            activeTab,
            content,
            isForBookmarks: false,
        });

        if (isFirstLoad || !activeData?.length || activeData.length < 21) {
            this.handleRefresh();
        } else {
            this.setState({
                isLoading: false,
            });
        }

        this.unsubscribeNavigationListener = navigation.addListener('focus', () => {
            const data = getActiveCarouselData({
                activeTab,
                content,
                isForBookmarks: false,
            });
            if (isFirstLoad || !data?.length || data.length < 21) {
                this.handleRefresh();
            } else {
                this.setState({
                    isLoading: false,
                });
            }
        });
    }

    componentWillUnmount() {
        this.unsubscribeNavigationListener();
        if (this.locationListener) {
            this.locationListener();
        }
        clearTimeout(this.loadTimeoutId);
        Geolocation.clearWatch(this.mapWatchId);
        Geolocation.stopObserving();
    }

    getEmptyListMessage = () => this.translate('pages.areas.noNearbyAreasFound');

    shouldRenderNearbyNewsfeed = () => {
        const { location } = this.props;

        return location?.settings.isGpsEnabled
            && location?.settings?.isLocationDislosureComplete
            && isLocationPermissionGranted(location?.permissions);
    }

    goToMap = () => {
        const { navigation } = this.props;
        navigation.navigate('Map');
    }

    goToArea = (area) => {
        const { navigation, user } = this.props;

        navToViewArea(area, user, navigation.navigate);
    };

    goToViewMap = (lat, long) => {
        const { navigation } = this.props;

        navigation.replace('Map', {
            latitude: lat,
            longitude: long,
        });
    }

    goToViewUser = (userId) => {
        const { navigation } = this.props;

        navigation.navigate('ViewUser', {
            userInView: {
                id: userId,
            },
        });
    }

    handleRefresh = () => {
        const { content, map, updateActiveMoments, updateActiveSpaces, user } = this.props;
        const { activeTab } = this.state;

        const activeMomentsPromise = updateActiveMoments({
            userLatitude: map.latitude,
            userLongitude: map.longitude,
            withMedia: true,
            withUser: true,
            offset: 0,
            ...content.activeAreasFilters,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        });

        const activeSpacesPromise = updateActiveSpaces({
            userLatitude: map.latitude,
            userLongitude: map.longitude,
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
                });
                const hasFoundContent = data.length;
                this.setState({ isFirstLoad: !hasFoundContent });
            })
            .finally(() => {
                this.loadTimeoutId = setTimeout(() => {
                    this.setState({ isLoading: false });
                }, 400);
            });
    }

    tryLoadMore = () => {
        const { content, map, searchActiveMoments, searchActiveSpaces, user } = this.props;

        loadMoreAreas({
            content,
            map,
            user,
            searchActiveMoments,
            searchActiveSpaces,
        });
    }

    onAreaOptionSelect = (type: ISelectionType) => {
        const { selectedArea } = this.state;
        const { createOrUpdateSpaceReaction, createOrUpdateMomentReaction, user } = this.props;

        handleAreaReaction(selectedArea, type, {
            user,
            getReactionUpdateArgs,
            createOrUpdateMomentReaction,
            createOrUpdateSpaceReaction,
            toggleAreaOptions: this.toggleAreaOptions,
        });
    }

    onTabSelect = (tabName: string) => {
        this.setState({
            activeTab: tabName,
        });
    }

    scrollTop = () => {
        this.carouselRef?.scrollToOffset({ animated: true, offset: 0 });
    }

    toggleAreaOptions = (area) => {
        const { areAreaOptionsVisible } = this.state;
        this.setState({
            areAreaOptionsVisible: !areAreaOptionsVisible,
            selectedArea: areAreaOptionsVisible ? {} : area,
        });
    }

    onSliderAwarenessChange = (value) => {
        const { map, updateUserRadius } = this.props;

        updateUserRadius({
            radiusOfAwareness: value || map.radiusOfAwareness,
            radiusOfInfluence: map.radiusOfInfluence,
        });
    }

    onSliderInfluenceChange = (value) => {
        const { map, updateUserRadius } = this.props;

        updateUserRadius({
            radiusOfAwareness: map.radiusOfAwareness,
            radiusOfInfluence: value || map.radiusOfInfluence,
        });
    }

    positionSuccessCallback = (position) => {
        const { map } = this.props;
        // TODO: Throttle to prevent too many requests
        PushNotificationsService.postLocationChange({
            longitude: position.coords.longitude,
            latitude: position.coords.latitude,
            // lastLocationSendForProcessing,
            radiusOfAwareness: map.radiusOfAwareness,
            radiusOfInfluence: map.radiusOfInfluence,
        });
    };

    positionErrorCallback = (error) => {
        console.log('geolocation error', error.code);
    }

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
    }

    handleLocationDisclosureSelect = (/* selection */) => {
        const { updateLocationDisclosure } = this.props;
        // TODO: Decide if selection should be dynamic
        updateLocationDisclosure(true).then(() => {
            this.toggleLocationUseDisclosure();
            this.handleEnableLocationPress();
        });
    }

    toggleLocationUseDisclosure = () => {
        const { isLocationUseDisclosureModalVisible } = this.state;
        this.setState({
            isLocationUseDisclosureModalVisible: !isLocationUseDisclosureModalVisible,
        });
    }


    renderHeader = () => {
        const { radiusOfAwareness, radiusOfInfluence } = this.props.map;

        return (
            <View style={this.themeMoments.styles.areaCarouselHeaderSliders}>
                <View style={this.themeForms.styles.inputSliderContainerTight}>
                    <Text style={this.themeForms.styles.inputLabelDark}>
                        {`${this.translate('forms.nearbyForm.labels.radiusOfAwareness', { meters: radiusOfAwareness })}`}
                    </Text>
                    <Slider
                        value={radiusOfAwareness}
                        onValueChange={(value) => this.onSliderAwarenessChange(value)}
                        maximumValue={Location.MAX_RADIUS_OF_AWARENESS}
                        minimumValue={Location.MIN_RADIUS_OF_AWARENESS}
                        step={1}
                        thumbStyle={{ backgroundColor: this.theme.colors.accentBlue, height: 20, width: 20 }}
                        thumbTouchSize={{ width: 30, height: 30 }}
                        minimumTrackTintColor={this.theme.colorVariations.accentBlueLightFade}
                        maximumTrackTintColor={this.theme.colorVariations.accentBlueHeavyFade}
                        onSlidingStart={Keyboard.dismiss}
                    />
                </View>
                <View style={this.themeForms.styles.inputSliderContainerTight}>
                    <Text style={this.themeForms.styles.inputLabelDark}>
                        {`${this.translate('forms.nearbyForm.labels.radiusOfInfluence', { meters: radiusOfInfluence })}`}
                    </Text>
                    <Slider
                        value={radiusOfInfluence}
                        onValueChange={(value) => this.onSliderInfluenceChange(value)}
                        maximumValue={Location.MAX_RADIUS_OF_INFLUENCE}
                        minimumValue={Location.MIN_RADIUS_OF_INFLUENCE}
                        step={1}
                        thumbStyle={{ backgroundColor: this.theme.colors.brandingOrange, height: 20, width: 20 }}
                        thumbTouchSize={{ width: 30, height: 30 }}
                        minimumTrackTintColor={this.theme.colorVariations.accent1LightFade}
                        maximumTrackTintColor={this.theme.colorVariations.accent1HeavyFade}
                        onSlidingStart={Keyboard.dismiss}
                    />
                </View>
            </View>
        );
    }

    renderGpsEnableButton = () => {
        return (
            <KeyboardAwareScrollView
                contentInsetAdjustmentBehavior="automatic"
                style={this.theme.styles.bodyFlex}
                contentContainerStyle={this.theme.styles.bodyScroll}
            >
                <View style={this.theme.styles.sectionContainer}>
                    <View style={{ flex: 1, height: 100, marginBottom: 30 }}>
                        <LottieView
                            source={earthLoader}
                            // resizeMode="cover"
                            speed={1}
                            autoPlay
                            loop
                        />
                    </View>
                    <Text style={this.theme.styles.sectionTitleCenter}>
                        {this.translate('pages.nearby.headerTitle')}
                    </Text>
                    <Text style={this.theme.styles.sectionDescriptionCentered}>
                        {this.translate('pages.nearby.locationDescription1')}
                    </Text>
                    <Text style={this.theme.styles.sectionDescriptionCentered}>
                        {this.translate('pages.nearby.locationDescription2')}
                    </Text>
                    <Text style={this.theme.styles.sectionDescriptionCentered}>
                        {this.translate('pages.nearby.locationDescription3')}
                    </Text>
                    <Text style={[this.theme.styles.sectionDescriptionCentered, { marginBottom: 40 }]} />
                    <Button
                        buttonStyle={this.themeForms.styles.button}
                        titleStyle={this.themeForms.styles.buttonTitle}
                        disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                        disabledStyle={this.themeForms.styles.buttonDisabled}
                        title={this.translate(
                            'forms.nearbyForm.buttons.enableLocation'
                        )}
                        onPress={() => this.handleEnableLocationPress()}
                        iconRight
                    />
                </View>
            </KeyboardAwareScrollView>
        );
    }

    render() {
        const { activeTab, areAreaOptionsVisible, isLocationUseDisclosureModalVisible, isLoading, selectedArea } = this.state;
        const { createOrUpdateMomentReaction, createOrUpdateSpaceReaction, content, navigation, user } = this.props;

        // TODO: Fetch missing media
        const fetchMedia = () => {};

        const activeData = isLoading ? [] : getActiveCarouselData({
            activeTab,
            content,
            isForBookmarks: false,
            isForDrafts: false,
        }, 'distance');

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView style={[this.theme.styles.safeAreaView, { backgroundColor: this.theme.colorVariations.backgroundNeutral }]}>
                    {
                        this.shouldRenderNearbyNewsfeed() &&
                            <AreaCarousel
                                activeData={activeData}
                                content={content}
                                fetchMedia={fetchMedia}
                                inspectArea={this.goToArea}
                                goToViewMap={this.goToViewMap}
                                goToViewUser={this.goToViewUser}
                                toggleAreaOptions={this.toggleAreaOptions}
                                translate={this.translate}
                                containerRef={(component) => this.carouselRef = component}
                                handleRefresh={this.handleRefresh}
                                isLoading={isLoading}
                                onEndReached={this.tryLoadMore}
                                updateMomentReaction={createOrUpdateMomentReaction}
                                updateSpaceReaction={createOrUpdateSpaceReaction}
                                emptyListMessage={this.getEmptyListMessage()}
                                renderHeader={this.renderHeader}
                                renderLoader={() => <LottieLoader id={this.loaderId} theme={this.themeLoader} />}
                                user={user}
                                rootStyles={this.theme.styles}
                                // viewportHeight={viewportHeight}
                                // viewportWidth={viewportWidth}
                            />
                    }
                    {
                        !this.shouldRenderNearbyNewsfeed() && this.renderGpsEnableButton()
                    }
                </SafeAreaView>
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
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={this.scrollTop}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Nearby);
