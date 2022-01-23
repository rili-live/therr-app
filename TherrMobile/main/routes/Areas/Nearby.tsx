import React from 'react';
import { Keyboard, SafeAreaView, Text, View } from 'react-native';
import { Slider } from 'react-native-elements';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ContentActions, MapActions } from 'therr-react/redux/actions';
import { IContentState, IMapState, IUserState, IUserConnectionsState } from 'therr-react/types';
import { Location } from 'therr-js-utilities/constants';
// import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
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

// const { width: viewportWidth, height: viewportHeight } = Dimensions.get('window');

function getRandomLoaderId(): ILottieId {
    const options: ILottieId[] = ['donut', 'taco', 'shopping', 'happy-swing', 'karaoke', 'yellow-car', 'zeppelin', 'therr-black-rolling'];
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

    logout: Function;
}

interface IStoreProps extends INearbyDispatchProps {
    content: IContentState;
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
    isLoading: boolean;
    areAreaOptionsVisible: boolean;
    selectedArea: any;
}

const mapStateToProps = (state: any) => ({
    content: state.content,
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
        },
        dispatch
    );

class Nearby extends React.Component<INearbyProps, INearbyState> {
    private carouselRef;
    private translate: Function;
    private loaderId: ILottieId;
    private loadTimeoutId: any;
    private unsubscribeNavigationListener;
    private theme = buildStyles();
    private themeButtons = buildButtonsStyles();
    private themeLoader = buildLoaderStyles();
    private themeMenu = buildMenuStyles();
    private themeMoments = buildMomentStyles();
    private themeReactionsModal = buildReactionsModalStyles();
    private themeForms = buildFormStyles();

    constructor(props) {
        super(props);

        this.state = {
            activeTab: CAROUSEL_TABS.SOCIAL,
            isLoading: true,
            areAreaOptionsVisible: false,
            selectedArea: {},
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
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
        const { activeTab } = this.state;
        const { content, navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.areas.headerTitle'),
        });

        this.unsubscribeNavigationListener = navigation.addListener('focus', () => {
            const activeData = getActiveCarouselData({
                activeTab,
                content,
                isForBookmarks: false,
            });
            if (!activeData?.length || activeData.length < 21) {
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
        clearTimeout(this.loadTimeoutId);
    }

    getEmptyListMessage = (activeTab) => {
        if (activeTab === CAROUSEL_TABS.SOCIAL) {
            return this.translate('pages.areas.noSocialAreasFound');
        }

        if (activeTab === CAROUSEL_TABS.HIRE) {
            return this.translate('pages.areas.noHireAreasFound');
        }

        // CAROUSEL_TABS.EVENTS
        return this.translate('pages.areas.noEventsAreasFound');
    }

    goToMap = () => {
        const { navigation } = this.props;
        navigation.navigate('Map');
    }

    goToArea = (area) => {
        const { navigation, user } = this.props;

        navToViewArea(area, user, navigation.navigate);
    };

    goToViewUser = (userId) => {
        const { navigation } = this.props;

        navigation.navigate('ViewUser', {
            userInView: {
                id: userId,
            },
        });
    }

    handleRefresh = () => {
        const { content, updateActiveMoments, updateActiveSpaces, user } = this.props;
        this.setState({ isLoading: true });

        const activeMomentsPromise = updateActiveMoments({
            withMedia: true,
            withUser: true,
            offset: 0,
            ...content.activeAreasFilters,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        });

        const activeSpacesPromise = updateActiveSpaces({
            withMedia: true,
            withUser: true,
            offset: 0,
            ...content.activeAreasFilters,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        });

        return Promise.all([activeMomentsPromise, activeSpacesPromise]).finally(() => {
            this.loadTimeoutId = setTimeout(() => {
                this.setState({ isLoading: false });
            }, 400);
        });
    }

    tryLoadMore = () => {
        const { content, searchActiveMoments, searchActiveSpaces, user } = this.props;

        loadMoreAreas({
            content,
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
                        thumbStyle={{ backgroundColor: this.theme.colors.accentBlue }}
                        thumbTouchSize={{ width: 100, height: 100 }}
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
                        thumbStyle={{ backgroundColor: this.theme.colors.accent1 }}
                        thumbTouchSize={{ width: 100, height: 100 }}
                        minimumTrackTintColor={this.theme.colorVariations.accent1LightFade}
                        maximumTrackTintColor={this.theme.colorVariations.accent1HeavyFade}
                        onSlidingStart={Keyboard.dismiss}
                    />
                </View>
            </View>
        );
    }

    renderCarousel = (content, user) => {
        const { createOrUpdateMomentReaction, createOrUpdateSpaceReaction } = this.props;
        const { activeTab, isLoading } = this.state;

        if (isLoading) {
            return <LottieLoader id={this.loaderId} theme={this.themeLoader} />;
        }

        const activeData = getActiveCarouselData({
            activeTab,
            content,
            isForBookmarks: false,
        });

        return (
            <AreaCarousel
                activeData={activeData}
                content={content}
                inspectArea={this.goToArea}
                goToViewUser={this.goToViewUser}
                toggleAreaOptions={this.toggleAreaOptions}
                translate={this.translate}
                containerRef={(component) => this.carouselRef = component}
                handleRefresh={this.handleRefresh}
                onEndReached={this.tryLoadMore}
                updateMomentReaction={createOrUpdateMomentReaction}
                updateSpaceReaction={createOrUpdateSpaceReaction}
                emptyListMessage={this.getEmptyListMessage(activeTab)}
                renderHeader={this.renderHeader}
                user={user}
                rootStyles={this.theme.styles}
                // viewportHeight={viewportHeight}
                // viewportWidth={viewportWidth}
            />
        );
    }

    render() {
        const { areAreaOptionsVisible, selectedArea } = this.state;
        const { content, navigation, user } = this.props;

        return (
            <>
                <BaseStatusBar />
                <SafeAreaView style={[this.theme.styles.safeAreaView, { backgroundColor: this.theme.colorVariations.backgroundNeutral }]}>
                    {
                        this.renderCarousel(content, user)
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

export default connect(mapStateToProps, mapDispatchToProps)(Nearby);
