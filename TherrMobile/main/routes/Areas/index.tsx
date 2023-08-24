import React from 'react';
import { Dimensions, Platform, SafeAreaView, View } from 'react-native';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ContentActions } from 'therr-react/redux/actions';
import { IContentState, ILocationState, IMapState, IUserState, IUserConnectionsState } from 'therr-react/types';
import { TabBar, TabView } from 'react-native-tab-view';
import { buildStyles } from '../../styles';
import { buildStyles as buildAreaStyles } from '../../styles/user-content/areas';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import { buildStyles as buildLoaderStyles } from '../../styles/loaders';
import { buildStyles as buildDisclosureStyles } from '../../styles/modal/locationDisclosure';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildReactionsModalStyles } from '../../styles/modal/areaReactionsModal';
// import { buttonMenuHeightCompact } from '../../styles/navigation/buttonMenu';
import translator from '../../services/translator';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import BaseStatusBar from '../../components/BaseStatusBar';
import AreaOptionsModal, { ISelectionType } from '../../components/Modals/AreaOptionsModal';
import LottieLoader, { ILottieId } from '../../components/LottieLoader';
import getActiveCarouselData from '../../utilities/getActiveCarouselData';
import LocationActions from '../../redux/actions/LocationActions';
import { CAROUSEL_TABS } from '../../constants';
import { handleAreaReaction, handleThoughtReaction, loadMorePosts, navToViewContent } from '../../utilities/postViewHelpers';
import getDirections from '../../utilities/getDirections';
import { SELECT_ALL } from '../../utilities/categories';
import LazyPlaceholder from './components/LazyPlaceholder';
import AreaCarousel from './AreaCarousel';
import { Text } from 'react-native-elements';
import ThoughtOptionsModal from '../../components/Modals/ThoughtOptionsModal';
import TherrIcon from '../../components/TherrIcon';
import requestLocationServiceActivation from '../../utilities/requestLocationServiceActivation';
import { isLocationPermissionGranted } from '../../utilities/requestOSPermissions';
import LocationUseDisclosureModal from '../../components/Modals/LocationUseDisclosureModal';

const { width: viewportWidth } = Dimensions.get('window');

const defaultActiveTab = CAROUSEL_TABS.DISCOVERIES;

function getRandomLoaderId(): ILottieId {
    const options: ILottieId[] = ['donut', 'earth', 'taco', 'shopping', 'happy-swing', 'karaoke', 'yellow-car', 'zeppelin', 'therr-black-rolling'];
    const selected = Math.floor(Math.random() * options.length);
    return options[selected] as ILottieId;
}

interface IAreasDispatchProps {
    searchActiveMoments: Function;
    updateActiveMomentsStream: Function;
    createOrUpdateMomentReaction: Function;

    searchActiveSpaces: Function;
    updateActiveSpacesStream: Function;
    createOrUpdateSpaceReaction: Function;

    searchActiveThoughts: Function;
    updateActiveThoughtsStream: Function;
    createOrUpdateThoughtReaction: Function;

    updateLocationDisclosure: Function;
    updateLocationPermissions: Function;
    updateGpsStatus: Function;

    logout: Function;
}

interface IStoreProps extends IAreasDispatchProps {
    content: IContentState;
    location: ILocationState;
    map: IMapState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IAreasProps extends IStoreProps {
    navigation: any;
}

interface IAreasState {
    activeTabIndex: number;
    isLoading: boolean;
    isLocationUseDisclosureModalVisible: boolean;
    areAreaOptionsVisible: boolean;
    areThoughtOptionsVisible: boolean;
    selectedArea: any;
    selectedThought: any;
    tabRoutes: { key: string; title: string }[]
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
            searchActiveMoments: ContentActions.searchActiveMoments,
            updateActiveMomentsStream: ContentActions.updateActiveMomentsStream,
            createOrUpdateMomentReaction: ContentActions.createOrUpdateMomentReaction,

