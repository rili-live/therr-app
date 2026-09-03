import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import RNFB from 'react-native-blob-util';
import { FeatureFlags, FilePaths } from 'therr-js-utilities/constants';
import { HabitActions } from 'therr-react/redux/actions';
import {
    IUserState, IHabitsState, IHabitGoal, IHabitCheckin, IStreak, IPact, IPactNudgeResult,
} from 'therr-react/types';
import { FlatList, RefreshControl } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import translator from '../../utilities/translator';
import permissions from '../../utilities/permissionsOrchestrator';
import isPactInviteAwaitingResponse from '../../utilities/pactInviteState';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import { buildStyles as buildConfirmModalStyles } from '../../styles/modal/confirmModal';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import BaseStatusBar from '../../components/BaseStatusBar';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import {
    HabitCard, CheckinProofSheet, NewPactButton, PactCard, SentInviteCard,
} from '../../components/Habits';
import { ISelectedProofImage } from '../../components/Habits/CheckinProofSheet';
import { getFreezeConsumed, getStreakSavedByFreeze } from '../../utilities/streakFreezes';
import PactOnboardingGuard from '../../components/Habits/PactOnboardingGuard';
import { signImageUrl } from '../../utilities/content';
import { DURATION, showToast } from '../../utilities/toasts';
import { IHabitWithPactState, isPactSuperseded, splitHabitsByPactState } from './pactState';
import { getNudgeErrorMessage, getNudgeOutcomeToast } from '../Pacts/nudgeOutcome';
import { getSoloUnlockProgress } from '../../utilities/soloHabitUnlock';
import getConfig from '../../utilities/getConfig';

/**
 * The habits dashboard and the pacts list used to be two screens showing two
 * views of the same data — a habit with a live pact appeared on both, once as a
 * check-in card and once as a pact card. They are one screen now, laid out the
 * way the pacts list was: a header, a segmented control, and a single list.
 *
 * The old "Active" pact segment is what the Habits segment replaced; an active
 * pact is a habit you can check in on, and that is the more useful way to show
 * it. Every pact, active ones included, is still listed under "All".
 */
export type HabitsTab = 'habits' | 'pending' | 'outgoing' | 'all';

const TABS: HabitsTab[] = ['habits', 'pending', 'outgoing', 'all'];

/**
 * Segments that show pacts rather than habits. Two things key off this set:
 * the onboarding guard is bypassed when the screen is opened directly onto one
 * of them (see `isOnboardingBypassed`), and they are the segments that
 * disappear when ENABLE_PACTS is off.
 */
const PACT_TABS: HabitsTab[] = ['pending', 'outgoing', 'all'];

/**
 * The 'pending' segment is labelled "Invites", not "Pending".
 *
 * It used to reuse `pages.pacts.status.pending` — the very same string the pact
 * status badge renders — so the word "Pending" meant two different things on one
 * screen: the segment meant "invites waiting on *you*", while the badge meant
 * "this pact has not started yet". A user with two sent invites therefore saw an
 * empty "Pending" segment next to an "All" segment listing two pacts badged
 * "Pending". The segment name and the badge vocabulary are kept disjoint here
 * and in `PactCard.getStatusText` so that can't recur.
 */
export const TAB_LABEL_KEYS: Record<HabitsTab, string> = {
    habits: 'pages.habits.tabs.habits',
    pending: 'pages.pacts.invitesTabLabel',
    outgoing: 'pages.pacts.outgoing.tabLabel',
    all: 'pages.pacts.allTabLabel',
};

/**
 * `initialTab` reaches this screen from push-notification routing, the pact
 * preview overlay and the tab bar. 'active' is the name the pacts list used for
 * the segment the Habits segment replaced, so it is still accepted — an
 * in-flight notification tapped after an upgrade must not land on nothing.
 */
export const normalizeInitialTab = (initialTab?: string): HabitsTab => {
    if (initialTab === 'active') {
        return 'habits';
    }

    return TABS.includes(initialTab as HabitsTab) ? (initialTab as HabitsTab) : 'habits';
};

type IHabitsRow =
    | { key: string; kind: 'sectionTitle'; title: string }
    | { key: string; kind: 'habit'; entry: IHabitWithPactState; isAwaitingPartner: boolean };

interface IHabitsDashboardDispatchProps {
    getUserGoals: Function;
    getTodayCheckins: Function;
    getActiveStreaks: Function;
    getActivePacts: Function;
    getUserPacts: Function;
    getPendingInvites: Function;
    getUserHabitEligibility: Function;
    createCheckin: Function;
    acceptPact: Function;
    declinePact: Function;
    nudgePact: Function;
    renewPact: Function;
}

interface IStoreProps extends IHabitsDashboardDispatchProps {
    user: IUserState;
    habits: IHabitsState;
}

export interface IHabitsDashboardProps extends IStoreProps {
    navigation: any;
    route?: { params?: { initialTab?: string } };
}

