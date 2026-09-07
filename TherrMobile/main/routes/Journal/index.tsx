import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    SectionList,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RefreshControl } from 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { HabitActions } from 'therr-react/redux/actions';
import { IHabitsState, IJournalFeedItem, IUserHabit, IUserState } from 'therr-react/types';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import BaseStatusBar from '../../components/BaseStatusBar';
import translator from '../../utilities/translator';
import { showToast } from '../../utilities/toasts';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildJournalStyles } from '../../styles/habits/journal';
import {
    buildJournalSwatchAssignment,
    resolveJournalSwatch,
} from '../../styles/habits/journalPalette';
import { groupFeedByDay, IJournalDaySection, toLocalEntryDate } from './journalGrouping';
import JournalEntryRow from './JournalEntryRow';
import JournalComposer from './JournalComposer';
import JournalCreateMenu from './JournalCreateMenu';

interface IJournalDispatchProps {
    getJournalFeed: Function;
    createJournalEntry: Function;
    updateJournalEntry: Function;
    getUserHabits: Function;
}

interface IStoreProps extends IJournalDispatchProps {
    habits: IHabitsState;
    user: IUserState;
}

export interface IJournalProps extends IStoreProps {
    navigation: any;
}

interface IJournalState {
    isRefreshing: boolean;
    isLoadingMore: boolean;
    isCreateMenuVisible: boolean;
    isComposerVisible: boolean;
    isSaving: boolean;
    editingEntry: IJournalFeedItem | null;
}

const mapStateToProps = (state) => ({
    habits: state.habits,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getJournalFeed: HabitActions.getJournalFeed,
    createJournalEntry: HabitActions.createJournalEntry,
    updateJournalEntry: HabitActions.updateJournalEntry,
    getUserHabits: HabitActions.getUserHabits,
}, dispatch);

/**
 * The Journal — a day-grouped record of everything the user did, plus anything
 * they chose to write about it.
 *
 * A `SectionList` rather than a flat list because the design's left-hand date
 * rail is per-day, not per-entry: several entries on the same day share one
 * date block. `groupFeedByDay` (RN-free, unit-tested) does the grouping so this
 * screen stays presentational.
 */
export class Journal extends React.Component<IJournalProps, IJournalState> {
    private translate: Function;

    private theme = buildStyles();

    private themeMenu = buildMenuStyles();

    private themeJournal = buildJournalStyles();

    private unsubscribeFocus?: () => void;

    /**
     * Habit -> palette slot, rebuilt only when the habit list itself changes.
     *
     * Memoized on the array reference rather than recomputed per render because
     * every row in the feed reads it, and because rebuilding it mid-scroll
     * would be free to hand a habit a different slot — the probe order depends
     * on the whole list, so recomputing from a partially-loaded one is what
     * makes colors visibly jump.
     */
    private habitSwatchAssignment: Record<string, number> = {};

    private habitSwatchAssignmentSource: IUserHabit[] | null = null;

    constructor(props: IJournalProps) {
        super(props);

        this.state = {
            isRefreshing: false,
            isLoadingMore: false,
            isCreateMenuVisible: false,
            isComposerVisible: false,
            isSaving: false,
            editingEntry: null,
        };

        const themeName = props.user.settings?.mobileThemeName;
        this.theme = buildStyles(themeName);
        this.themeMenu = buildMenuStyles(themeName);
        this.themeJournal = buildJournalStyles(themeName);

        this.translate = (key: string, params: any) => translator(
            props.user.settings?.locale || 'en-us',
            key,
            params,
        );
    }

    componentDidMount() {
        const { navigation } = this.props;

        this.loadFeed();
        // The habit list backs the composer's tag chips. Failing to load it
        // degrades to an untagged-only composer rather than blocking the screen.
        this.props.getUserHabits('active').catch(() => null);

        // Re-fetch on focus: check-ins and achievements are created on other
        // screens, so a stale journal is the default without this.
        this.unsubscribeFocus = navigation.addListener('focus', () => {
            this.loadFeed();
        });
    }

    componentWillUnmount() {
        this.unsubscribeFocus?.();
    }

    getHabitSwatchAssignment = (userHabits: IUserHabit[]) => {
        if (userHabits !== this.habitSwatchAssignmentSource) {
            this.habitSwatchAssignmentSource = userHabits;
            this.habitSwatchAssignment = buildJournalSwatchAssignment(
                userHabits.map((habit) => habit.habitGoalId),
            );
        }

        return this.habitSwatchAssignment;
    };

    loadFeed = () => this.props.getJournalFeed({})
        .catch(() => {
            showToast.error({
                text1: this.translate('alertTitles.backendErrorMessage'),
                text2: this.translate('pages.journal.errors.loadFailed'),
            });
        });

