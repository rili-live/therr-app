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
import MainButtonMenuAlt from '../../components/ButtonMenu/MainButtonMenuAlt';
import BaseStatusBar from '../../components/BaseStatusBar';
import { isMyArea } from '../../utilities/content';
import AreaOptionsModal, { ISelectionType } from '../../components/Modals/AreaOptionsModal';
import { getReactionUpdateArgs } from '../../utilities/reactions';
import LottieLoader, { ILottieId } from '../../components/LottieLoader';
import getActiveCarouselData from '../../utilities/getActiveCarouselData';
import { CAROUSEL_TABS } from '../../constants';

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
    private unsubscribeNavigationListener;

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

        if (area.areaType === 'spaces') {
            navigation.navigate('ViewSpace', {
                isMyArea: isMyArea(area, user),
                previousView: 'Spaces',
                space: area,
                spaceDetails: {},
            });
        } else {
            navigation.navigate('ViewMoment', {
                isMyArea: isMyArea(area, user),
                previousView: 'Areas',
                moment: area,
                momentDetails: {},
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

        if (!content.activeMomentsPagination.isLastPage) {
            return searchActiveMoments({
                withMedia: true,
                withUser: true,
                offset: content.activeMomentsPagination.offset + content.activeMomentsPagination.itemsPerPage,
                ...content.activeAreasFilters,
                blockedUsers: user.details.blockedUsers,
                shouldHideMatureContent: user.details.shouldHideMatureContent,
            });
        }

        if (!content.activeSpacesPagination.isLastPage) {
            return searchActiveSpaces({
                withMedia: true,
                withUser: true,
                offset: content.activeSpacesPagination.offset + content.activeSpacesPagination.itemsPerPage,
                ...content.activeAreasFilters,
                blockedUsers: user.details.blockedUsers,
                shouldHideMatureContent: user.details.shouldHideMatureContent,
            });
        }
    }

    onAreaOptionSelect = (type: ISelectionType) => {
        const { selectedArea } = this.state;
        const { createOrUpdateSpaceReaction, createOrUpdateMomentReaction, user } = this.props;
        const requestArgs: any = getReactionUpdateArgs(type);

        if (selectedArea.areaType === 'spaces') {
            createOrUpdateSpaceReaction(selectedArea.id, requestArgs).finally(() => {
                this.toggleAreaOptions(selectedArea);
            });
        } else {
            createOrUpdateMomentReaction(selectedArea.id, requestArgs, selectedArea.fromUserId, user.details.userName).finally(() => {
                this.toggleAreaOptions(selectedArea);
            });
        }
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
                activeTab={activeTab}
                content={content}
                inspectArea={this.goToArea}
                goToViewUser={this.goToViewUser}
                toggleAreaOptions={this.toggleAreaOptions}
                translate={this.translate}
                containerRef={(component) => this.carouselRef = component}
                handleRefresh={this.handleRefresh}
                onEndReached={this.tryLoadMore}
                onTabSelect={this.onTabSelect}
                updateMomentReaction={createOrUpdateMomentReaction}
                updateSpaceReaction={createOrUpdateSpaceReaction}
                emptyListMessage={this.getEmptyListMessage(activeTab)}
                user={user}
                shouldShowTabs={true}
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
                <MainButtonMenuAlt
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
