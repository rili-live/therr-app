import React from 'react';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { SheetManager } from 'react-native-actions-sheet';
import Toast from 'react-native-toast-message';
import { ContentActions, MapActions } from 'therr-react/redux/actions';
import { PactsService } from 'therr-react/services';
import {
    IUserState, IContentState, IHabitsState, IOpenPact,
} from 'therr-react/types';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
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
import { getApiErrorMessage } from '../../utilities/apiErrorMessage';
import { logAppEvent } from '../../utilities/analyticsEvents';
import { getHabitCapPaywallParams } from '../../utilities/habitCapPaywall';
import {
    IFeedOpenPactItem,
    buildFeedOpenPactItems,
    interleaveFeedOpenPacts,
} from '../../utilities/feedOpenPacts';
import FeedOpenPactCard from '../../components/Habits/FeedOpenPactCard';
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
 * Between the posts sit a few open pacts the viewer could ask to join (utilities/feedOpenPacts),
 * so a quiet feed still has something to act on. They come from the same `GET /habits/pacts/open`
 * the OpenPacts screen reads, and asking goes through the same request-to-join flow.
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
    habits?: IHabitsState;
}

export interface IHabitsFeedProps extends IStoreProps {
    navigation: any;
}

interface IHabitsFeedState {
    isLoading: boolean;
    openPacts: IOpenPact[];
    /** The server's seat ceiling, sent with the list; null from a server that predates it. */
    openPactsMaxMembers: number | null;
    /** Bumped by every successful open-pacts read — part of the feed's order key, see `getFeedOrderKey`. */
    openPactsLoadCount: number;
    pendingPactId: string | null;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    content: state.content,
    habits: state.habits,
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

    private themeButtons = buildButtonStyles();

    private themeHabits = buildHabitStyles();

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
            openPacts: [],
            openPactsMaxMembers: null,
            openPactsLoadCount: 0,
            pendingPactId: null,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeLoader = buildLoaderStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonStyles(props.user.settings?.mobileThemeName);
        this.themeHabits = buildHabitStyles(props.user.settings?.mobileThemeName);
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

        // Not awaited by the spinner: the cards are extra, and a slow pacts read must not hold
        // the posts back.
        this.loadOpenPacts();

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

    /**
     * A failed or offline read keeps whatever cards are showing. An older server routes
     * `/habits/pacts/open` to `/habits/pacts/:id` and errors, which simply means no cards.
     */
    loadOpenPacts = () => Promise.resolve()
        .then(() => PactsService.getOpenPacts())
        .then((response: any) => {
            const pacts = response?.data?.pacts;
            if (response?.isOfflineFallback || !Array.isArray(pacts)) {
                return;
            }
            const maxMembers = response.data.maxMembers;
            this.setState((prev) => ({
                openPacts: pacts,
                openPactsMaxMembers: typeof maxMembers === 'number' && maxMembers > 0 ? maxMembers : null,
                openPactsLoadCount: prev.openPactsLoadCount + 1,
            }));
        })
        .catch(() => {});

    setPactRequested = (pactId: string, hasPendingJoinRequest: boolean) => {
        this.setState((prev) => ({
            openPacts: prev.openPacts.map((p) => (p.id === pactId ? { ...p, hasPendingJoinRequest } : p)),
        }));
    };

    showPactRequestError = (error: any) => {
        Toast.show({
            type: 'error',
            text1: this.translate('pages.pacts.errorTitle'),
            text2: getApiErrorMessage(error) || this.translate('pages.pacts.openPact.requestError'),
            visibilityTime: 3000,
        });
        // Most refusals mean the pact filled up or closed since the feed loaded.
        this.loadOpenPacts();
    };