    handleRefresh = () => {
        this.setState({ isRefreshing: true });

        return this.loadFeed().finally(() => {
            this.setState({ isRefreshing: false });
        });
    };

    handleLoadMore = () => {
        const { habits } = this.props;
        const { isLoadingMore } = this.state;

        // `journalCursor` is null once the feed is exhausted, so this also
        // guards against paging forever at the bottom of a short list.
        if (isLoadingMore || !habits.journalHasMore || !habits.journalCursor) {
            return;
        }

        this.setState({ isLoadingMore: true });

        this.props.getJournalFeed({ before: habits.journalCursor })
            .catch(() => null)
            .finally(() => {
                this.setState({ isLoadingMore: false });
            });
    };

    openCreateMenu = () => {
        this.setState({ isCreateMenuVisible: true });
    };

    closeCreateMenu = () => {
        this.setState({ isCreateMenuVisible: false });
    };

    /**
     * "Share a goal" hands off to the shared `EditThought` screen — the same
     * workflow the profile's Goals tab uses, deliberately not a second composer.
     * A goal is a thought, so it gets the thought form's public/private toggle,
     * category, hashtags and image, and lands in every feed that reads thoughts.
     *
     * `returnToRoute` sends the user back here after posting instead of to the
     * profile, and the screen's `focus` listener refetches on arrival.
     */
    handleCreateGoal = () => {
        const { navigation } = this.props;

        this.setState({ isCreateMenuVisible: false });
        navigation.navigate('EditThought', { returnToRoute: 'Journal' });
    };

    /**
     * A goal row is a thought, so tapping it opens the thought view rather than
     * the journal's composer — the post has replies, reactions and an image the
     * composer knows nothing about.
     *
     * `previousView` sends the back button here instead of to the profile, which
     * is where `ViewThought` sends users by default.
     */
    handleOpenGoal = (item: IJournalFeedItem) => {
        const { navigation, user } = this.props;

        navigation.navigate('ViewThought', {
            // The journal only ever contains the viewer's own posts.
            isMyContent: true,
            previousView: 'Journal',
            // Handed over whole rather than as a bare id: `ViewThought` renders
            // this immediately and merges its own fetch on top, so passing what
            // the feed already knows avoids an empty card on every tap. The
            // feed's `meta` carries the rest of what the card reads.
            thought: {
                id: item.id,
                message: item.body || '',
                fromUserId: user.details?.id,
                createdAt: item.occurredAt,
                updatedAt: item.occurredAt,
                category: item.meta?.category,
                isPublic: item.meta?.isPublic,
                hashTags: item.meta?.hashTags,
            },
            thoughtDetails: {},
        });
    };

    openComposer = (entry?: IJournalFeedItem) => {
        this.setState({
            isCreateMenuVisible: false,
            isComposerVisible: true,
            editingEntry: entry || null,
        });
    };

    closeComposer = () => {
        this.setState({ isComposerVisible: false, editingEntry: null });
    };

    handleSave = (body: string, habitGoalId: string | null) => {
        const { editingEntry } = this.state;

        this.setState({ isSaving: true });

        // The entry date is resolved on the device, because only it knows the
        // user's timezone: a note written at 23:40 must file under the day the
        // user experienced, not whatever UTC day the server is on.
        const entryDate = toLocalEntryDate(new Date());

        const request = editingEntry
            ? this.props.updateJournalEntry(editingEntry.id, { body, habitGoalId })
            : this.props.createJournalEntry({ body, habitGoalId, entryDate });

        return request
            .then(() => {
                this.closeComposer();
            })
            .catch(() => {
                showToast.error({
                    text1: this.translate('alertTitles.backendErrorMessage'),
                    text2: this.translate('pages.journal.errors.saveFailed'),
                });
            })
            .finally(() => {
                this.setState({ isSaving: false });
            });
    };

    renderSectionHeader = ({ section }: { section: IJournalDaySection }) => {
        if (!section.isFirstOfMonth) {
            return null;
        }

        return (
            <View style={this.themeJournal.styles.monthHeadingRow}>
                <Text style={this.themeJournal.styles.monthHeading}>{section.monthLabel}</Text>
                <View style={this.themeJournal.styles.monthHeadingRule} />
            </View>
        );
    };

