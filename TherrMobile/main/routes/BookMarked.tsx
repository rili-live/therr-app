import React from 'react';
import { SafeAreaView, Text } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ContentActions } from 'therr-react/redux/actions';
import { IContentState, IUserState, IUserConnectionsState } from 'therr-react/types';
import MainButtonMenuAlt from '../components/ButtonMenu/MainButtonMenuAlt';
import BaseStatusBar from '../components/BaseStatusBar';
import translator from '../services/translator';
import styles from '../styles';
import momentStyles from '../styles/user-content/moments';
import AreaCarousel from './Areas/AreaCarousel';
import { isMyArea } from '../utilities/content';
import getActiveCarouselData from '../utilities/getActiveCarouselData';
import { CAROUSEL_TABS } from '../constants';


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

    goToMoment = (moment) => {
        const { navigation, user } = this.props;

        // navigation.navigate('Home');
        navigation.navigate('ViewMoment', {
            isMyArea: isMyArea(moment, user),
            previousView: 'Areas',
            moment,
            momentDetails: {},
        });
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

    renderCarousel = (content) => {
        const { activeTab, isLoading } = this.state;
        const { createOrUpdateMomentReaction, createOrUpdateSpaceReaction, user } = this.props;

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
                activeTab={activeTab}
                content={content}
                inspectArea={this.goToMoment}
                translate={this.translate}
                containerRef={(component) => this.carouselRef = component}
                goToViewUser={this.goToViewUser}
                handleRefresh={() => Promise.resolve(this.handleRefresh())}
                toggleAreaOptions={this.toggleAreaOptions}
                onEndReached={this.tryLoadMore}
                onTabSelect={this.onTabSelect}
                updateMomentReaction={createOrUpdateMomentReaction}
                updateSpaceReaction={createOrUpdateSpaceReaction}
                emptyListMessage={this.getEmptyListMessage(activeTab)}
                user={user}
                // viewportHeight={viewportHeight}
                // viewportWidth={viewportWidth}
            />
        );
    }

    render() {
        const { content, navigation, user } = this.props;

        return (
            <>
                <BaseStatusBar />
                <SafeAreaView style={styles.safeAreaView}>
                    {
                        this.renderCarousel(content)
                    }
                </SafeAreaView>
                <MainButtonMenuAlt
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