interface IHabitsDashboardState {
    isRefreshing: boolean;
    activeTab: HabitsTab;
    checkinLoadingIds: Set<string>;
    proofSheetHabit: IHabitGoal | null;
    isSubmittingCheckin: boolean;
    respondingPactId: string | null;
    renewingPactId: string | null;
    nudgingPactId: string | null;
    pactIdPendingDecline: string | null;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    habits: state.habits,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getUserGoals: HabitActions.getUserGoals,
    getTodayCheckins: HabitActions.getTodayCheckins,
    getActiveStreaks: HabitActions.getActiveStreaks,
    getActivePacts: HabitActions.getActivePacts,
    getUserPacts: HabitActions.getUserPacts,
    getPendingInvites: HabitActions.getPendingInvites,
    getUserHabitEligibility: HabitActions.getUserHabitEligibility,
    createCheckin: HabitActions.createCheckin,
    acceptPact: HabitActions.acceptPact,
    declinePact: HabitActions.declinePact,
    nudgePact: HabitActions.nudgePact,
    renewPact: HabitActions.renewPact,
}, dispatch);

export class HabitsDashboard extends React.Component<IHabitsDashboardProps, IHabitsDashboardState> {
    private translate: (key: string, params?: any) => string;
    private theme = buildStyles();
    private themeMenu = buildMenuStyles();
    private themeHabits = buildHabitStyles();
    private themeConfirmModal = buildConfirmModalStyles();
    private themeButtons = buildButtonsStyles();
    private unsubscribeNavigationListener: any;

    /**
     * Memo for the habits segment, keyed on the identity of the four Redux inputs it
     * derives from.
     *
     * Two reasons, and the second is the one that bites. `getHabitsByPactState` runs on
     * every render and `render` calls it twice — once for the rows, once for the list
     * header's progress summary. And rebuilding a fresh row object per render defeats
     * FlatList's cell memoization outright: every cell re-renders on every keystroke of
     * unrelated state, which is exactly what `extraData` exists to make unnecessary.
     *
     * `this.translate` is bound to the constructor's locale and a locale change remounts
     * the screen, so it does not belong in the key.
     */
    private habitsRowsMemo: {
        habitGoals: any;
        activePacts: any;
        pacts: any;
        userId?: string;
        split: { live: IHabitWithPactState[]; pending: IHabitWithPactState[] };
        rows: IHabitsRow[];
    } | null = null;