    handleAskToJoinPact = (pact: IOpenPact, pitch: string) => {
        const { navigation, user } = this.props;
        this.setState({ pendingPactId: pact.id });

        PactsService.requestToJoin(pact.id)
            .then(() => {
                logAppEvent('habit_pact_join_request', { userId: user?.details?.id, source: 'feed', pitch });
                this.setPactRequested(pact.id, true);
                Toast.show({
                    type: 'success',
                    text1: this.translate('pages.pacts.openPact.requestSentTitle'),
                    text2: this.translate('pages.pacts.openPact.requestSentMessage', {
                        name: pact.creatorUserName || this.translate('pages.pacts.partnerFallback'),
                    }),
                    visibilityTime: 3000,
                });
            })
            .catch((error: any) => {
                // Joining takes a habit slot, so the server checks the free-tier cap at the ask.
                const paywallParams = getHabitCapPaywallParams(error, 'open-pacts');
                if (paywallParams) {
                    navigation.navigate('UpgradePaywall', paywallParams);
                    return;
                }
                this.showPactRequestError(error);
            })
            .finally(() => {
                this.setState({ pendingPactId: null });
            });
    };

    handleCancelPactRequest = (pact: IOpenPact) => {
        this.setState({ pendingPactId: pact.id });

        PactsService.cancelJoinRequest(pact.id)
            .then(() => {
                this.setPactRequested(pact.id, false);
            })
            .catch(this.showPactRequestError)
            .finally(() => {
                this.setState({ pendingPactId: null });
            });
    };

    goToOpenPacts = () => {
        this.props.navigation.navigate('OpenPacts');
    };

    renderFeedItem = (item: IFeedOpenPactItem) => {
        const { openPactsMaxMembers, pendingPactId } = this.state;

        return (
            <FeedOpenPactCard
                pact={item.pact}
                pitch={item.pitch}
                maxMembers={openPactsMaxMembers}
                isBusy={!!pendingPactId}
                isPending={pendingPactId === item.pact.id}
                onAskToJoin={(pact) => this.handleAskToJoinPact(pact, item.pitch)}
                onCancelRequest={this.handleCancelPactRequest}
                onSeeAll={this.goToOpenPacts}
                translate={this.translate}
                themeHabits={this.themeHabits}
                themeButtons={this.themeButtons}
            />
        );
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
     *
     * A fresh open-pacts read changes it too. The cards land after the posts, and under an
     * unchanged key AreaCarousel would append them below every rendered post rather than in
     * their slots. Asking to join (which only flips a card's button) leaves it alone.
     */
    getFeedOrderKey = () => {
        const pagination = this.props.content.activeThoughtsPagination;
        if (pagination !== this.lastSeenPagination) {
            this.lastSeenPagination = pagination;
            if (!pagination?.offset) {
                this.feedOrderKey += 1;
            }
        }
        return `${this.feedOrderKey}:${this.state.openPactsLoadCount}`;
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

    // Only when the cards are all there is: says why the feed opens on pacts instead of posts.
    renderHeader = (hasPosts: boolean, hasCards: boolean) => (!hasPosts && hasCards ? (
        <Text style={[this.themeHabits.styles.habitNotificationPrefsHint, { marginHorizontal: 20, marginTop: 12 }]}>
            {this.translate('pages.habits.feed.openPact.emptyFeedIntro')}
        </Text>
    ) : null);

    render() {
        const {
            content, createOrUpdateThoughtReaction, fetchMedia, habits, navigation, user,
        } = this.props;
        const { isLoading, openPacts } = this.state;

        const posts = isLoading ? [] : getActiveCarouselData({
            activeTab: CAROUSEL_TABS.THOUGHTS,
            content,
            isForBookmarks: false,
            shouldIncludeThoughts: true,
            translate: this.translate,
            contentAlgorithm: user.settings?.settingsContentAlgorithm,
        }, 'ranked');
        const pactCards = isLoading ? [] : buildFeedOpenPactItems(openPacts, habits?.userHabits);
        const feedData = interleaveFeedOpenPacts(posts, pactCards);

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
                        renderHeader={() => this.renderHeader(posts.length > 0, pactCards.length > 0)}
                        renderFeedItem={this.renderFeedItem}
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
