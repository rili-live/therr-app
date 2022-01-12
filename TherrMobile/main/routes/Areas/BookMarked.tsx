import React from 'react';
import { SafeAreaView, Text } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ContentActions } from 'therr-react/redux/actions';
import { IContentState, IUserState, IUserConnectionsState } from 'therr-react/types';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import BaseStatusBar from '../../components/BaseStatusBar';
import translator from '../../services/translator';
import styles from '../../styles';
import momentStyles from '../../styles/user-content/moments';
import AreaCarousel from './AreaCarousel';
import getActiveCarouselData from '../../utilities/getActiveCarouselData';
import { getReactionUpdateArgs } from '../../utilities/reactions';
import { CAROUSEL_TABS } from '../../constants';
import { handleAreaReaction, navToViewArea } from './areaViewHelpers';
import AreaOptionsModal, { ISelectionType } from '../../components/Modals/AreaOptionsModal';


interface IBookMarkedDispatchProps {
    searchBookmarkedMoments: Function;
    searchBookmarkedSpaces: Function;
    createOrUpdateMomentReaction: Function;
    createOrUpdateSpaceReaction: Function;
}

interface IStoreProps extends IBookMarkedDispatchProps {
    content: IContentState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IBookMarkedProps extends IStoreProps {
    navigation: any;
}

interface IBookMarkedState {
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
            searchBookmarkedMoments: ContentActions.searchBookmarkedMoments,
            createOrUpdateMomentReaction: ContentActions.createOrUpdateMomentReaction,
            searchBookmarkedSpaces: ContentActions.searchBookmarkedSpaces,
            createOrUpdateSpaceReaction: ContentActions.createOrUpdateSpaceReaction,
        },
        dispatch
    );

class BookMarked extends React.Component<IBookMarkedProps, IBookMarkedState> {
    private carouselRef;
    private translate: Function;

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
    }

    componentDidMount() {
        const { navigation, searchBookmarkedMoments, searchBookmarkedSpaces, user } = this.props;

        navigation.setOptions({
            title: this.translate('pages.bookmarked.headerTitle'),
        });

        this.setState({
            areAreaOptionsVisible: false,
            isLoading: false,
            selectedArea: {},
        });

        const bookmarkedMomentsPromise = searchBookmarkedMoments({
            withMedia: true,
            withUser: true,
            offset: 0,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        });

        const bookmarkedSpacesPromise = searchBookmarkedSpaces({
            withMedia: true,
            withUser: true,
            offset: 0,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        });

        Promise.all([bookmarkedMomentsPromise, bookmarkedSpacesPromise]).finally(() => {
            this.setState({
                isLoading: false,
            });
        });
    }


    handleRefresh = () => {
        const { searchBookmarkedMoments, searchBookmarkedSpaces, user } = this.props;

        searchBookmarkedMoments({
            withMedia: true,
            withUser: true,
            offset: 0,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        });

        searchBookmarkedSpaces({
            withMedia: true,
            withUser: true,
            offset: 0,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        });
    }

    onTabSelect = (tabName: string) => {
        this.setState({
            activeTab: tabName,
        });
    }

    getEmptyListMessage = (activeTab) => {
        if (activeTab === CAROUSEL_TABS.SOCIAL) {
            return this.translate('pages.bookmarked.noSocialBookmarksFound');
        }

        if (activeTab === CAROUSEL_TABS.HIRE) {
            return this.translate('pages.bookmarked.noHireBookmarksFound');
        }

        // CAROUSEL_TABS.EVENTS
        return this.translate('pages.bookmarked.noEventsBookmarksFound');
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

    toggleAreaOptions = (area) => {
        const { areAreaOptionsVisible } = this.state;
        this.setState({
            areAreaOptionsVisible: !areAreaOptionsVisible,
            selectedArea: areAreaOptionsVisible ? {} : area,
        });
    }

    tryLoadMore = () => {
        console.log('try load more');
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

    renderCarousel = (content) => {
        const { activeTab, isLoading } = this.state;
        const { createOrUpdateMomentReaction, createOrUpdateSpaceReaction } = this.props;

        if (isLoading) {
            return (
                <Text style={momentStyles.noAreasFoundText}>Loading...</Text>
            );
        }

        const activeData = getActiveCarouselData({
            activeTab,
            content,
            isForBookmarks: true,
        });

        return (
            <AreaCarousel
                activeData={activeData}
                content={content}
                inspectArea={this.goToArea}
                translate={this.translate}
                containerRef={(component) => this.carouselRef = component}
                goToViewUser={this.goToViewUser}
                handleRefresh={() => Promise.resolve(this.handleRefresh())}
                toggleAreaOptions={this.toggleAreaOptions}
                onEndReached={this.tryLoadMore}
                updateMomentReaction={createOrUpdateMomentReaction}
                updateSpaceReaction={createOrUpdateSpaceReaction}
                emptyListMessage={this.getEmptyListMessage(activeTab)}
                renderHeader={() => null}
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
                <SafeAreaView style={styles.safeAreaView}>
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
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={this.handleRefresh}
                    translate={this.translate}
                    user={user}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(BookMarked);
