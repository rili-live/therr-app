import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ContentActions } from 'therr-react/redux/actions';
import { IContentState, IUserState, IUserConnectionsState } from 'therr-react/types';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import BaseStatusBar from '../../components/BaseStatusBar';
import translator from '../../utilities/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import { buildStyles as buildLoaderStyles } from '../../styles/loaders';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildMomentStyles } from '../../styles/user-content/areas';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import AreaCarousel from './AreaCarousel';
import getActiveCarouselData from '../../utilities/getActiveCarouselData';
import { CAROUSEL_TABS } from '../../constants';
import { handleAreaReaction, navToViewContent } from '../../utilities/postViewHelpers';
import { SheetManager } from 'react-native-actions-sheet';
import { IContentSelectionType } from '../../components/ActionSheet/ContentOptionsSheet';
import LottieLoader, { ILottieId } from '../../components/LottieLoader';
import getDirections from '../../utilities/getDirections';

function getRandomLoaderId(): ILottieId {
    const options: ILottieId[] = ['donut', 'earth', 'taco', 'shopping', 'happy-swing', 'karaoke', 'yellow-car', 'zeppelin', 'therr-black-rolling'];
    const selected = Math.floor(Math.random() * options.length);
    return options[selected] as ILottieId;
}

interface IBookMarkedDispatchProps {
    searchBookmarkedEvents: Function;
    searchBookmarkedMoments: Function;
    searchBookmarkedSpaces: Function;
    searchBookmarkedThoughts: Function;
    createOrUpdateEventReaction: Function;
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
}

const mapStateToProps = (state: any) => ({
    content: state.content,
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            searchBookmarkedEvents: ContentActions.searchBookmarkedEvents,
            searchBookmarkedMoments: ContentActions.searchBookmarkedMoments,
            searchBookmarkedSpaces: ContentActions.searchBookmarkedSpaces,
            searchBookmarkedThoughts: ContentActions.searchBookmarkedThoughts,
            createOrUpdateEventReaction: ContentActions.createOrUpdateEventReaction,
            createOrUpdateMomentReaction: ContentActions.createOrUpdateMomentReaction,
            createOrUpdateSpaceReaction: ContentActions.createOrUpdateSpaceReaction,
        },
        dispatch
    );

class BookMarked extends React.Component<IBookMarkedProps, IBookMarkedState> {
    private carouselRef;
    private loaderId: ILottieId;
    private translate: Function;
    private theme = buildStyles();
    private themeButtons = buildButtonsStyles();
    private themeForms = buildFormStyles();
    private themeLoader = buildLoaderStyles();
    private themeMenu = buildMenuStyles();
    private themeMoments = buildMomentStyles();

    constructor(props) {
        super(props);

        this.state = {
            activeTab: CAROUSEL_TABS.DISCOVERIES,
            isLoading: true,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeLoader = buildLoaderStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeMoments = buildMomentStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);
        this.loaderId = getRandomLoaderId();
    }

    componentDidMount() {
        const { navigation, searchBookmarkedEvents, searchBookmarkedMoments, searchBookmarkedSpaces, searchBookmarkedThoughts, user } = this.props;

        navigation.setOptions({
            title: this.translate('pages.bookmarked.headerTitle'),
        });

        const searchParams = {
            withMedia: true,
            withUser: true,
            offset: 0,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        };

        Promise.all([
            searchBookmarkedEvents(searchParams),
            searchBookmarkedMoments(searchParams),
            searchBookmarkedSpaces(searchParams),
            searchBookmarkedThoughts(searchParams),
        ]).finally(() => {
            this.setState({
                isLoading: false,
            });
        });
    }


    handleRefresh = () => {
        const { searchBookmarkedEvents, searchBookmarkedMoments, searchBookmarkedSpaces, searchBookmarkedThoughts, user } = this.props;

        const searchParams = {
            withMedia: true,
            withUser: true,
            offset: 0,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        };

        return Promise.all([
            searchBookmarkedEvents(searchParams),
            searchBookmarkedMoments(searchParams),
            searchBookmarkedSpaces(searchParams),
            searchBookmarkedThoughts(searchParams),
        ]);
    };

    onTabSelect = (tabName: string) => {
        this.setState({
            activeTab: tabName,
        });
    };

