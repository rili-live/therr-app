import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { SheetManager } from 'react-native-actions-sheet';
import { ContentActions, MapActions } from 'therr-react/redux/actions';
import { IUserState, IContentState } from 'therr-react/types';
import { buildStyles } from '../../styles';
import { buildStyles as buildLoaderStyles } from '../../styles/loaders';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import translator from '../../utilities/translator';
import BaseStatusBar from '../../components/BaseStatusBar';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import LottieLoader, { ILottieId } from '../../components/LottieLoader';
import getActiveCarouselData from '../../utilities/getActiveCarouselData';
import { handleThoughtReaction, navToViewContent } from '../../utilities/postViewHelpers';
import { IContentSelectionType } from '../../components/ActionSheet/ContentOptionsSheet';
import { CAROUSEL_TABS } from '../../constants';
import AreaCarousel from '../Areas/AreaCarousel';

/**
 * The Friends with Habits public feed: the shared check-ins (public `main.thoughts` rows carrying
 * a proof photo) plus goals, ranked. Content can only be authored by making a check-in public,
 * which keeps the feed on-topic — there is no composer here on purpose.
 *
 * This reuses the existing thoughts feed machinery (`getActiveCarouselData` +
 * `AreaCarousel` + the Content reaction actions) rather than a second rendering path; the
 * thoughts it reads are already brand-scoped server-side by `BRAND_THOUGHTS_VISIBILITY`, so a
 * HABITS build sees HABITS posts (and a Therr build additionally sees them, which is intended).
 *
 * Gated behind `ENABLE_HABITS_FEED`: the route is only registered, and the bottom-bar Feed tab
 * only rendered, when the flag is on — see routes/index.tsx and ButtonMenu/habitsTabLayout.ts.
 */
interface IHabitsFeedDispatchProps {
    searchActiveThoughts: Function;
    updateActiveThoughtsStream: Function;
    createOrUpdateThoughtReaction: Function;
    fetchMedia: Function;
}

interface IStoreProps extends IHabitsFeedDispatchProps {
    user: IUserState;
    content: IContentState;
}

export interface IHabitsFeedProps extends IStoreProps {
    navigation: any;
}

interface IHabitsFeedState {
    isLoading: boolean;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    content: state.content,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    searchActiveThoughts: ContentActions.searchActiveThoughts,
    updateActiveThoughtsStream: ContentActions.updateActiveThoughtsStream,
    createOrUpdateThoughtReaction: ContentActions.createOrUpdateThoughtReaction,
    fetchMedia: MapActions.fetchMedia,
}, dispatch);

export class HabitsFeed extends React.Component<IHabitsFeedProps, IHabitsFeedState> {
    private translate: (key: string, params?: any) => string;

    private theme = buildStyles();

    private themeLoader = buildLoaderStyles();

    private themeForms = buildFormStyles();

    private themeMenu = buildMenuStyles();

    private loaderId: ILottieId = 'earth';

    private carouselRef;

    /**
     * Holds the feed's rendered order still between refreshes — see `getFeedOrderKey`.
     */
    private feedOrderKey = 0;

    private lastSeenPagination: any;