    constructor(props: IHabitsDashboardProps) {
        super(props);

        this.state = {
            isRefreshing: false,
            activeTab: normalizeInitialTab(props.route?.params?.initialTab),
            checkinLoadingIds: new Set(),
            proofSheetHabit: null,
            isSubmittingCheckin: false,
            respondingPactId: null,
            renewingPactId: null,
            nudgingPactId: null,
            pactIdPendingDecline: null,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeHabits = buildHabitStyles(props.user.settings?.mobileThemeName);
        this.themeConfirmModal = buildConfirmModalStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params?: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount = () => {
        this.props.navigation.setOptions({
            title: this.translate('pages.habits.headerTitle'),
        });

        this.unsubscribeNavigationListener = this.props.navigation.addListener('focus', () => {
            this.handleRefresh();
        });

        this.handleRefresh();
    };

    componentDidUpdate(prevProps: IHabitsDashboardProps) {
        const nextInitialTab = this.props.route?.params?.initialTab;
        const prevInitialTab = prevProps.route?.params?.initialTab;
        if (nextInitialTab && nextInitialTab !== prevInitialTab) {
            this.setState({ activeTab: normalizeInitialTab(nextInitialTab) });
        }
    }

    componentWillUnmount() {
        if (this.unsubscribeNavigationListener) {
            this.unsubscribeNavigationListener();
        }
    }

    /**
     * Pacts get their own segments only where the flag is on. With it off this
     * is the habits dashboard and nothing else — no segmented control, no way
     * to reach a list that would always be empty.
     */
    arePactsEnabled = (): boolean => getConfig().featureFlags?.[FeatureFlags.ENABLE_PACTS] === true;

    /**
     * The segment actually being shown. With pacts switched off there is no
     * segmented control to switch back with, so a pact segment carried in on
     * `initialTab` would strand the user on a list that can only ever be empty.
     */
    getEffectiveTab = (): HabitsTab => (this.arePactsEnabled() ? this.state.activeTab : 'habits');

    /**
     * The onboarding overlay renders in place of this screen until the user has
     * started, which would otherwise swallow the two entry points that exist
     * precisely for users who have not: the "you have invites waiting"
     * notification and the overlay's own link to them. Opening straight onto a
     * pact segment therefore skips the guard. Reaching the screen from the tab
     * bar (which asks for the Habits segment) still gets the full gate.
     */
    isOnboardingBypassed = (): boolean => PACT_TABS.includes(
        this.props.route?.params?.initialTab as HabitsTab,
    );

    handleRefresh = () => {
        const {
            getUserGoals, getTodayCheckins, getActiveStreaks, getActivePacts, getUserPacts,
            getPendingInvites, getUserHabitEligibility,
        } = this.props;

        this.setState({ isRefreshing: true });

        Promise.all([
            getUserGoals(),
            getTodayCheckins(),
            getActiveStreaks(),
            getActivePacts(),
            // Needed to tell a habit whose pact is live apart from one whose
            // invite is still outstanding — getActivePacts only returns the former.
            getUserPacts(),
            getPendingInvites(),
            // Feeds the solo-unlock banner below, and the same progress on the
            // onboarding overlay — which renders in place of this screen's
            // children and so never gets a fetch of its own. Failing drops the
            // progress line rather than blocking the whole refresh.
            getUserHabitEligibility().catch(() => {}),
        ]).finally(() => {
            this.setState({ isRefreshing: false });
        });
    };

    /**
     * The primary check-in action. It commits immediately rather than opening
     * the proof sheet first.
     *
     * Duolingo's largest published retention win came from lowering the bar to
     * extend a streak (a single lesson, not the full daily goal): +3.3% D14
     * retention and +10.5% daily learners on a streak. Nothing in the proof
     * sheet was ever required — `onConfirm` accepts an empty note and no photo
     * — so gating the one action the product depends on behind a modal and a
     * second tap was pure friction. Proof is now something you *add*, offered
     * on the success toast, not something you pass through.
     */
    handleCheckin = (habitGoal: IHabitGoal) => {
        this.submitCheckin(habitGoal, {});
    };

    /**
     * Re-opens the sheet against a check-in that already exists, to attach a
     * note or photo to it. Safe to confirm: the users-service upsert merges
     * onto the same (habitGoalId, date) row and its same-day branch returns
     * before crediting the streak again, awarding XP again or re-notifying
     * partners.
     */
    handleAddCheckinDetail = (habitGoal: IHabitGoal) => {
        Toast.hide();
        this.setState({ proofSheetHabit: habitGoal });
    };

    handleProofSheetCancel = () => {
        this.setState({ proofSheetHabit: null });
    };

    uploadProofImage = (habitGoalId: string, image: ISelectedProofImage): Promise<{ path: string; type: 'image'; fileSizeBytes?: number }> => {
        const extSplit = image.path?.split('.');
        const fileExtension = extSplit && extSplit.length > 1 ? extSplit[extSplit.length - 1] : 'jpeg';
        const filename = `${FilePaths.CONTENT}/habits_proof_${habitGoalId}_${Date.now()}.${fileExtension}`;

        return signImageUrl(false, { action: 'write', filename }).then((response: any) => {
            const signedUrl = response?.data?.url && response?.data?.url[0];
            const storedPath = response?.data?.path;
            return RNFB.fetch(
                'PUT',
                signedUrl,
                {
                    'Content-Type': image.mime,
                    'Content-Length': image.size.toString(),
                    'Content-Disposition': 'inline',
                },
                RNFB.wrap(image.path),
            ).then(() => ({
                path: storedPath,
                type: 'image' as const,
                fileSizeBytes: image.size,
            }));
        });
    };

    handleProofSheetConfirm = ({ notes, image }: { notes?: string; image?: ISelectedProofImage }) => {
        const { proofSheetHabit } = this.state;

        if (!proofSheetHabit) {
            return;
        }

        this.submitCheckin(proofSheetHabit, { notes, image });
    };

    /**
     * The single write path for both entry points — the one-tap button and the
     * proof sheet. `scheduledDate` stays on the UTC calendar day deliberately:
     * users-service defines a habit day in UTC (`getTodayDateString` in
     * `utilities/streakHelpers.ts`), so the local-calendar `toLocalDateKey`
     * used for rendering the month grid would key the write to a different day.
     */
    submitCheckin = (
        habitGoal: IHabitGoal,
        { notes, image }: { notes?: string; image?: ISelectedProofImage },
    ) => {
        const { createCheckin, getActiveStreaks } = this.props;
        const { checkinLoadingIds } = this.state;

        const habitGoalId = habitGoal.id;
        const isAddingDetail = !!notes || !!image;
        const newLoadingIds = new Set(checkinLoadingIds);
        newLoadingIds.add(habitGoalId);
        this.setState({
            checkinLoadingIds: newLoadingIds,
            isSubmittingCheckin: true,
        });

        const today = new Date().toISOString().split('T')[0];

        const uploadPromise = image
            ? this.uploadProofImage(habitGoalId, image).then((media) => [media])
            : Promise.resolve(undefined);

        uploadPromise
            .then((proofMedias) => createCheckin({
                habitGoalId,
                scheduledDate: today,
                status: 'completed',
                notes,
                proofMedias,
            }))
            .then((checkin: any) => {
                if (isAddingDetail) {
                    showToast.success({
                        text1: this.translate('pages.habits.checkinToast.detailSavedTitle'),
                    });
                    return;
                }

                // The streak is the reward for the tap, so it has to move now.
                // CREATE_CHECKIN only updates today's checkins in Redux — the
                // card's streak count comes from `habits.streaks`, which is
                // otherwise only refetched on a pull-to-refresh or re-focus.
                getActiveStreaks().catch(() => {});

                // The toast is the confirmation that replaced the modal, and
                // it is also the only route to the proof sheet now — so it has
                // to say it is tappable (nothing about the styling signals it).
                //
                // When a freeze covered a missed day it takes over the copy:
                // the streak surviving is the more surprising fact, and it is
                // the only place the user learns the net exists at the moment
                // it caught them.
                const freezeConsumed = getFreezeConsumed(checkin);
                showToast.success({
                    text1: freezeConsumed
                        ? this.translate('pages.habits.checkinToast.freezeUsedTitle', {
                            count: getStreakSavedByFreeze(checkin),
                        })
                        : this.translate('pages.habits.checkinToast.title', { habitName: habitGoal.name }),
                    text2: freezeConsumed
                        ? this.translate('pages.habits.checkinToast.freezeUsedBody')
                        : this.translate('pages.habits.checkinToast.addDetailAction'),
                    duration: DURATION.LONG,
                    onPress: () => this.handleAddCheckinDetail(habitGoal),
                });
            })
            .catch((err) => {
                showToast.error({
                    text1: this.translate('alertTitles.backendErrorMessage'),
                    text2: err?.message || this.translate('pages.habits.checkinProof.uploadFailed'),
                });
            })
            .finally(() => {
                const updatedLoadingIds = new Set(this.state.checkinLoadingIds);
                updatedLoadingIds.delete(habitGoalId);
                this.setState({
                    checkinLoadingIds: updatedLoadingIds,
                    isSubmittingCheckin: false,
                    proofSheetHabit: null,
                });
            });
    };

    handleHabitPress = (habitGoal: IHabitGoal) => {
        const { navigation } = this.props;
        navigation.navigate('HabitDetail', { habitGoalId: habitGoal.id });
    };

    handlePactPress = (pact: IPact) => {
        const { navigation } = this.props;
        navigation.navigate('PactDetail', { pactId: pact.id });
    };

    /**
     * Opens the other side of a renewal boundary — the cycle a pact continues, or the
     * cycle that continues it.
     *
     * Takes an id rather than a pact because the target is frequently not in this
     * screen's list: the list read leaves superseded cycles out, which is the point.
     * `PactDetail` fetches by id, so the link works whether or not the pact is loaded
     * here.
     */
    handleViewLineagePact = (pactId: string) => {
        const { navigation } = this.props;
        navigation.navigate('PactDetail', { pactId });
    };

    // The invite wizard is the single creation flow: it creates the habit goal
    // (from a template or a custom name) and sends the pact invites together.
    // Shared by the floating action, the empty states, and the Sent-tab card's
    // "invite someone else" link.
    handleCreatePact = () => {
        const { navigation } = this.props;
        navigation.navigate('CreatePactInvite');
    };

    handleAcceptInvite = (pact: IPact) => {
        const { acceptPact } = this.props;

        this.setState({ respondingPactId: pact.id });

        acceptPact(pact.id)
            .then(() => {
                showToast.success({
                    text1: this.translate('pages.pacts.acceptedTitle'),
                    text2: this.translate('pages.pacts.acceptedMessage'),
                    duration: DURATION.SHORT,
                });
                permissions.requestIfAppropriate('notifications', { trigger: 'pactAccept' });
                // The pact is live now, which makes its habit checkin-able —
                // send the user to the segment where that happens.
                this.setState({ activeTab: 'habits' });
                this.handleRefresh();
            })
            .catch(() => {
                showToast.error({
                    text1: this.translate('pages.pacts.errorTitle'),
                    text2: this.translate('pages.pacts.acceptError'),
                    duration: DURATION.SHORT,
                });
            })
            .finally(() => {
                this.setState({ respondingPactId: null });
            });
    };

    formatNudgeDate = (isoDate: string): string => {
        const { user } = this.props;

        return new Date(isoDate).toLocaleDateString(user.settings?.locale || 'en-us', {
            month: 'short',
            day: 'numeric',
        });
    };

    handleNudge = (pact: IPact) => {
        const { nudgePact } = this.props;

        this.setState({ nudgingPactId: pact.id });

        nudgePact(pact.id)
            .then((response: any) => {
                // The endpoint answers 200 even when nothing was sent: the 7-day per-partner
                // cooldown, partners with no reachable channel, and per-partner dispatch
                // failures are all reported inside `nudgeResults`, not as an HTTP error.
                // Reading only the status would tell the user "Nudge sent!" when no nudge
                // went out. See `nudgeOutcome.ts` for how each case is worded.
                const results: IPactNudgeResult[] = response?.nudgeResults || [];
                const toast = getNudgeOutcomeToast(results, this.formatNudgeDate);

                showToast[toast.type]({
                    text1: this.translate(toast.key, toast.params),
                    // Partial and undeliverable outcomes need a sentence of explanation; a
                    // plain success or cooldown says everything in its headline.
                    duration: toast.type === 'success' ? DURATION.SHORT : DURATION.LONG,
                });

                this.handleRefresh();
            })
            .catch((error: any) => {
                // The API's rejection body is already localized and names the actual reason
                // (not the creator, pact no longer pending, nobody left to nudge). Prefer it
                // over this screen's generic copy.
                const { key, message } = getNudgeErrorMessage(error);

                showToast.error({
                    text1: this.translate('pages.pacts.errorTitle'),
                    text2: message || this.translate(key as string),
                    duration: DURATION.LONG,
                });
            })
            .finally(() => {
                this.setState({ nudgingPactId: null });
            });
    };

    /**
     * Re-commit to a pact whose cycle has ended, for another window of the same
     * length.
     *
     * The duration is deliberately not asked for. The gamification evidence
     * behind this feature is that a *fixed* cycle is the mechanic — the RCT
     * meta-analysis it comes from measures renewal, not length — and § 2.6.1
     * already established here that lowering the bar on the committing action
     * beats adding choice to it. `renewPact` with no override reuses the
     * previous cycle's `durationDays`.
     *
     * A renewal is a new pact, not a mutation of the old one, so the streak in
     * `habits.streaks` is untouched and carries across the boundary. That is
     * load-bearing: a renewal that reset the streak would turn the strongest
     * mechanic in the loop into its worst failure mode, on a day the user did
     * nothing wrong.
     */
    handleRenewPact = (pact: IPact) => {
        const { renewPact } = this.props;

        this.setState({ renewingPactId: pact.id });

        renewPact(pact.id)
            .then(() => {
                showToast.success({
                    text1: this.translate('pages.pacts.renew.successTitle'),
                    text2: this.translate('pages.pacts.renew.successMessage', {
                        days: pact.durationDays,
                    }),
                    duration: DURATION.DEFAULT,
                });

                this.handleRefresh();
            })
            .catch((error: any) => {
                // The server re-checks renewability and 409s a stale CTA — most often
                // because someone else already renewed this pact, leaving a live cycle
                // on the habit. Its body is localized and names the actual reason, and
                // the axios interceptor rejects with that body verbatim (hence
                // `error.message`, not `error.response.data`), so prefer it. A rejection
                // carrying no `statusCode` never reached the API at all.
                const apiMessage = error?.statusCode && typeof error?.message === 'string'
                    ? error.message
                    : '';

                showToast.error({
                    text1: this.translate('pages.pacts.errorTitle'),
                    text2: apiMessage || this.translate('pages.pacts.renew.error'),
                    duration: DURATION.LONG,
                });

                // The likeliest rejection means the list this CTA was drawn from is out
                // of date, so refetch rather than leave a button that fails again on the
                // next tap.
                this.handleRefresh();
            })
            .finally(() => {
                this.setState({ renewingPactId: null });
            });
    };

    handleDeclineInvitePress = (pact: IPact) => {
        this.setState({ pactIdPendingDecline: pact.id });
    };

    handleCancelDecline = () => {
        this.setState({ pactIdPendingDecline: null });
    };

    handleConfirmDecline = () => {
        const { declinePact } = this.props;
        const { pactIdPendingDecline } = this.state;

        if (!pactIdPendingDecline) {
            return;
        }

        this.setState({
            respondingPactId: pactIdPendingDecline,
            pactIdPendingDecline: null,
        });

        declinePact(pactIdPendingDecline)
            .then(() => {
                showToast.success({
                    text1: this.translate('pages.pacts.successTitle'),
                    text2: this.translate('pages.pacts.declinedMessage'),
                    duration: DURATION.SHORT,
                });
                this.handleRefresh();
            })
            .catch(() => {
                showToast.error({
                    text1: this.translate('pages.pacts.errorTitle'),
                    text2: this.translate('pages.pacts.declineError'),
                    duration: DURATION.SHORT,
                });
            })
            .finally(() => {
                this.setState({ respondingPactId: null });
            });
    };

    setActiveTab = (tab: HabitsTab) => {
        this.setState({ activeTab: tab });
    };

    getTodayCheckinForHabit = (habitGoalId: string): IHabitCheckin | undefined => {
        const { habits } = this.props;
        return habits.todayCheckins.find((c: IHabitCheckin) => c.habitGoalId === habitGoalId);
    };

    getStreakForHabit = (habitGoalId: string): IStreak | undefined => {
        const { habits } = this.props;
        return habits.activeStreaks.find((s: IStreak) => s.habitGoalId === habitGoalId);
    };

    /**
     * Recomputes the split and the rows together, or returns the memo when none of the
     * four inputs has moved. Both derivations share one entry because both are pure
     * functions of the same inputs and both are read on every render.
     */
    private getHabitsMemo = () => {
        const { habits, user } = this.props;
        const habitGoals = habits.habitGoals || [];
        const activePacts = habits.activePacts || [];
        const pacts = habits.pacts || [];
        const userId = user.details?.id;
        const memo = this.habitsRowsMemo;

        if (memo
            && memo.habitGoals === habitGoals
            && memo.activePacts === activePacts
            && memo.pacts === pacts
            && memo.userId === userId) {
            return memo;
        }

        const split = splitHabitsByPactState(habitGoals, activePacts, pacts, userId);

        this.habitsRowsMemo = {
            habitGoals,
            activePacts,
            pacts,
            userId,
            split,
            rows: this.buildHabitsRows(split),
        };

        return this.habitsRowsMemo;
    };

    getHabitsByPactState = () => this.getHabitsMemo().split;

    getOutgoingInvites = (): IPact[] => {
        const { habits, user } = this.props;
        const currentUserId = user.details?.id || '';
        return (habits.pacts || []).filter(
            (p) => p.status === 'pending' && p.creatorUserId === currentUserId,
        );
    };

    isPendingInviteForMe = (pact: IPact): boolean => {
        const { habits, user } = this.props;
        // The server-computed invite list is authoritative (and is the only
        // signal on pending invites, which come back without member rows);
        // fall back to the member/partner fields for pacts surfaced by the
        // other tabs.
        return (habits.pendingInvites || []).some((invite) => invite.id === pact.id)
            || isPactInviteAwaitingResponse(pact, user.details?.id);
    };

    getPactsList = (): IPact[] => {
        const { habits } = this.props;

        switch (this.getEffectiveTab()) {
            case 'pending':
                return habits.pendingInvites || [];
            case 'outgoing':
                return this.getOutgoingInvites();
            case 'all':
            default:
                // Superseded cycles are already left out of the list read. They are
                // filtered again here because `getPactDetails` upserts whatever it
                // fetches into this same list — so opening an old cycle through a
                // successor's "extended from" link would otherwise put it back on the
                // dashboard, next to the cycle that replaced it, which is the exact
                // duplicate this work removes.
                return (habits.pacts || []).filter((pact) => !isPactSuperseded(pact));
        }
    };

    /**
     * The habits segment is two titled groups in one virtualized list rather
     * than two `.map()`ed sections in a ScrollView, so that it can share the
     * FlatList the pact segments use instead of nesting one inside a scroll
     * view.
     */
    getHabitsRows = (): IHabitsRow[] => this.getHabitsMemo().rows;

    private buildHabitsRows = (
        { live, pending }: { live: IHabitWithPactState[]; pending: IHabitWithPactState[] },
    ): IHabitsRow[] => {
        const rows: IHabitsRow[] = [];

        if (live.length > 0) {
            rows.push({
                key: 'section-live',
                kind: 'sectionTitle',
                title: this.translate('pages.habits.yourHabits'),
            });
            live.forEach((entry) => rows.push({
                key: `habit-${entry.goal.id}`,
                kind: 'habit',
                entry,
                isAwaitingPartner: false,
            }));
        }

        if (pending.length > 0) {
            rows.push({
                key: 'section-pending',
                kind: 'sectionTitle',
                title: this.translate('pages.habits.pendingHabits'),
            });
            pending.forEach((entry) => rows.push({
                key: `habit-${entry.goal.id}`,
                kind: 'habit',
                entry,
                isAwaitingPartner: true,
            }));
        }

        return rows;
    };

    getGreeting = (): string => {
        const hour = new Date().getHours();
        if (hour < 12) {return this.translate('pages.habits.greetingMorning');}
        if (hour < 18) {return this.translate('pages.habits.greetingAfternoon');}
        return this.translate('pages.habits.greetingEvening');
    };

    /**
     * Progress toward unlocking habits tracked alone.
     *
     * The onboarding overlay carries this too, but it stops rendering the
     * moment a user sends their first invite — which is exactly when they have
     * two invites left to go and the most reason to be told so. This screen is
     * the one they return to daily, so this is where a partial unlock stays
     * visible. It disappears the moment it is earned.
     */
    renderSoloUnlockBanner = () => {
        const { habits } = this.props;
        const { isUnlocked, hasProgress, invitedCount, requiredCount, remaining } = getSoloUnlockProgress(
            habits.userHabitEligibility,
            getConfig().featureFlags?.[FeatureFlags.ENABLE_HABITS_SOLO] === true,
        );

        if (isUnlocked || !hasProgress) {
            return null;
        }

        const title = this.translate('pages.habits.soloUnlockBannerTitle', { remaining });
        const body = this.translate('pages.habits.soloUnlockBannerBody', {
            invited: invitedCount,
            required: requiredCount,
        });

        return (
            <Pressable
                accessibilityRole="button"
                // Both lines, because an explicit label replaces the text the
                // children would otherwise compose. Titling it alone announced
                // the ask ("invite 2 more friends") while dropping the progress
                // that makes it feel finishable — the whole point of the banner.
                accessibilityLabel={`${title}. ${body}`}
                onPress={this.handleCreatePact}
                style={this.themeHabits.styles.dashboardSection}
            >
                <Text style={this.themeHabits.styles.dashboardSectionTitle}>{title}</Text>
                <Text style={this.themeHabits.styles.dashboardSubtitle}>{body}</Text>
            </Pressable>
        );
    };

    renderOverallProgress = (liveHabits: IHabitWithPactState[]) => {
        const { habits } = this.props;
        const { activeStreaks, todayCheckins } = habits;

        if (liveHabits.length === 0) {
            return null;
        }

        // Only habits with a live pact are checkin-able, so counting the
        // pending ones in the denominator would make "today" unreachable.
        const liveGoalIds = liveHabits.map(({ goal }) => goal.id);
        const completedToday = todayCheckins.filter(
            (c: IHabitCheckin) => c.status === 'completed' && liveGoalIds.includes(c.habitGoalId),
        ).length;
        const totalHabits = liveHabits.length;
        const longestStreak = activeStreaks.reduce(
            (max: number, s: IStreak) => Math.max(max, s.currentStreak),
            0,
        );

        return (
            <View style={this.themeHabits.styles.streakWidgetContainer}>
                <View style={this.themeHabits.styles.pactComparisonContainer}>
                    <View style={this.themeHabits.styles.pactComparisonItem}>
                        <Text style={this.themeHabits.styles.pactComparisonValue}>
                            {completedToday}/{totalHabits}
                        </Text>
                        <Text style={this.themeHabits.styles.pactComparisonLabel}>
                            {this.translate('pages.habits.todayProgress')}
                        </Text>
                    </View>
                    <View style={this.themeHabits.styles.pactComparisonItem}>
                        <Text style={this.themeHabits.styles.pactComparisonValue}>
                            {longestStreak}
                        </Text>
                        <Text style={this.themeHabits.styles.pactComparisonLabel}>
                            {this.translate('pages.habits.bestStreak')}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    renderHabitsListHeader = () => (
        <>
            {this.renderSoloUnlockBanner()}
            {this.renderOverallProgress(this.getHabitsByPactState().live)}
        </>
    );

    renderHabitsRow = ({ item }: { item: IHabitsRow }) => {
        const { checkinLoadingIds } = this.state;

        if (item.kind === 'sectionTitle') {
            return (
                <Text style={[
                    this.themeHabits.styles.dashboardSectionTitle,
                    this.themeHabits.styles.dashboardSection,
                ]}>
                    {item.title}
                </Text>
            );
        }

        const { goal, partnerNames, awaitingPartnerNames } = item.entry;

        return (
            <HabitCard
                habitGoal={goal}
                todayCheckin={this.getTodayCheckinForHabit(goal.id)}
                streak={this.getStreakForHabit(goal.id)}
                onPress={() => this.handleHabitPress(goal)}
                onCheckin={() => this.handleCheckin(goal)}
                isCheckinLoading={checkinLoadingIds.has(goal.id)}
                showStreak={true}
                isAwaitingPartner={item.isAwaitingPartner}
                awaitingPartnerNames={awaitingPartnerNames}
                partnerNames={partnerNames}
                themeHabits={this.themeHabits}
                translate={this.translate}
            />
        );
    };

    /**
     * One entry point for both row shapes. Handing FlatList either renderer
     * directly would make it infer its element type from whichever branch it
     * saw, so the dispatch happens here instead.
     */
    renderRow = ({ item }: { item: any }) => (this.getEffectiveTab() === 'habits'
        ? this.renderHabitsRow({ item })
        : this.renderPactItem({ item }));

    renderPactItem = ({ item }: { item: IPact }) => {
        const { user } = this.props;
        const { respondingPactId, nudgingPactId, renewingPactId } = this.state;

        if (this.getEffectiveTab() === 'outgoing') {
            return (
                <SentInviteCard
                    pact={item}
                    locale={user.settings?.locale || 'en-us'}
                    currentUserId={user.details?.id}
                    userName={user.details?.userName || ''}
                    isNudging={nudgingPactId === item.id}
                    onNudge={this.handleNudge}
                    onInviteSomeoneElse={this.handleCreatePact}
                    themeHabits={this.themeHabits}
                    translate={this.translate}
                    onPress={() => this.handlePactPress(item)}
                />
            );
        }

        // Any pact still awaiting this user's response gets inline actions,
        // whichever tab surfaced it (a group pact can be active for others
        // while this user's own invite is still pending).
        const isAwaitingMyResponse = this.isPendingInviteForMe(item);

        return (
            <PactCard
                pact={item}
                currentUserId={user.details?.id || ''}
                onPress={() => this.handlePactPress(item)}
                onAccept={isAwaitingMyResponse ? () => this.handleAcceptInvite(item) : undefined}
                onDecline={isAwaitingMyResponse ? () => this.handleDeclineInvitePress(item) : undefined}
                isRespondPending={respondingPactId === item.id}
                onRenew={() => this.handleRenewPact(item)}
                isRenewPending={renewingPactId === item.id}
                onViewSourcePact={this.handleViewLineagePact}
                onViewSuccessorPact={this.handleViewLineagePact}
                themeHabits={this.themeHabits}
                translate={this.translate}
            />
        );
    };

    renderEmptyState = () => {
        const activeTab = this.getEffectiveTab();
        const isHabits = activeTab === 'habits';
        const isOutgoing = activeTab === 'outgoing';
        const isIncoming = activeTab === 'pending';

        let titleKey = 'pages.pacts.noPactsTitle';
        let subtitleKey = 'pages.pacts.noPactsSubtitle';
        if (isHabits) {
            titleKey = 'pages.habits.noHabitsTitle';
            subtitleKey = 'pages.habits.noHabitsSubtitle';
        } else if (isOutgoing) {
            titleKey = 'pages.pacts.outgoing.emptyTitle';
            subtitleKey = 'pages.pacts.outgoing.emptySubtitle';
        } else if (isIncoming) {
            // "No pacts yet" was actively wrong here for the common case: a user
            // who has sent two invites has pacts, they just have none waiting on
            // their own reply. Name what this segment holds instead.
            titleKey = 'pages.pacts.incoming.emptyTitle';
            subtitleKey = 'pages.pacts.incoming.emptySubtitle';
        }

        return (
            <View style={this.themeHabits.styles.emptyStateContainer}>
                <View style={this.themeHabits.styles.emptyStateIconCircle}>
                    <Text style={this.themeHabits.styles.emptyStateEmoji}>
                        {isHabits ? '🎯' : '🤝'}
                    </Text>
                </View>
                <Text style={this.themeHabits.styles.emptyStateTitle}>
                    {this.translate(titleKey)}
                </Text>
                <Text style={this.themeHabits.styles.emptyStateSubtitle}>
                    {this.translate(subtitleKey)}
                </Text>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={this.translate('pages.pacts.createPactAccessibility')}
                    onPress={this.handleCreatePact}
                    style={({ pressed }) => [
                        this.themeHabits.styles.emptyStateActionButton,
                        pressed && this.themeHabits.styles.pressedOpacity,
                    ]}
                >
                    <Text style={this.themeHabits.styles.emptyStateActionLabel}>
                        {this.translate('pages.pacts.createPactCta')}
                    </Text>
                </Pressable>
            </View>
        );
    };

    /**
     * How many items a segment would show, for the inline count. Only the two
     * invite segments carry one — "Habits" is the default landing segment and
     * "All" is a superset, so a number on either is noise rather than news.
     */
    getTabCount = (tab: HabitsTab): number => {
        const { habits } = this.props;

        if (tab === 'pending') {
            return (habits.pendingInvites || []).length;
        }
        if (tab === 'outgoing') {
            return this.getOutgoingInvites().length;
        }

        return 0;
    };

    /**
     * Segmented control. Four segments is the ceiling the pill layout holds
     * without truncating a label — which is why the Habits segment took the
     * place of the old "Active" pacts segment rather than being added beside it.
     */
    renderTabBar = () => {
        // `getEffectiveTab`, not `state.activeTab`, so the highlighted segment and the
        // list below it can never disagree about which segment is showing.
        const activeTab = this.getEffectiveTab();

        return (
            <View style={this.themeHabits.styles.segmentedControl}>
                {TABS.map((tab) => {
                    const isActive = activeTab === tab;
                    const label = this.translate(TAB_LABEL_KEYS[tab]);
                    const count = this.getTabCount(tab);
                    return (
                        <Pressable
                            key={tab}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: isActive }}
                            accessibilityLabel={count > 0 ? `${label}, ${count}` : label}
                            onPress={() => this.setActiveTab(tab)}
                            style={[
                                this.themeHabits.styles.segmentedControlItem,
                                isActive && this.themeHabits.styles.segmentedControlItemActive,
                            ]}
                        >
                            <Text
                                numberOfLines={1}
                                style={[
                                    this.themeHabits.styles.segmentedControlLabel,
                                    isActive && this.themeHabits.styles.segmentedControlLabelActive,
                                ]}
                            >
                                {label}
                                {count > 0 && (
                                    <Text style={this.themeHabits.styles.segmentedControlCount}>
                                        {` \u00B7 ${count}`}
                                    </Text>
                                )}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        );
    };

    render() {
        const { navigation, user } = this.props;
        const {
            isRefreshing, proofSheetHabit, isSubmittingCheckin, pactIdPendingDecline,
            checkinLoadingIds, respondingPactId, renewingPactId, nudgingPactId,
        } = this.state;
        const arePactsEnabled = this.arePactsEnabled();
        const isHabitsTab = this.getEffectiveTab() === 'habits';
        const data: any[] = isHabitsTab ? this.getHabitsRows() : this.getPactsList();
        // Everything a row renders that does not live in `data`. Recomposed every render so
        // it is never `===` to the previous value once any of these moves.
        const extraData = [
            respondingPactId, renewingPactId, nudgingPactId,
            // The ids themselves, not the count: one check-in finishing as another starts
            // leaves the size unchanged while the row that should be spinning has moved.
            [...checkinLoadingIds].sort().join(','),
        ].join('|');

        return (
            <PactOnboardingGuard navigation={navigation} isBypassed={this.isOnboardingBypassed()}>
                <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
                {/* `edges={[]}`: Layout pads the header and MainButtonMenu below pads the
                    bottom, so this view applies no inset of its own. */}
                <SafeAreaView
                    edges={[]}
                    style={[this.theme.styles.safeAreaView, this.themeHabits.styles.dashboardContainer]}
                >
                    <View style={this.themeHabits.styles.dashboardHeader}>
                        <Text style={this.themeHabits.styles.dashboardGreeting}>
                            {this.getGreeting()}
                        </Text>
                        <Text style={this.themeHabits.styles.dashboardSubtitle}>
                            {this.translate('pages.habits.dashboardSubtitle')}
                        </Text>
                    </View>

                    {arePactsEnabled && this.renderTabBar()}

                    <FlatList
                        data={data}
                        // Habit rows carry a composed `key`; pacts are keyed by id.
                        keyExtractor={(item: any) => item.key || item.id}
                        renderItem={this.renderRow}
                        // Required, not defensive. VirtualizedList's CellRenderer is a
                        // PureComponent that is handed only `item`, `index` and `renderItem`
                        // — none of which change while a pact action is in flight, because
                        // the pact segments render Redux arrays whose rows keep their
                        // identity across a local setState. Without this every pending flag
                        // below is invisible: Accept/Decline/Nudge/Renew would neither show
                        // their spinner nor go `disabled`, leaving each of them open to a
                        // second tap on a request that is already running.
                        extraData={extraData}
                        ListHeaderComponent={isHabitsTab ? this.renderHabitsListHeader : undefined}
                        ListEmptyComponent={this.renderEmptyState}
                        refreshControl={
                            <RefreshControl
                                refreshing={isRefreshing}
                                onRefresh={this.handleRefresh}
                            />
                        }
                        contentContainerStyle={this.themeHabits.styles.pactsListContent}
                    />
                </SafeAreaView>
                <NewPactButton
                    onPress={this.handleCreatePact}
                    themeHabits={this.themeHabits}
                    translate={this.translate}
                />
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={this.handleRefresh}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />
                <CheckinProofSheet
                    isVisible={!!proofSheetHabit}
                    isSubmitting={isSubmittingCheckin}
                    habitName={proofSheetHabit?.name}
                    userId={user?.details?.id}
                    onCancel={this.handleProofSheetCancel}
                    onConfirm={this.handleProofSheetConfirm}
                    translate={this.translate}
                    themeConfirmModal={this.themeConfirmModal}
                    themeButtons={this.themeButtons}
                />
                <ConfirmModal
                    isVisible={!!pactIdPendingDecline}
                    onCancel={this.handleCancelDecline}
                    onConfirm={this.handleConfirmDecline}
                    text={this.translate('pages.pacts.confirmDecline')}
                    textConfirm={this.translate('modals.confirmModal.confirm')}
                    textCancel={this.translate('modals.confirmModal.cancel')}
                    translate={this.translate}
                    themeButtons={this.themeButtons}
                />
            </PactOnboardingGuard>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(HabitsDashboard);