            searchActiveSpaces: ContentActions.searchActiveSpaces,
            updateActiveSpacesStream: ContentActions.updateActiveSpacesStream,
            createOrUpdateSpaceReaction: ContentActions.createOrUpdateSpaceReaction,

            searchActiveThoughts: ContentActions.searchActiveThoughts,
            updateActiveThoughtsStream: ContentActions.updateActiveThoughtsStream,
            createOrUpdateThoughtReaction: ContentActions.createOrUpdateThoughtReaction,

            updateGpsStatus: LocationActions.updateGpsStatus,
            updateLocationDisclosure: LocationActions.updateLocationDisclosure,
            updateLocationPermissions: LocationActions.updateLocationPermissions,
        },
        dispatch
    );

class Areas extends React.Component<IAreasProps, IAreasState> {
    static whyDidYouRender = true;

    private carouselDiscoveriesRef;
    private carouselEventsRef;
    private carouselNewsRef;
    private carouselThoughtsRef;
    private translate: Function;
    private loaderId: ILottieId;
    private loadTimeoutId: any;
    private theme = buildStyles();
    private themeAreas = buildAreaStyles();
    private themeButtons = buildButtonsStyles();
    private themeLoader = buildLoaderStyles();
    private themeDisclosure = buildDisclosureStyles();
    private themeMenu = buildMenuStyles();
    private themeReactionsModal = buildReactionsModalStyles();

    constructor(props) {
        super(props);

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);

        this.state = {
            activeTabIndex: 0,
            isLoading: true,
            isLocationUseDisclosureModalVisible: false,
            areAreaOptionsVisible: false,
            areThoughtOptionsVisible: false,
            selectedArea: {},
            selectedThought: {},
            tabRoutes: [
                { key: CAROUSEL_TABS.DISCOVERIES, title: this.translate('menus.headerTabs.discoveries') },
                { key: CAROUSEL_TABS.THOUGHTS, title: this.translate('menus.headerTabs.thoughts') },
                { key: CAROUSEL_TABS.EVENTS, title: this.translate('menus.headerTabs.events') },
                // { key: CAROUSEL_TABS.NEWS, title: this.translate('menus.headerTabs.news') },
            ],
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeAreas = buildAreaStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
        this.themeLoader = buildLoaderStyles(props.user.settings?.mobileThemeName);
        this.themeDisclosure = buildDisclosureStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeReactionsModal = buildReactionsModalStyles(props.user.settings?.mobileThemeName);
        this.loaderId = getRandomLoaderId();
    }

    componentDidMount() {
        const { content, navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.myDrafts.headerTitle'),
        });