    constructor(props: IHabitsFeedProps) {
        super(props);

        this.state = {
            isLoading: true,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeLoader = buildLoaderStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any = {}) => translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount() {
        this.loadFeed({ shouldShowLoader: true });
    }

    /**
     * Only the first load swaps the list for the full-screen loader. A refresh used to do it
     * too, which unmounted the list mid-gesture — the user lost their scroll position, the
     * feed flashed to the Lottie loader and back, and the pull-to-refresh spinner was left
     * spinning on the remounted list. A refresh now keeps the list and its spinner in place.
     */
    loadFeed = ({ shouldShowLoader = false } = {}) => {
        const { updateActiveThoughtsStream, user } = this.props;

        if (shouldShowLoader) {
            this.setState({ isLoading: true });
        }

        return updateActiveThoughtsStream({
            withUser: true,
            withReplies: true,
            offset: 0,
            blockedUsers: user.details?.blockedUsers,
            shouldHideMatureContent: user.details?.shouldHideMatureContent,
        })
            .catch(() => {})
            .finally(() => {
                this.setState({ isLoading: false });
            });
    };

    // Returned so AreaCarousel can clear its pull-to-refresh spinner when the request settles.
    handleRefresh = () => this.loadFeed();

    // A refresh re-ranks the whole feed, so bring the user back to the top it starts from
    // rather than reshuffling the posts they are partway through.
    handleActionButtonPress = () => {
        this.carouselRef?.scrollToOffset?.({ offset: 0, animated: true });
        return this.loadFeed();
    };

    /**
     * The `stableOrderKey` AreaCarousel keeps the rendered order under. It changes only when a
     * first page lands (`UPDATE_ACTIVE_THOUGHTS` — mount, pull-to-refresh, the action button,
     * or another screen resetting the shared thoughts stream), which is the one moment a fresh
     * ranking is wanted. Paging in (`SEARCH_ACTIVE_THOUGHTS`, offset > 0) and reactions leave
     * it alone, so they only ever add posts below the ones already rendered.
     *
     * Derived from the store rather than bumped in `loadFeed`'s callback so the new key
     * arrives in the same render as the data it describes, not one render behind it.
     */
    getFeedOrderKey = () => {
        const pagination = this.props.content.activeThoughtsPagination;
        if (pagination !== this.lastSeenPagination) {
            this.lastSeenPagination = pagination;
            if (!pagination?.offset) {
                this.feedOrderKey += 1;
            }
        }
        return this.feedOrderKey;
    };

    // Mirrors the thoughts branch of postViewHelpers.loadMorePosts, inlined so this screen
    // never has to hand it the moment/space/event searchers it does not use.
    tryLoadMore = () => {
        const { content, searchActiveThoughts, user } = this.props;

        if (content.activeThoughtsPagination?.isLastPage) {
            return;
        }

        const lastContentCreatedAt = content.activeThoughts?.length
            ? content.activeThoughts[content.activeThoughts.length - 1].createdAt
            : null;

        searchActiveThoughts({
            withUser: true,
            withReplies: true,
            offset: (content.activeThoughtsPagination?.offset || 0)
                + (content.activeThoughtsPagination?.itemsPerPage || 0),
            blockedUsers: user.details?.blockedUsers,
            shouldHideMatureContent: user.details?.shouldHideMatureContent,
            lastContentCreatedAt,
        });
    };

    goToContent = (contentItem) => {
        const { navigation, user } = this.props;
        navToViewContent(contentItem, user, navigation.navigate);
    };

    goToViewUser = (userId) => {
        const { navigation } = this.props;
        navigation.navigate('ViewUser', { userInView: { id: userId } });
    };

    goToViewMap = (lat, long) => {
        const { navigation } = this.props;
        navigation.navigate('Map', { latitude: lat, longitude: long });
    };

    onThoughtOptionSelect = (type: IContentSelectionType, thought: any) => {
        const { createOrUpdateThoughtReaction, user } = this.props;
        handleThoughtReaction(thought, type, {
            user,
            createOrUpdateThoughtReaction,
            translate: this.translate,
        });
    };

    toggleThoughtOptions = (displayThought) => {
        const thought = displayThought || {};
        SheetManager.show('content-options-sheet', {
            payload: {
                contentType: 'thought',
                translate: this.translate,
                themeForms: this.themeForms,
                onSelect: (type: IContentSelectionType) => this.onThoughtOptionSelect(type, thought),
            },
        });
    };

    // Stable so AreaCarousel's ref callback is not detached and re-attached every render.
    setCarouselRef = (component) => { this.carouselRef = component; };

    // Reaction props AreaCarousel requires but that never fire for thought items.
    noop = () => {};

    render() {
        const {
            content, createOrUpdateThoughtReaction, fetchMedia, navigation, user,
        } = this.props;
        const { isLoading } = this.state;

        const feedData = isLoading ? [] : getActiveCarouselData({
            activeTab: CAROUSEL_TABS.THOUGHTS,
            content,
            isForBookmarks: false,
            shouldIncludeThoughts: true,
            translate: this.translate,
            contentAlgorithm: user.settings?.settingsContentAlgorithm,
        }, 'ranked');

        return (
            <>
                <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
                <SafeAreaView style={this.theme.styles.safeAreaView} edges={[]}>
                    <AreaCarousel
                        activeData={feedData}
                        content={content}
                        inspectContent={this.goToContent}
                        isLoading={isLoading}
                        fetchMedia={fetchMedia}
                        goToViewMap={this.goToViewMap}
                        goToViewUser={this.goToViewUser}
                        toggleAreaOptions={this.noop}
                        toggleThoughtOptions={this.toggleThoughtOptions}
                        translate={this.translate}
                        containerRef={this.setCarouselRef}
                        handleRefresh={this.handleRefresh}
                        onEndReached={this.tryLoadMore}
                        updateEventReaction={this.noop}
                        updateMomentReaction={this.noop}
                        updateSpaceReaction={this.noop}
                        updateThoughtReaction={createOrUpdateThoughtReaction}
                        emptyListMessage={this.translate('pages.habits.feed.emptyMessage')}
                        emptyIconName="idea"
                        renderHeader={() => null}
                        renderLoader={() => <LottieLoader id={this.loaderId} theme={this.themeLoader} />}
                        user={user}
                        rootStyles={this.theme.styles}
                        stableOrderKey={this.getFeedOrderKey()}
                    />
                </SafeAreaView>
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={this.handleActionButtonPress}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(HabitsFeed);
