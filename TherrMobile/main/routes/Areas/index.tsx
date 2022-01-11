import React from 'react';
import { SafeAreaView } from 'react-native';
// import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ContentActions } from 'therr-react/redux/actions';
import { IContentState, IUserState, IUserConnectionsState } from 'therr-react/types';
// import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
// import * as therrTheme from '../styles/themes';
import styles from '../../styles';
import * as therrTheme from '../../styles/themes';
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
import CarouselTabsMenu from './CarouselTabsMenu';

// const { width: viewportWidth, height: viewportHeight } = Dimensions.get('window');

function getRandomLoaderId(): ILottieId {
    const options: ILottieId[] = ['donut', 'taco', 'shopping', 'happy-swing', 'karaoke', 'yellow-car', 'zeppelin', 'therr-black-rolling'];
    const selected = Math.floor(Math.random() * options.length);
    return options[selected] as ILottieId;
}

interface IAreasDispatchProps {
    searchActiveMoments: Function;
    updateActiveMoments: Function;
    createOrUpdateMomentReaction: Function;

    searchActiveSpaces: Function;
    updateActiveSpaces: Function;
    createOrUpdateSpaceReaction: Function;

    logout: Function;
}

interface IStoreProps extends IAreasDispatchProps {
    content: IContentState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IAreasProps extends IStoreProps {
    navigation: any;
}

interface IAreasState {
    activeTab: string;
    isLoading: boolean;
    areAreaOptionsVisible: boolean;
    selectedArea: any;
}

const mapStateToProps = (state: any) => ({
    content: state.content,
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            searchActiveMoments: ContentActions.searchActiveMoments,
            updateActiveMoments: ContentActions.updateActiveMoments,
            createOrUpdateMomentReaction: ContentActions.createOrUpdateMomentReaction,

            searchActiveSpaces: ContentActions.searchActiveSpaces,
            updateActiveSpaces: ContentActions.updateActiveSpaces,
            createOrUpdateSpaceReaction: ContentActions.createOrUpdateSpaceReaction,
        },
        dispatch
    );

class Areas extends React.Component<IAreasProps, IAreasState> {
    private carouselRef;
    private translate: Function;
    private loaderId: ILottieId;
    private loadTimeoutId: any;

    constructor(props) {
        super(props);

        this.state = {
            activeTab: CAROUSEL_TABS.SOCIAL,
            isLoading: true,
            areAreaOptionsVisible: false,
            selectedArea: {},
        };

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
    }

    componentWillUnmount() {
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

    renderCarousel = (content) => {
        const { createOrUpdateMomentReaction, createOrUpdateSpaceReaction, user } = this.props;
        const { activeTab, isLoading } = this.state;

        if (isLoading) {
            return <LottieLoader id={this.loaderId} />;
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
                renderHeader={() => (
                    <CarouselTabsMenu
                        activeTab={activeTab}
                        onButtonPress={this.onTabSelect}
                        translate={this.translate}
                        user={user}
                    />
                )}
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
                <SafeAreaView style={[styles.safeAreaView, { backgroundColor: therrTheme.colorVariations.backgroundNeutral }]}>
                    {
                        this.renderCarousel(content)
                    }
                </SafeAreaView>
                <AreaOptionsModal
                    isVisible={areAreaOptionsVisible}
                    onRequestClose={() => this.toggleAreaOptions(selectedArea)}
                    translate={this.translate}
                    onSelect={this.onAreaOptionSelect}
                />
                {/* <MainButtonMenu navigation={navigation} onActionButtonPress={this.scrollTop} translate={this.translate} user={user} /> */}
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={this.scrollTop}
                    translate={this.translate}
                    user={user}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Areas);