    getEmptyListMessage = (activeTab) => {
        if (activeTab === CAROUSEL_TABS.DISCOVERIES) {
            return this.translate('pages.bookmarked.noSocialBookmarksFound');
        }

        if (activeTab === CAROUSEL_TABS.NEWS) {
            return this.translate('pages.bookmarked.noNewsBookmarksFound');
        }

        // CAROUSEL_TABS.EVENTS
        return this.translate('pages.bookmarked.noEventsBookmarksFound');
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

    toggleAreaOptions = (displayArea) => {
        const area = displayArea || {};
        SheetManager.show('content-options-sheet', {
            payload: {
                contentType: 'area',
                translate: this.translate,
                themeForms: this.themeForms,
                onSelect: (type: IContentSelectionType) => this.onAreaOptionSelect(type, area),
            },
        });
    };

    tryLoadMore = () => {
        console.log('try load more');
    };

    onAreaOptionSelect = (type: IContentSelectionType, area: any) => {
        const { createOrUpdateEventReaction, createOrUpdateSpaceReaction, createOrUpdateMomentReaction, user } = this.props;

        if (type === 'getDirections') {
            getDirections({
                latitude: area.latitude,
                longitude: area.longitude,
                title: area.notificationMsg,
            });
        } else {
            handleAreaReaction(area, type, {
                user,
                createOrUpdateEventReaction,
                createOrUpdateMomentReaction,
                createOrUpdateSpaceReaction,
                toggleAreaOptions: this.toggleAreaOptions,
                translate: this.translate,
            });
        }
    };

    render() {
        const { activeTab, isLoading } = this.state;
        const { createOrUpdateEventReaction, createOrUpdateMomentReaction, createOrUpdateSpaceReaction, content, navigation, user } = this.props;

        // TODO: Fetch missing media
        const fetchMedia = () => {};

        const activeData = isLoading ? [] : getActiveCarouselData({
            activeTab,
            content,
            isForBookmarks: true,
            shouldIncludeEvents: true,
            shouldIncludeMoments: true,
            shouldIncludeSpaces: true,
            shouldIncludeThoughts: true,
            translate: this.translate,
        }, 'createdAt');

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView style={this.theme.styles.safeAreaView}>
                    <View style={headerStyles.myListsHeader}>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('MyLists')}
                            style={headerStyles.myListsButton}
                            accessibilityLabel={this.translate('pages.bookmarks.lists.title')}
                        >
                            <MaterialIcon name="bookmarks" size={18} color="#26a69a" />
                            <Text style={headerStyles.myListsLabel}>
                                {this.translate('pages.bookmarks.lists.title')}
                            </Text>
                            <MaterialIcon name="chevron-right" size={20} color="#26a69a" />
                        </TouchableOpacity>
                    </View>
                    <View style={headerStyles.sectionHeading}>
                        <Text style={headerStyles.sectionHeadingText}>
                            {this.translate('pages.bookmarks.postsHeading')}
                        </Text>
                    </View>
                    <AreaCarousel
                        activeData={activeData}
                        content={content}
                        inspectContent={this.goToArea}
                        translate={this.translate}
                        containerRef={(component) => { this.carouselRef = component; }}
                        fetchMedia={fetchMedia}
                        goToViewMap={this.goToViewMap}
                        goToViewUser={this.goToViewUser}
                        handleRefresh={() => Promise.resolve(this.handleRefresh())}
                        toggleAreaOptions={this.toggleAreaOptions}
                        isLoading={isLoading}
                        onEndReached={this.tryLoadMore}
                        updateEventReaction={createOrUpdateEventReaction}
                        updateMomentReaction={createOrUpdateMomentReaction}
                        updateSpaceReaction={createOrUpdateSpaceReaction}
                        emptyListMessage={this.getEmptyListMessage(activeTab)}
                        renderHeader={() => null}
                        renderLoader={() => <LottieLoader id={this.loaderId} theme={this.themeLoader} />}
                        user={user}
                        rootStyles={this.theme.styles}
                        // viewportHeight={viewportHeight}
                        // viewportWidth={viewportWidth}
                    />
                </SafeAreaView>
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={this.handleRefresh}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />
            </>
        );
    }
}

const headerStyles = StyleSheet.create({
    myListsHeader: {
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 4,
    },
    myListsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: 'rgba(38, 166, 154, 0.08)',
    },
    myListsLabel: {
        flex: 1,
        marginLeft: 8,
        fontSize: 14,
        fontWeight: '600',
        color: '#26a69a',
    },
    sectionHeading: {
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 4,
    },
    sectionHeadingText: {
        fontSize: 16,
        fontWeight: '700',
    },
});

export default connect(mapStateToProps, mapDispatchToProps)(BookMarked);