        const activeData = getActiveCarouselData({
            activeTab: defaultActiveTab,
            content,
            isForBookmarks: false,
            shouldIncludeThoughts: true,
            shouldIncludeMoments: true,
            shouldIncludeSpaces: true,
        }, 'createdAt');
        if (!activeData?.length || activeData.length < 21) {
            this.handleRefresh();
        } else {
            this.setState({
                isLoading: false,
            });
        }
    }

    componentWillUnmount() {
        clearTimeout(this.loadTimeoutId);
    }

    getEmptyListMessage = (activeTab) => {
        if (activeTab === CAROUSEL_TABS.DISCOVERIES) {
            return this.translate('pages.areas.noSocialAreasFound');
        }
        if (activeTab === CAROUSEL_TABS.THOUGHTS) {
            return this.translate('pages.areas.noThoughtsFound');
        }

        if (activeTab === CAROUSEL_TABS.NEWS) {
            return this.translate('pages.areas.noNewsAreasFound');
        }

        // CAROUSEL_TABS.EVENTS
        return this.translate('pages.areas.noEventsAreasFound');
    };

    goToMap = () => {
        const { navigation } = this.props;
        navigation.navigate('Map');
    };

    goToContent = (content) => {
        const { navigation, user } = this.props;

        navToViewContent(content, user, navigation.navigate);
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

    handleEditThought = () => {
        const { navigation } = this.props;

        navigation.navigate('EditThought', {});
    };

    handleCreateMoment = () => {
        const { location, navigation, updateLocationDisclosure, updateGpsStatus } = this.props;

        if (!(location?.user?.latitude && location?.user?.longitude)) {
            navigation.navigate('Map', {
                shouldInitiateLocation: true,
            });
            return;
        }

        // NOTE: This logic is re-used in the Map/index.tsx file
        // We may want to find a better way rather than copy/paste to keep things in sync
        requestLocationServiceActivation({
            isGpsEnabled: location?.settings?.isGpsEnabled,
            translate: this.translate,
            shouldIgnoreRequirement: false,
        }).then((response: any) => {
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
        }).then((shouldAbort) => {
            if (shouldAbort) {
                return;
            }

            if (location?.settings?.isGpsEnabled && location?.user?.latitude && location?.user?.longitude) {
                navigation.reset({
                    index: 1,
                    routes: [
                        {
                            name: 'Areas',
                            params: {
                                latitude: location?.user?.latitude,
                                longitude: location?.user?.longitude,
                            },
                        },
                        {
                            name: 'EditMoment',
                            params: {
                                latitude: location?.user?.latitude,
                                longitude: location?.user?.longitude,
                                imageDetails: {},
                                // nearbySpaces,
                                area: {},
                            },
                        },
                    ],
                });
            }
        });
    };

    handleLocationDisclosureSelect = (selection) => {
        const { updateLocationDisclosure } = this.props;
        // TODO: Decide if selection should be dynamic
        console.log(selection);
        updateLocationDisclosure(true).then(() => {
            this.toggleLocationUseDisclosure();
            this.handleCreateMoment();
        });
    };

    handleRefresh = () => {
        const { content, updateActiveMomentsStream, updateActiveSpacesStream, updateActiveThoughtsStream, user } = this.props;
        this.setState({ isLoading: true });

        const activeMomentsPromise = updateActiveMomentsStream({
            withMedia: true,
            withUser: true,
            offset: 0,
            ...content.activeAreasFilters,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        });

        const activeSpacesPromise = updateActiveSpacesStream({
            withMedia: true,
            withUser: true,
            offset: 0,
            ...content.activeAreasFilters,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        });

        const activeThoughtsPromise = updateActiveThoughtsStream({
            withUser: true,
            withReplies: true,
            offset: 0,
            // ...content.activeAreasFilters,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        },);

        return Promise.all([activeMomentsPromise, activeSpacesPromise, activeThoughtsPromise]).finally(() => {
            this.loadTimeoutId = setTimeout(() => {
                this.setState({ isLoading: false });
            }, 400);
        });
    };

    toggleLocationUseDisclosure = () => {
        const { isLocationUseDisclosureModalVisible } = this.state;
        this.setState({
            isLocationUseDisclosureModalVisible: !isLocationUseDisclosureModalVisible,
        });
    };

    // TODO: We don't need to load more areas when scrolling thoughts and vice versa
    tryLoadMore = () => {
        const { content, location, searchActiveMoments, searchActiveSpaces, searchActiveThoughts, user } = this.props;

        loadMorePosts({
            content,
            user,
            location,
            searchActiveMoments,
            searchActiveSpaces,
            searchActiveThoughts,
        });
    };

    onAreaOptionSelect = (type: ISelectionType) => {
        const { selectedArea } = this.state;
        const { createOrUpdateSpaceReaction, createOrUpdateMomentReaction, user } = this.props;

        if (type === 'getDirections') {
            getDirections({
                latitude: selectedArea.latitude,
                longitude: selectedArea.longitude,
                title: selectedArea.notificationMsg,
            });
        } else {
            handleAreaReaction(selectedArea, type, {
                user,
                createOrUpdateMomentReaction,
                createOrUpdateSpaceReaction,
                toggleAreaOptions: this.toggleAreaOptions,
            });
        }
    };

    onThoughtOptionSelect = (type: ISelectionType) => {
        const { selectedThought } = this.state;
        const { createOrUpdateThoughtReaction, user } = this.props;

        handleThoughtReaction(selectedThought, type, {
            user,
            createOrUpdateThoughtReaction,
            toggleThoughtOptions: this.toggleThoughtOptions,
        });
    };

    onTabSelect = (index: number) => {
        this.setState({
            activeTabIndex: index,
        });
    };

    scrollTop = () => {
        const { activeTabIndex } = this.state;
        switch (Object.values(CAROUSEL_TABS)[activeTabIndex]) {
            case CAROUSEL_TABS.DISCOVERIES:
                this.carouselDiscoveriesRef?.scrollToOffset({ animated: true, offset: 0 });
                break;
            case CAROUSEL_TABS.THOUGHTS:
                this.carouselThoughtsRef?.scrollToOffset({ animated: true, offset: 0 });
                break;
            case CAROUSEL_TABS.EVENTS:
                this.carouselEventsRef?.scrollToOffset({ animated: true, offset: 0 });
                break;
            case CAROUSEL_TABS.NEWS:
                this.carouselNewsRef?.scrollToOffset({ animated: true, offset: 0 });
                break;
            default:
                break;
        }
    };

    toggleAreaOptions = (area) => {
        const { areAreaOptionsVisible } = this.state;
        this.setState({
            areAreaOptionsVisible: !areAreaOptionsVisible,
            areThoughtOptionsVisible: false,
            selectedArea: areAreaOptionsVisible ? {} : area,
            selectedThought: {},
        });
    };

    toggleThoughtOptions = (thought) => {
        const { areThoughtOptionsVisible } = this.state;
        this.setState({
            areAreaOptionsVisible: false,
            areThoughtOptionsVisible: !areThoughtOptionsVisible,
            selectedArea: {},
            selectedThought: areThoughtOptionsVisible ? {} : thought,
        });
    };

    renderTabBar = props => {
        return (
            <TabBar
                {...props}
                indicatorStyle={this.themeMenu.styles.tabFocusedIndicator}
                style={this.themeMenu.styles.tabBar}
                renderLabel={this.renderTabLabel}
            />
        );
    };

    renderTabLabel = ({ route, focused }) => {
        return (
            <Text style={focused ? this.themeMenu.styles.tabTextFocused : this.themeMenu.styles.tabText}>
                {route.title}
            </Text>
        );
    };

    renderSceneMap = ({ route }) => {
        const { isLoading } = this.state;
        const {
            content,
            map,
            createOrUpdateMomentReaction,
            createOrUpdateSpaceReaction,
            createOrUpdateThoughtReaction,
            user,
        } = this.props;

        // TODO: Fetch missing media
        const fetchMedia = () => {};

        switch (route.key) {
            case CAROUSEL_TABS.DISCOVERIES:
                const categoriesFilter = (map.filtersCategory?.length && map.filtersCategory?.filter(c => c.isChecked).map(c => c.name)) || [SELECT_ALL];
                const socialData = isLoading ? [] : getActiveCarouselData({
                    activeTab: route.key,
                    content,
                    isForBookmarks: false,
                    shouldIncludeThoughts: false,
                    shouldIncludeMoments: true,
                    // TODO: Include promoted spaces in discoveries
                    shouldIncludeSpaces: !content?.activeMoments?.length,
                }, 'createdAt', categoriesFilter);

                return (
                    <AreaCarousel
                        activeData={socialData}
                        content={content}
                        inspectContent={this.goToContent}
                        isLoading={isLoading}
                        fetchMedia={fetchMedia}
                        goToViewMap={this.goToViewMap}
                        goToViewUser={this.goToViewUser}
                        toggleAreaOptions={this.toggleAreaOptions}
                        toggleThoughtOptions={this.toggleThoughtOptions}
                        translate={this.translate}
                        containerRef={(component) => { this.carouselDiscoveriesRef = component; }}
                        handleRefresh={this.handleRefresh}
                        onEndReached={this.tryLoadMore}
                        updateMomentReaction={createOrUpdateMomentReaction}
                        updateSpaceReaction={createOrUpdateSpaceReaction}
                        updateThoughtReaction={createOrUpdateThoughtReaction}
                        emptyListMessage={this.getEmptyListMessage(CAROUSEL_TABS.DISCOVERIES)}
                        emptyIconName="map"
                        renderHeader={() => null}
                        renderLoader={() => <LottieLoader id={this.loaderId} theme={this.themeLoader} />}
                        user={user}
                        rootStyles={this.theme.styles}
                        // viewportHeight={viewportHeight}
                        // viewportWidth={viewportWidth}
                    />
                );
            case CAROUSEL_TABS.THOUGHTS:
                const thoughtCategoriesFilter = (map.filtersCategory?.length && map.filtersCategory?.filter(c => c.isChecked).map(c => c.name)) || [SELECT_ALL];
                const thoughtSocialData = isLoading ? [] : getActiveCarouselData({
                    activeTab: route.key,
                    content,
                    isForBookmarks: false,
                    shouldIncludeThoughts: true,
                }, 'createdAt', thoughtCategoriesFilter);

                return (
                    <AreaCarousel
                        activeData={thoughtSocialData}
                        content={content}
                        inspectContent={this.goToContent}
                        isLoading={isLoading}
                        fetchMedia={fetchMedia}
                        goToViewMap={this.goToViewMap}
                        goToViewUser={this.goToViewUser}
                        toggleAreaOptions={this.toggleAreaOptions}
                        toggleThoughtOptions={this.toggleThoughtOptions}
                        translate={this.translate}
                        containerRef={(component) => { this.carouselThoughtsRef = component; }}
                        handleRefresh={this.handleRefresh}
                        onEndReached={this.tryLoadMore}
                        updateMomentReaction={createOrUpdateMomentReaction}
                        updateSpaceReaction={createOrUpdateSpaceReaction}
                        updateThoughtReaction={createOrUpdateThoughtReaction}
                        emptyListMessage={this.getEmptyListMessage(CAROUSEL_TABS.THOUGHTS)}
                        emptyIconName="idea"
                        renderHeader={() => null}
                        renderLoader={() => <LottieLoader id={this.loaderId} theme={this.themeLoader} />}
                        user={user}
                        rootStyles={this.theme.styles}
                        // viewportHeight={viewportHeight}
                        // viewportWidth={viewportWidth}
                    />
                );
            case CAROUSEL_TABS.EVENTS:
                const eventsData = [];
                return (
                    (<AreaCarousel
                        activeData={eventsData}
                        content={content}
                        inspectContent={this.goToContent}
                        isLoading={isLoading}
                        fetchMedia={fetchMedia}
                        goToViewMap={this.goToViewMap}
                        goToViewUser={this.goToViewUser}
                        toggleAreaOptions={this.toggleAreaOptions}
                        toggleThoughtOptions={this.toggleThoughtOptions}
                        translate={this.translate}
                        containerRef={(component) => { this.carouselEventsRef = component; }}
                        handleRefresh={this.handleRefresh}
                        onEndReached={this.tryLoadMore}
                        updateMomentReaction={createOrUpdateMomentReaction}
                        updateSpaceReaction={createOrUpdateSpaceReaction}
                        updateThoughtReaction={createOrUpdateThoughtReaction}
                        emptyListMessage={this.getEmptyListMessage(CAROUSEL_TABS.EVENTS)}
                        emptyIconName="ticket"
                        renderHeader={() => null}
                        renderLoader={() => <LottieLoader id={this.loaderId} theme={this.themeLoader} />}
                        user={user}
                        rootStyles={this.theme.styles}
                        // viewportHeight={viewportHeight}
                        // viewportWidth={viewportWidth}
                    />)
                );
            case CAROUSEL_TABS.NEWS:
                const newsData = [];
                return (
                    <AreaCarousel
                        activeData={newsData}
                        content={content}
                        inspectContent={this.goToContent}
                        isLoading={isLoading}
                        fetchMedia={fetchMedia}
                        goToViewMap={this.goToViewMap}
                        goToViewUser={this.goToViewUser}
                        toggleAreaOptions={this.toggleAreaOptions}
                        toggleThoughtOptions={this.toggleThoughtOptions}
                        translate={this.translate}
                        containerRef={(component) => { this.carouselNewsRef = component; }}
                        handleRefresh={this.handleRefresh}
                        onEndReached={this.tryLoadMore}
                        updateMomentReaction={createOrUpdateMomentReaction}
                        updateSpaceReaction={createOrUpdateSpaceReaction}
                        updateThoughtReaction={createOrUpdateThoughtReaction}
                        emptyListMessage={this.getEmptyListMessage(CAROUSEL_TABS.NEWS)}
                        renderHeader={() => null}
                        renderLoader={() => <LottieLoader id={this.loaderId} theme={this.themeLoader} />}
                        user={user}
                        rootStyles={this.theme.styles}
                        // viewportHeight={viewportHeight}
                        // viewportWidth={viewportWidth}
                    />
                );
        }
    };

    render() {
        const {
            activeTabIndex,
            areAreaOptionsVisible,
            areThoughtOptionsVisible,
            isLocationUseDisclosureModalVisible,
            selectedThought,
            selectedArea,
            tabRoutes,
        } = this.state;
        const { navigation, user } = this.props;
        const tabName = Object.values(CAROUSEL_TABS)[activeTabIndex];

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView style={[this.theme.styles.safeAreaView, { backgroundColor: this.theme.colorVariations.backgroundNeutral }]}>
                    <TabView
                        lazy
                        lazyPreloadDistance={1}
                        navigationState={{
                            index: activeTabIndex,
                            routes: tabRoutes,
                        }}
                        renderTabBar={this.renderTabBar}
                        renderScene={this.renderSceneMap}
                        renderLazyPlaceholder={() => (
                            <View style={this.theme.styles.sectionContainer}>
                                <LazyPlaceholder />
                                <LazyPlaceholder />
                                <LazyPlaceholder />
                                <LazyPlaceholder />
                                <LazyPlaceholder />
                                <LazyPlaceholder />
                                <LazyPlaceholder />
                            </View>
                        )}
                        onIndexChange={this.onTabSelect}
                        initialLayout={{ width: viewportWidth }}
                        // style={styles.container}
                    />
                </SafeAreaView>
                {
                    tabName === CAROUSEL_TABS.THOUGHTS
                    && <Button
                        containerStyle={this.themeButtons.styles.addAThought}
                        buttonStyle={this.themeButtons.styles.btnLarge}
                        icon={
                            <TherrIcon
                                name={'idea'}
                                size={27}
                                style={this.themeButtons.styles.btnIcon}
                            />
                        }
                        raised={true}
                        onPress={this.handleEditThought}
                    />
                }
                {
                    tabName === CAROUSEL_TABS.DISCOVERIES
                    && <Button
                        containerStyle={this.themeButtons.styles.addAThought}
                        buttonStyle={this.themeButtons.styles.btnLarge}
                        icon={
                            <TherrIcon
                                name={'map-marker-clock'}
                                size={27}
                                style={this.themeButtons.styles.btnIcon}
                            />
                        }
                        raised={true}
                        onPress={this.handleCreateMoment}
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
                <ThoughtOptionsModal
                    isVisible={areThoughtOptionsVisible}
                    onRequestClose={() => this.toggleThoughtOptions(selectedThought)}
                    translate={this.translate}
                    onSelect={this.onThoughtOptionSelect}
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
                {/* <MainButtonMenu navigation={navigation} onActionButtonPress={this.scrollTop} translate={this.translate} user={user} /> */}
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

export default connect(mapStateToProps, mapDispatchToProps)(Areas);