    render() {
        const { habits, navigation, user } = this.props;
        const {
            isRefreshing,
            isLoadingMore,
            isCreateMenuVisible,
            isComposerVisible,
            isSaving,
            editingEntry,
        } = this.state;

        const userHabits = habits.userHabits || [];
        const habitSwatchAssignment = this.getHabitSwatchAssignment(userHabits);
        const sections = groupFeedByDay(
            habits.journalFeed || [],
            this.translate as (key: string, params?: any) => string,
            // Resolved per render rather than once at mount: the journal is a
            // screen people leave open, and a session that crosses midnight
            // would otherwise keep marking yesterday as today.
            toLocalEntryDate(new Date()),
        );

        return (
            <>
                <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
                <SafeAreaView edges={[]} style={[this.theme.styles.safeAreaView, { backgroundColor: this.theme.colors.backgroundGray }]}>
                    <View style={this.themeJournal.styles.container}>
                        <SectionList
                            sections={sections}
                            keyExtractor={(item: IJournalFeedItem) => `${item.type}-${item.id}`}
                            stickySectionHeadersEnabled={false}
                            contentContainerStyle={this.themeJournal.styles.listContent}
                            ListHeaderComponent={(
                                <View style={this.themeJournal.styles.header}>
                                    <Text style={this.themeJournal.styles.headerTitle}>
                                        {this.translate('pages.journal.headerTitle')}
                                    </Text>
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={this.translate('pages.journal.create.title')}
                                        style={this.themeJournal.styles.headerAction}
                                        onPress={this.openCreateMenu}
                                    >
                                        <MaterialIcon
                                            name="add"
                                            size={28}
                                            color={this.themeJournal.colors.onSurface}
                                        />
                                    </Pressable>
                                </View>
                            )}
                            renderSectionHeader={this.renderSectionHeader as any}
                            // The date rail belongs to the day, not to any one
                            // entry, so it is rendered once per section and the
                            // entries are stacked beside it.
                            renderItem={({ item, index, section }) => {
                                const { isToday } = section as IJournalDaySection;

                                return (
                                    <View style={this.themeJournal.styles.dayRow}>
                                        <View style={this.themeJournal.styles.dateBlock}>
                                            {index === 0 && (
                                                <View style={[
                                                    this.themeJournal.styles.dateCard,
                                                    isToday && this.themeJournal.styles.dateCardToday,
                                                ]}
                                                >
                                                    <Text style={[
                                                        this.themeJournal.styles.dateWeekday,
                                                        isToday && this.themeJournal.styles.dateTextToday,
                                                    ]}
                                                    >
                                                        {(section as IJournalDaySection).weekdayLabel}
                                                    </Text>
                                                    <Text style={[
                                                        this.themeJournal.styles.dateDay,
                                                        isToday && this.themeJournal.styles.dateTextToday,
                                                    ]}
                                                    >
                                                        {(section as IJournalDaySection).dayOfMonth}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                        <View style={this.themeJournal.styles.entryColumn}>
                                            <JournalEntryRow
                                                item={item}
                                                locale={user.settings?.locale || 'en-us'}
                                                themeJournal={this.themeJournal}
                                                swatch={resolveJournalSwatch(
                                                    item,
                                                    this.themeJournal.palette,
                                                    this.themeJournal.typePalette,
                                                    habitSwatchAssignment,
                                                )}
                                                translate={this.translate as (key: string, params?: any) => string}
                                                onPress={this.openComposer}
                                                onPressGoal={this.handleOpenGoal}
                                            />
                                        </View>
                                    </View>
                                );
                            }}
                            refreshControl={(
                                <RefreshControl
                                    refreshing={isRefreshing}
                                    onRefresh={this.handleRefresh}
                                />
                            )}
                            onEndReached={this.handleLoadMore}
                            onEndReachedThreshold={0.4}
                            ListFooterComponent={isLoadingMore ? (
                                <View style={this.themeJournal.styles.footerLoading}>
                                    <ActivityIndicator size="small" color={this.themeJournal.colors.brand} />
                                </View>
                            ) : null}
                            ListEmptyComponent={habits.isLoading ? null : (
                                <View style={this.themeJournal.styles.emptyContainer}>
                                    <Text style={this.themeJournal.styles.emptyTitle}>
                                        {this.translate('pages.journal.empty.title')}
                                    </Text>
                                    <Text style={this.themeJournal.styles.emptySubtitle}>
                                        {this.translate('pages.journal.empty.subtitle')}
                                    </Text>
                                </View>
                            )}
                        />
                    </View>
                </SafeAreaView>
                <JournalCreateMenu
                    isVisible={isCreateMenuVisible}
                    themeJournal={this.themeJournal}
                    translate={this.translate as (key: string, params?: any) => string}
                    onCancel={this.closeCreateMenu}
                    onSelectEntry={() => this.openComposer()}
                    onSelectGoal={this.handleCreateGoal}
                />
                <JournalComposer
                    isVisible={isComposerVisible}
                    isSaving={isSaving}
                    habits={userHabits}
                    habitSwatchAssignment={habitSwatchAssignment}
                    initialBody={editingEntry?.body || ''}
                    initialHabitGoalId={editingEntry?.habitGoalId || null}
                    themeJournal={this.themeJournal}
                    translate={this.translate as (key: string, params?: any) => string}
                    onCancel={this.closeComposer}
                    onSave={this.handleSave}
                />
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

export default connect(mapStateToProps, mapDispatchToProps)(Journal);
