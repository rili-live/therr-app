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
import { IHabitsState, IJournalFeedItem, IUserState } from 'therr-react/types';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import BaseStatusBar from '../../components/BaseStatusBar';
import translator from '../../utilities/translator';
import { showToast } from '../../utilities/toasts';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildJournalStyles } from '../../styles/habits/journal';
import { groupFeedByDay, IJournalDaySection } from './journalGrouping';
import JournalEntryRow from './JournalEntryRow';
import JournalComposer from './JournalComposer';

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

    constructor(props: IJournalProps) {
        super(props);

        this.state = {
            isRefreshing: false,
            isLoadingMore: false,
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

    openComposer = (entry?: IJournalFeedItem) => {
        this.setState({ isComposerVisible: true, editingEntry: entry || null });
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
        const now = new Date();
        const entryDate = [
            now.getFullYear(),
            `${now.getMonth() + 1}`.padStart(2, '0'),
            `${now.getDate()}`.padStart(2, '0'),
        ].join('-');

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
            <Text style={this.themeJournal.styles.monthHeading}>{section.monthLabel}</Text>
        );
    };

    render() {
        const { habits, navigation, user } = this.props;
        const {
            isRefreshing,
            isLoadingMore,
            isComposerVisible,
            isSaving,
            editingEntry,
        } = this.state;

        const sections = groupFeedByDay(
            habits.journalFeed || [],
            this.translate as (key: string, params?: any) => string,
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
                                        accessibilityLabel={this.translate('pages.journal.composer.title')}
                                        style={this.themeJournal.styles.headerAction}
                                        onPress={() => this.openComposer()}
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
                            renderItem={({ item, index, section }) => (
                                <View style={this.themeJournal.styles.dayRow}>
                                    <View style={this.themeJournal.styles.dateBlock}>
                                        {index === 0 && (
                                            <View style={this.themeJournal.styles.dateCard}>
                                                <Text style={this.themeJournal.styles.dateWeekday}>
                                                    {(section as IJournalDaySection).weekdayLabel}
                                                </Text>
                                                <Text style={this.themeJournal.styles.dateDay}>
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
                                            translate={this.translate as (key: string, params?: any) => string}
                                            onPress={this.openComposer}
                                        />
                                    </View>
                                </View>
                            )}
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
                                    <ActivityIndicator size="small" color={this.themeJournal.colors.primary} />
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
                <JournalComposer
                    isVisible={isComposerVisible}
                    isSaving={isSaving}
                    habits={habits.userHabits || []}
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
