import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { FeatureFlags, PledgeCharityKey } from 'therr-js-utilities/constants';
import { HabitActions } from 'therr-react/redux/actions';
import { PactsService } from 'therr-react/services';
import { getApiErrorMessage } from '../../utilities/apiErrorMessage';
import { logAppEvent } from '../../utilities/analyticsEvents';
import { getHabitCapPaywallParams } from '../../utilities/habitCapPaywall';
import permissions from '../../utilities/permissionsOrchestrator';
import isPactInviteAwaitingResponse from '../../utilities/pactInviteState';
import { canAddPactPledge, canEditPactPledge, getValidPledge } from '../../utilities/pactPledge';
// Shared so the pending-pact wording can't drift between the card and this screen.
import { getStatusText } from '../../components/Habits/PactCard';
import {
    isPactRenewable, canManagePactMembers, canRemovePactMember, getNonTerminalPactMemberIds,
} from '../Habits/pactState';
import getPactTimeline from '../../utilities/pactTimeline';
import getConfig from '../../utilities/getConfig';
import { pactShowsOpenPactSupport } from '../../utilities/openPactsSupport';
import {
    IUserState, IHabitsState, IPact, IPactJoinRequest, IPactMember,
} from 'therr-react/types';
import { RefreshControl } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import translator from '../../utilities/translator';
import { Button } from '../../components/BaseButton';
import {
    AmountProgressCard, OpenPactCard, PactMemberRow, PledgeCard, SavingsProgressCard,
} from '../../components/Habits';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import { buildStyles as buildMenuStyles, buttonMenuHeight } from '../../styles/navigation/buttonMenu';
import BaseStatusBar from '../../components/BaseStatusBar';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import { buildStyles as buildModalStyles } from '../../styles/modal/confirmModal';
import { formatCalendarDate } from '../../utilities/formatCalendarDate';

interface IPactDetailDispatchProps {
    getPactDetails: Function;
    getUserGoals: Function;
    acceptPact: Function;
    declinePact: Function;
    abandonPact: Function;
    renewPact: Function;
    continueSoloPact: Function;
    removePactMember: Function;
    setPactPledge: Function;
    removePactPledge: Function;
    setPactOpen: Function;
    approvePactJoinRequest: Function;
}

interface IStoreProps extends IPactDetailDispatchProps {
    user: IUserState;
    habits: IHabitsState;
}

export interface IPactDetailProps extends IStoreProps {
    navigation: any;
    route: {
        params: {
            pactId: string;
        };
    };
}

interface IPactDetailState {
    isRefreshing: boolean;
    isActionLoading: boolean;
    isPledgeSaving: boolean;
    showConfirmModal: boolean;
    confirmAction: 'decline' | 'abandon' | 'removeMember' | null;
    /** The member the removal confirm is targeting, set only for confirmAction === 'removeMember'. */
    memberToRemove: IPactMember | null;
    /** Open pacts: requests waiting on the creator. Only ever fetched for the creator. */
    joinRequests: IPactJoinRequest[];
    isOpenSaving: boolean;
    answeringRequestId: string | null;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    habits: state.habits,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getPactDetails: HabitActions.getPactDetails,
    getUserGoals: HabitActions.getUserGoals,
    acceptPact: HabitActions.acceptPact,
    declinePact: HabitActions.declinePact,
    abandonPact: HabitActions.abandonPact,
    renewPact: HabitActions.renewPact,
    continueSoloPact: HabitActions.continueSoloPact,
    removePactMember: HabitActions.removePactMember,
    setPactPledge: HabitActions.setPactPledge,
    removePactPledge: HabitActions.removePactPledge,
    setPactOpen: HabitActions.setPactOpen,
    approvePactJoinRequest: HabitActions.approvePactJoinRequest,
}, dispatch);

export class PactDetail extends React.Component<IPactDetailProps, IPactDetailState> {
    private translate: (key: string, params?: any) => string;
    private theme = buildStyles();
    private themeButtons = buildButtonStyles();
    private themeHabits = buildHabitStyles();
    private themeMenu = buildMenuStyles();
    private themeModal = buildModalStyles();

    constructor(props: IPactDetailProps) {
        super(props);

        this.state = {
            isRefreshing: false,
            isActionLoading: false,
            isPledgeSaving: false,
            showConfirmModal: false,
            confirmAction: null,
            memberToRemove: null,
            joinRequests: [],
            isOpenSaving: false,
            answeringRequestId: null,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonStyles(props.user.settings?.mobileThemeName);
        this.themeHabits = buildHabitStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeModal = buildModalStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params?: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount = () => {
        this.props.navigation.setOptions({
            title: this.translate('pages.pacts.detailTitle'),
        });

        this.handleRefresh();
    };

    getPact = (): IPact | undefined => {
        const { habits, route } = this.props;
        const { pactId } = route.params;
        // `pacts` is the canonical list (getPactDetails writes into it), but
        // fall back to the invite/active lists so arriving from those tabs
        // renders immediately instead of flashing "Pact not found".
        return habits.pacts.find((p: IPact) => p.id === pactId)
            || habits.pendingInvites.find((p: IPact) => p.id === pactId)
            || habits.activePacts.find((p: IPact) => p.id === pactId);
    };

    /**
     * `overridePactId` exists because `navigation.setParams` is a dispatch, not a
     * synchronous prop write: `route.params` on `this.props` still names the pact we are
     * leaving for the rest of this call stack. A refetch that read it would fetch the old
     * cycle and never the one just navigated to, leaving the screen on "Pact not found"
     * until the user pulled to refresh. Callers that change the pact pass the new id here.
     * `onRefresh` on the RefreshControl is called with no arguments, so the default holds
     * for pull-to-refresh.
     */
    handleRefresh = (overridePactId?: string) => {
        const { getPactDetails, getUserGoals, route } = this.props;
        const pactId = overridePactId || route.params.pactId;

        this.setState({ isRefreshing: true });

        // Goals are fetched alongside the pact so the "view habit" link can be
        // offered on a cold navigation (deep link, push notification) that never
        // passed through the habits dashboard.
        Promise.all([
            getPactDetails(pactId),
            getUserGoals(),
        ]).then(([pact]) => this.fetchJoinRequests(pact))
            .catch(() => undefined)
            .finally(() => {
                this.setState({ isRefreshing: false });
            });
    };

    /**
     * Open pacts: the requests waiting on this pact's creator. Read only for the creator of a pact
     * that can still take members — nobody else can answer one, and the server would refuse them.
     * Not at all on a server without open pacts, which has no such route.
     * Kept in screen state rather than redux: nothing else in the app shows them.
     */
    fetchJoinRequests = (pact?: IPact) => {
        const currentUserId = this.props.user.details?.id;
        if (!pact?.id || pact.creatorUserId !== currentUserId || !['pending', 'active'].includes(pact.status)
            || !pactShowsOpenPactSupport(pact)) {
            this.setState({ joinRequests: [] });
            return undefined;
        }

        return PactsService.getJoinRequests(pact.id)
            .then((response: any) => {
                this.setState({ joinRequests: response?.data?.requests || [] });
            })
            .catch(() => undefined);
    };

    handleToggleOpen = (isOpen: boolean) => {
        const { setPactOpen, route } = this.props;
        const { pactId } = route.params;

        this.setState({ isOpenSaving: true });

        setPactOpen(pactId, isOpen)
            .then(() => {
                logAppEvent(isOpen ? 'habit_pact_opened' : 'habit_pact_closed', {
                    userId: this.props.user?.details?.id,
                });
                Toast.show({
                    type: 'success',
                    text1: this.translate(isOpen ? 'pages.pacts.openPact.openedToast' : 'pages.pacts.openPact.closedToast'),
                    visibilityTime: 2500,
                });
            })
            .catch((error: any) => {
                Toast.show({
                    type: 'error',
                    text1: this.translate('pages.pacts.errorTitle'),
                    text2: getApiErrorMessage(error) || this.translate('pages.pacts.openPact.toggleError'),
                    visibilityTime: 3000,
                });
            })
            .finally(() => {
                this.setState({ isOpenSaving: false });
            });
    };

    handleAnswerJoinRequest = (request: IPactJoinRequest, answer: 'approve' | 'decline') => {
        const { approvePactJoinRequest, route } = this.props;
        const { pactId } = route.params;

        this.setState({ answeringRequestId: request.id });

        const action = answer === 'approve'
            ? approvePactJoinRequest(pactId, request.id)
            : PactsService.declineJoinRequest(pactId, request.id);

        Promise.resolve(action)
            .then(() => {
                logAppEvent(answer === 'approve' ? 'habit_pact_join_approve' : 'habit_pact_join_decline', {
                    userId: this.props.user?.details?.id,
                });
                if (answer === 'approve') {
                    Toast.show({
                        type: 'success',
                        text1: this.translate('pages.pacts.openPact.approvedToast', {
                            name: request.requesterUserName || this.translate('pages.pacts.partnerFallback'),
                        }),
                        visibilityTime: 2500,
                    });
                }
                this.setState((prev) => ({
                    joinRequests: prev.joinRequests.filter((r) => r.id !== request.id),
                }));
            })
            .catch((error: any) => {
                Toast.show({
                    type: 'error',
                    text1: this.translate('pages.pacts.errorTitle'),
                    text2: getApiErrorMessage(error) || this.translate('pages.pacts.openPact.answerError'),
                    visibilityTime: 3000,
                });
                // An answer the server refused is most often one already given elsewhere; the
                // re-read shows what is actually still waiting.
                this.fetchJoinRequests(this.getPact());
            })
            .finally(() => {
                this.setState({ answeringRequestId: null });
            });
    };

    goToOpenPacts = (pact: IPact) => {
        this.props.navigation.navigate('OpenPacts', {
            habitGoalId: pact.habitGoalId,
            habitName: pact.habitGoalName,
        });
    };

    /**
     * The pact's habit goal only appears in this user's goal list when they own
     * it — an invited partner shares the pact but not the goal row, and
     * HabitDetail resolves off `habits.habitGoals`. Linking there regardless
     * would land them on "Habit not found".
     */
    getLinkableHabitGoalId = (pact: IPact): string | undefined => {
        const { habits } = this.props;
        return habits.habitGoals?.some((goal) => goal.id === pact.habitGoalId)
            ? pact.habitGoalId
            : undefined;
    };

    goToHabitDetail = (habitGoalId: string) => {
        this.props.navigation.navigate('HabitDetail', { habitGoalId });
    };

    /**
     * Moves this screen onto another pact rather than pushing a second copy of itself.
     *
     * `setParams` + refetch is what `handleRenew` already does for the pact it creates,
     * and following a renewal chain has the same shape: it is one habit's history, and
     * stacking a screen per cycle would leave the back button walking the chain in
     * reverse instead of returning to the list the user came from.
     */
    goToPactDetail = (pactId: string) => {
        this.props.navigation.setParams({ pactId });
        this.handleRefresh(pactId);
    };

    goToUserProfile = (userId: string) => {
        this.props.navigation.navigate('ViewUser', {
            userInView: { id: userId },
        });
    };

    goToDirectMessage = (member: IPactMember) => {
        this.props.navigation.navigate('DirectMessage', {
            connectionDetails: {
                id: member.userId,
                userName: member.userName,
            },
        });
    };

    handleAccept = () => {
        const { acceptPact, route } = this.props;
        const { pactId } = route.params;

        this.setState({ isActionLoading: true });

        acceptPact(pactId)
            .then(() => {
                logAppEvent('habit_pact_accept', {
                    userId: this.props.user?.details?.id,
                    source: 'pact-detail',
                });
                Toast.show({
                    type: 'success',
                    text1: this.translate('pages.pacts.acceptedTitle'),
                    text2: this.translate('pages.pacts.acceptedMessage'),
                    visibilityTime: 2000,
                });
                permissions.requestIfAppropriate('notifications', { trigger: 'pactAccept' });
                this.handleRefresh();
            })
            .catch((err) => {
                // Accepting takes a habit slot, so at the free-tier cap the server
                // answers 402 with paywall metadata. Route to the offer rather than
                // telling someone their friend's invite is broken.
                const paywallParams = getHabitCapPaywallParams(err, 'pact-accept');
                if (paywallParams) {
                    this.props.navigation.navigate('UpgradePaywall', paywallParams);
                    return;
                }

                Toast.show({
                    type: 'error',
                    text1: this.translate('pages.pacts.errorTitle'),
                    text2: this.translate('pages.pacts.acceptError'),
                    visibilityTime: 2000,
                });
            })
            .finally(() => {
                this.setState({ isActionLoading: false });
            });
    };

    handleDecline = () => {
        this.setState({ showConfirmModal: true, confirmAction: 'decline' });
    };

    handleAbandon = () => {
        this.setState({ showConfirmModal: true, confirmAction: 'abandon' });
    };

    handleConfirmAction = () => {
        const { declinePact, abandonPact, removePactMember, route, navigation } = this.props;
        const { pactId } = route.params;
        const { confirmAction, memberToRemove } = this.state;

        this.setState({ isActionLoading: true, showConfirmModal: false });

        // Member removal stays on this screen (the pact lives on for everyone else); decline and
        // abandon end the user's involvement, so they pop back to the list.
        if (confirmAction === 'removeMember') {
            const targetUserId = memberToRemove?.userId;
            if (!targetUserId) {
                this.setState({ isActionLoading: false, confirmAction: null, memberToRemove: null });
                return;
            }
            removePactMember(pactId, targetUserId)
                .then(() => {
                    Toast.show({
                        type: 'success',
                        text1: this.translate('pages.pacts.successTitle'),
                        text2: this.translate('pages.pacts.removeMemberSuccess'),
                        visibilityTime: 2000,
                    });
                    this.handleRefresh();
                })
                .catch((error: any) => {
                    const apiMessage = getApiErrorMessage(error);
                    Toast.show({
                        type: 'error',
                        text1: this.translate('pages.pacts.errorTitle'),
                        text2: apiMessage || this.translate('pages.pacts.removeMemberError'),
                        visibilityTime: 3000,
                    });
                })
                .finally(() => {
                    this.setState({ isActionLoading: false, confirmAction: null, memberToRemove: null });
                });
            return;
        }

        const action = confirmAction === 'decline' ? declinePact : abandonPact;
        const successKey = confirmAction === 'decline' ? 'declinedMessage' : 'abandonedMessage';
        const errorKey = confirmAction === 'decline' ? 'declineError' : 'abandonError';

        action(pactId)
            .then(() => {
                Toast.show({
                    type: 'success',
                    text1: this.translate('pages.pacts.successTitle'),
                    text2: this.translate(`pages.pacts.${successKey}`),
                    visibilityTime: 2000,
                });
                navigation.goBack();
            })
            .catch(() => {
                Toast.show({
                    type: 'error',
                    text1: this.translate('pages.pacts.errorTitle'),
                    text2: this.translate(`pages.pacts.${errorKey}`),
                    visibilityTime: 2000,
                });
            })
            .finally(() => {
                this.setState({ isActionLoading: false, confirmAction: null, memberToRemove: null });
            });
    };

    handleRemoveMember = (member: IPactMember) => {
        this.setState({ showConfirmModal: true, confirmAction: 'removeMember', memberToRemove: member });
    };

    handleContinueSolo = () => {
        const { continueSoloPact, route } = this.props;
        const { pactId } = route.params;

        this.setState({ isActionLoading: true });

        continueSoloPact(pactId)
            .then(() => {
                Toast.show({
                    type: 'success',
                    text1: this.translate('pages.pacts.solo.successTitle'),
                    text2: this.translate('pages.pacts.solo.successMessage'),
                    visibilityTime: 3000,
                });
                this.handleRefresh();
            })
            .catch((error: any) => {
                const apiMessage = getApiErrorMessage(error);
                Toast.show({
                    type: 'error',
                    text1: this.translate('pages.pacts.errorTitle'),
                    text2: apiMessage || this.translate('pages.pacts.solo.error'),
                    visibilityTime: 3000,
                });
            })
            .finally(() => {
                this.setState({ isActionLoading: false });
            });
    };

    goToAddMembers = (pact: IPact) => {
        this.props.navigation.navigate('AddPactMembers', {
            pactId: pact.id,
            habitName: pact.habitGoalName,
            existingMemberIds: getNonTerminalPactMemberIds(pact),
        });
    };

    /**
     * Re-commit for another cycle of the same length. See
     * `Dashboard.handleRenewPact` for why the duration is not asked for and why
     * the streak survives the boundary.
     *
     * Navigates to the renewed pact rather than staying here: renewal creates a
     * *new* pact, so this screen's `pactId` still addresses the finished cycle
     * and would otherwise sit showing the old one with its CTA now gone.
     */
    handleRenew = () => {
        const { renewPact, route, navigation } = this.props;
        const { pactId } = route.params;

        this.setState({ isActionLoading: true });

        renewPact(pactId)
            .then((renewed: any) => {
                Toast.show({
                    type: 'success',
                    text1: this.translate('pages.pacts.renew.successTitle'),
                    text2: this.translate('pages.pacts.renew.successMessage', {
                        days: renewed?.durationDays,
                    }),
                    visibilityTime: 3000,
                });

                if (renewed?.id) {
                    navigation.setParams({ pactId: renewed.id });
                    this.handleRefresh(renewed.id);
                } else {
                    navigation.goBack();
                }
            })
            .catch((error: any) => {
                // Localized by the API and names the real reason — most often that
                // someone else renewed this pact first, leaving a live cycle on the
                // habit. The axios interceptor rejects with the body verbatim, so the
                // message is on `error.message`; no `statusCode` means it never
                // reached the API.
                const apiMessage = getApiErrorMessage(error);

                Toast.show({
                    type: 'error',
                    text1: this.translate('pages.pacts.errorTitle'),
                    text2: apiMessage || this.translate('pages.pacts.renew.error'),
                    visibilityTime: 4000,
                });
                this.handleRefresh();
            })
            .finally(() => {
                this.setState({ isActionLoading: false });
            });
    };

    /**
     * Resolves true once saved, so `PledgeCard` can keep its editor open on a failure. The
     * server answers 403/409 when the viewer can no longer pledge (they left, or the pact ended
     * since this screen loaded); its localized message says which.
     */
    handleSavePledge = (amount: number, charityKey: PledgeCharityKey): Promise<boolean> => {
        const { setPactPledge, route, user } = this.props;
        const { pactId } = route.params;
        const userId = user.details?.id;
        const hadPledge = !!getValidPledge(this.getPact()?.members?.find((m) => m.userId === userId));

        this.setState({ isPledgeSaving: true });

        return setPactPledge(pactId, userId, { amount, charityKey })
            .then(() => {
                // Adoption is the first number Phase A has to answer (§ 2.8 "Measure").
                logAppEvent(hadPledge ? 'habit_pledge_update' : 'habit_pledge_set', {
                    userId,
                    amount,
                    charityKey,
                });
                Toast.show({
                    type: 'success',
                    text1: this.translate('pages.pacts.pledge.saveSuccess'),
                    visibilityTime: 2000,
                });
                return true;
            })
            .catch((error: any) => {
                Toast.show({
                    type: 'error',
                    text1: this.translate('pages.pacts.errorTitle'),
                    text2: getApiErrorMessage(error) || this.translate('pages.pacts.pledge.error'),
                    visibilityTime: 3000,
                });
                return false;
            })
            .finally(() => {
                this.setState({ isPledgeSaving: false });
            });
    };

    handleRemovePledge = () => {
        const { removePactPledge, route, user } = this.props;
        const { pactId } = route.params;
        const userId = user.details?.id;

        this.setState({ isPledgeSaving: true });

        removePactPledge(pactId, userId)
            .then(() => {
                logAppEvent('habit_pledge_remove', { userId });
                Toast.show({
                    type: 'success',
                    text1: this.translate('pages.pacts.pledge.removeSuccess'),
                    visibilityTime: 2000,
                });
            })
            .catch((error: any) => {
                Toast.show({
                    type: 'error',
                    text1: this.translate('pages.pacts.errorTitle'),
                    text2: getApiErrorMessage(error) || this.translate('pages.pacts.pledge.error'),
                    visibilityTime: 3000,
                });
            })
            .finally(() => {
                this.setState({ isPledgeSaving: false });
            });
    };

    handleCancelConfirm = () => {
        this.setState({ showConfirmModal: false, confirmAction: null, memberToRemove: null });
    };

    getConfirmText = (confirmAction: IPactDetailState['confirmAction']): string => {
        if (confirmAction === 'decline') {
            return this.translate('pages.pacts.confirmDecline');
        }
        if (confirmAction === 'removeMember') {
            const { memberToRemove } = this.state;
            const name = memberToRemove?.firstName
                || memberToRemove?.userName
                || this.translate('pages.pacts.partnerFallback');
            return this.translate('pages.pacts.confirmRemoveMember', { name });
        }
        return this.translate('pages.pacts.confirmAbandon');
    };

    renderMemberStats = (
        member: IPactMember,
        label: string,
        link?: { onPress: () => void; accessibilityLabel: string },
    ) => {
        const stats = (
            <>
                <Text style={this.themeHabits.styles.pactComparisonValue}>
                    {member.currentStreak}
                </Text>
                <Text style={this.themeHabits.styles.pactComparisonLabel}>
                    {label}
                </Text>
                <Text style={this.themeHabits.styles.streakMilestoneText}>
                    {this.translate('pages.pacts.checkinsLabel', {
                        completed: member.completedCheckins,
                        total: member.totalCheckins,
                    })}
                </Text>
                {member.completionRate !== undefined && (
                    <Text style={this.themeHabits.styles.streakMilestoneText}>
                        {this.translate('pages.pacts.completionLabel', {
                            pct: Math.round(member.completionRate),
                        })}
                    </Text>
                )}
            </>
        );

        if (!link) {
            return (
                <View style={this.themeHabits.styles.pactComparisonItem}>
                    {stats}
                </View>
            );
        }

        return (
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={link.accessibilityLabel}
                onPress={link.onPress}
                style={({ pressed }) => [
                    this.themeHabits.styles.pactComparisonItem,
                    pressed && this.themeHabits.styles.pactComparisonItemPressed,
                ]}
            >
                {stats}
            </Pressable>
        );
    };

    renderHabitLink = (habitGoalId: string) => (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={this.translate('pages.pacts.viewHabitDetails')}
            onPress={() => this.goToHabitDetail(habitGoalId)}
            style={({ pressed }) => [
                this.themeHabits.styles.pactLinkRow,
                pressed && this.themeHabits.styles.pactPressedSurface,
            ]}
        >
            <Text style={this.themeHabits.styles.pactLinkText}>
                {this.translate('pages.pacts.viewHabitDetails')}
            </Text>
            <MaterialIcon
                name="chevron-right"
                size={24}
                color={this.themeHabits.colors.primary3}
            />
        </Pressable>
    );

    /**
     * A link to the cycle on the other side of a renewal boundary.
     *
     * Both directions are offered here, unlike on the card, which draws one. This is
     * the screen someone is on when they are asking what happened to a habit, and a
     * cycle in the middle of a chain has an answer in each direction: what it was built
     * on, and where it went next. The forward link is the one that matters most — the
     * list leaves superseded cycles out, so without it a user who followed an "extended
     * from" link back would have no way to the current cycle but the back button.
     */
    renderLineageLink = (targetPactId: string, labelKey: string) => (
        <Pressable
            accessibilityRole="link"
            accessibilityLabel={this.translate(labelKey)}
            onPress={() => this.goToPactDetail(targetPactId)}
            style={({ pressed }) => [
                this.themeHabits.styles.pactLinkRow,
                pressed && this.themeHabits.styles.pactPressedSurface,
            ]}
        >
            <Text style={this.themeHabits.styles.pactLinkText}>
                {this.translate(labelKey)}
            </Text>
            <MaterialIcon
                name="chevron-right"
                size={24}
                color={this.themeHabits.colors.primary3}
            />
        </Pressable>
    );

    renderMembersCard = (pact: IPact, currentUserId: string) => {
        const otherMembers = (pact.members || []).filter((m) => m.userId !== currentUserId);
        const canManageMembers = canManagePactMembers(pact, currentUserId);

        // With member management the creator always needs this card — it holds the "add members"
        // button even on a pact with no partners yet (a solo pact they want to reopen).
        if (!otherMembers.length && !canManageMembers) {
            return null;
        }

        const isDirectMessagingEnabled = getConfig().featureFlags?.[FeatureFlags.ENABLE_DIRECT_MESSAGING] === true;

        return (
            <View style={this.themeHabits.styles.streakWidgetContainer}>
                <Text style={this.themeHabits.styles.streakWidgetTitle}>
                    {this.translate('pages.pacts.partnersTitle')}
                </Text>
                {otherMembers.map((member, index) => (
                    <PactMemberRow
                        key={member.id || member.userId}
                        member={member}
                        isDivided={index > 0}
                        onPress={() => this.goToUserProfile(member.userId)}
                        onMessagePress={isDirectMessagingEnabled && member.userName
                            ? () => this.goToDirectMessage(member)
                            : undefined}
                        onRemovePress={canManageMembers && canRemovePactMember(pact, member)
                            ? () => this.handleRemoveMember(member)
                            : undefined}
                        locale={this.props.user?.settings?.locale}
                        themeHabits={this.themeHabits}
                        translate={this.translate}
                    />
                ))}
                {canManageMembers && (
                    <Button
                        buttonStyle={[this.themeButtons.styles.btnClear, { marginTop: 12 }]}
                        titleStyle={this.themeButtons.styles.btnTitleBlack}
                        icon={(
                            <MaterialIcon
                                name="person-add"
                                size={20}
                                color={this.themeHabits.colors.primary3}
                                style={{ marginRight: 8 }}
                            />
                        )}
                        title={this.translate('pages.pacts.addMembers')}
                        onPress={() => this.goToAddMembers(pact)}
                    />
                )}
            </View>
        );
    };

    /**
     * The shared pact streak — the group's own streak, distinct from each member's. Shown on the
     * detail screen for an active pact once the group has built one. The number carries across a
     * renewal, so it is not gated on the current cycle's age.
     */
    renderPactStreakCard = (pact: IPact) => {
        if (pact.status !== 'active' || !pact.currentPactStreak) {
            return null;
        }

        return (
            <View style={this.themeHabits.styles.streakWidgetContainer}>
                <Text style={this.themeHabits.styles.streakWidgetTitle}>
                    {this.translate('pages.pacts.pactStreak.title')}
                </Text>
                <View style={this.themeHabits.styles.pactComparisonContainer}>
                    <View style={this.themeHabits.styles.pactComparisonItem}>
                        <Text style={this.themeHabits.styles.pactComparisonValue}>
                            {'🔥 '}{pact.currentPactStreak}
                        </Text>
                        <Text style={this.themeHabits.styles.pactComparisonLabel}>
                            {this.translate('pages.pacts.pactStreak.currentLabel')}
                        </Text>
                    </View>
                    {!!pact.longestPactStreak && (
                        <View style={this.themeHabits.styles.pactComparisonItem}>
                            <Text style={this.themeHabits.styles.pactComparisonValue}>
                                {pact.longestPactStreak}
                            </Text>
                            <Text style={this.themeHabits.styles.pactComparisonLabel}>
                                {this.translate('pages.pacts.pactStreak.longestLabel')}
                            </Text>
                        </View>
                    )}
                </View>
                <Text style={this.themeHabits.styles.streakMilestoneText}>
                    {this.translate('pages.pacts.pactStreak.explainer')}
                </Text>
            </View>
        );
    };

    /**
     * Offered only when the server says this is the last active member of a group pact
     * (`canContinueSolo`). Keeping the pact going alone is a deliberate opt-in, not the default
     * outcome of everyone else leaving.
     */
    renderContinueSoloCard = (pact: IPact, isActionLoading: boolean) => {
        if (!pact.canContinueSolo) {
            return null;
        }

        return (
            <View style={this.themeHabits.styles.streakWidgetContainer}>
                <Text style={this.themeHabits.styles.pactCardInvitePrompt}>
                    {this.translate('pages.pacts.solo.prompt')}
                </Text>
                <Button
                    buttonStyle={this.themeButtons.styles.btnLargeWithText}
                    titleStyle={this.themeButtons.styles.btnLargeTitle}
                    title={this.translate('pages.pacts.solo.cta')}
                    onPress={this.handleContinueSolo}
                    loading={isActionLoading}
                    disabled={isActionLoading}
                />
            </View>
        );
    };

    renderTimelineCard = (pact: IPact) => {
        if (!pact.startDate || !pact.endDate) {
            return null;
        }

        const timeline = getPactTimeline(pact);

        return (
            <View style={this.themeHabits.styles.streakWidgetContainer}>
                <Text style={this.themeHabits.styles.streakWidgetTitle}>
                    {this.translate('pages.pacts.timeline')}
                </Text>
                <Text style={this.themeHabits.styles.habitCardSubtitle}>
                    {/*
                      * Was `toLocaleDateString()` with no locale, i.e. the *device's* locale
                      * — so this one line ignored the app language every other string on the
                      * screen honours. See utilities/formatCalendarDate.
                      */}
                    {formatCalendarDate(pact.startDate, this.translate)}
                    {' - '}
                    {formatCalendarDate(pact.endDate, this.translate)}
                </Text>
                {timeline && (
                    <>
                        <View style={this.themeHabits.styles.streakProgressContainer}>
                            <View style={this.themeHabits.styles.streakProgressBar}>
                                <View style={[
                                    this.themeHabits.styles.streakProgressFill,
                                    { width: `${timeline.progressPct}%` },
                                ]} />
                            </View>
                        </View>
                        <View style={this.themeHabits.styles.pactTimelineRow}>
                            <Text style={this.themeHabits.styles.streakMilestoneText}>
                                {this.translate('pages.pacts.dayOfTotal', {
                                    current: timeline.currentDay,
                                    total: timeline.totalDays,
                                })}
                            </Text>
                            <Text style={this.themeHabits.styles.streakMilestoneText}>
                                {timeline.hasEnded
                                    ? this.translate('pages.pacts.timelineEnded')
                                    : this.translate('pages.pacts.daysRemaining', {
                                        days: timeline.daysRemaining,
                                    })}
                            </Text>
                        </View>
                    </>
                )}
            </View>
        );
    };

    render() {
        const { user } = this.props;
        const {
            isRefreshing, isActionLoading, isPledgeSaving, showConfirmModal, confirmAction,
            joinRequests, isOpenSaving, answeringRequestId,
        } = this.state;

        const pact = this.getPact();
        const currentUserId = user.details?.id || '';
        const currentUserMember = pact?.members?.find((m) => m.userId === currentUserId);
        const partnerMember = pact?.members?.find((m) => m.userId !== currentUserId);
        const isInvitedUser = isPactInviteAwaitingResponse(pact, currentUserId);
        // A pact past its endDate still reads `active` until the nightly sweep
        // marks it expired, so renewability is checked before activity: that
        // window must offer re-commit, not abandon.
        const isRenewable = !isInvitedUser && isPactRenewable(pact);
        const isActive = pact?.status === 'active' && !isRenewable;
        const linkableHabitGoalId = pact && this.getLinkableHabitGoalId(pact);
        const currentUserPledge = getValidPledge(currentUserMember);
        const canEditPledge = canEditPactPledge(pact, currentUserMember, isRenewable);
        const partnerName = partnerMember?.firstName
            || partnerMember?.userName
            || this.translate('pages.pacts.partnerFallback');
        // Open pacts: the creator may open a pact that can still take members. A pending pact is one
        // nobody has accepted yet, which is when looking for someone else's open pact helps. Both
        // wait for a server that supports open pacts — see utilities/openPactsSupport.ts.
        const canManageOpenPact = !!pact && pact.creatorUserId === currentUserId && pactShowsOpenPactSupport(pact);
        const canToggleOpen = canManageOpenPact && !isRenewable
            && (pact?.status === 'pending' || pact?.status === 'active');
        const canFindOpenPacts = canManageOpenPact && pact?.status === 'pending';

        if (!pact) {
            return (
                <>
                    <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
                    <SafeAreaView edges={[]} style={this.theme.styles.safeAreaView}>
                        <View style={this.themeHabits.styles.emptyStateContainer}>
                            {isRefreshing
                                ? <ActivityIndicator size="large" color={this.theme.colors.primary3} />
                                : (
                                    <Text style={this.themeHabits.styles.emptyStateTitle}>
                                        {this.translate('pages.pacts.pactNotFound')}
                                    </Text>
                                )}
                        </View>
                    </SafeAreaView>
                    {/* A pact reached by a stale deep link or notification may not resolve;
                        the menu is the way back to a main page rather than a dead end. */}
                    <MainButtonMenu
                        navigation={this.props.navigation}
                        onActionButtonPress={this.handleRefresh}
                        translate={this.translate}
                        user={user}
                        themeMenu={this.themeMenu}
                    />
                </>
            );
        }

        return (
            <>
                <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
                {/* `edges={[]}`: Layout pads the header and the MainButtonMenu below pads
                    the bottom, so this view applies no inset of its own. The ScrollView
                    reserves `buttonMenuHeight` of bottom padding so its last row clears the
                    fixed menu. */}
                <SafeAreaView
                    edges={[]}
                    style={[this.theme.styles.safeAreaView, this.themeHabits.styles.dashboardContainer]}
                >
                    <ScrollView
                        contentContainerStyle={{ paddingBottom: buttonMenuHeight + 16 }}
                        refreshControl={
                            <RefreshControl
                                refreshing={isRefreshing}
                                onRefresh={this.handleRefresh}
                            />
                        }
                    >
                        <View style={this.themeHabits.styles.habitCardContainer}>
                            <View style={this.themeHabits.styles.habitCardHeader}>
                                <Text style={this.themeHabits.styles.habitCardEmoji}>
                                    {pact.habitGoalEmoji || '\uD83E\uDD1D'}
                                </Text>
                                <View style={this.themeHabits.styles.habitCardTitleContainer}>
                                    <Text style={this.themeHabits.styles.habitCardTitle}>
                                        {pact.habitGoalName || this.translate('pages.pacts.defaultTitle')}
                                    </Text>
                                    <Text style={this.themeHabits.styles.habitCardSubtitle}>
                                        {this.translate('pages.pacts.durationLabel', {
                                            days: pact.durationDays,
                                            type: this.translate(`pages.pacts.pactType.${pact.pactType}`),
                                        })}
                                    </Text>
                                    {(pact.renewalCycleNumber || 1) > 1 && (
                                        <Text style={this.themeHabits.styles.pactCardCycleBadge}>
                                            {this.translate('pages.pacts.renew.cycleLabel', {
                                                number: pact.renewalCycleNumber,
                                            })}
                                        </Text>
                                    )}
                                </View>
                            </View>

                            <View style={[
                                this.themeHabits.styles.pactCardStatusBadge,
                                pact.status === 'active'
                                    ? this.themeHabits.styles.pactCardStatusActive
                                    : this.themeHabits.styles.pactCardStatusPending,
                            ]}>
                                <Text style={this.themeHabits.styles.pactCardStatusText}>
                                    {getStatusText(pact.status, this.translate, isInvitedUser).toUpperCase()}
                                </Text>
                            </View>

                            {linkableHabitGoalId && this.renderHabitLink(linkableHabitGoalId)}

                            {!!pact.supersededByPactId && this.renderLineageLink(
                                pact.supersededByPactId,
                                'pages.pacts.renew.continuedAs',
                            )}
                            {!!pact.renewedFromPactId && this.renderLineageLink(
                                pact.renewedFromPactId,
                                'pages.pacts.renew.extendedFrom',
                            )}
                        </View>

                        {/* Above the members card: on a savings pact the money is what the
                            group opened this screen to see, and the per-member breakdown
                            inside it already names everyone. Absent on a non-savings pact
                            and on a response from a users-service that predates it, which
                            is why this is a presence check and not a goalType check. */}
                        {pact.savingsProgress ? (
                            <SavingsProgressCard
                                progress={pact.savingsProgress}
                                members={pact.members}
                                currentUserId={currentUserId}
                                translate={this.translate}
                                themeHabits={this.themeHabits}
                                locale={this.props.user?.settings?.locale}
                            />
                        ) : null}

                        {/* This week's amounts on a measured pact. Presence-checked like
                            the savings card: absent on a pact that tracks no amount. */}
                        {pact.amountProgress ? (
                            <AmountProgressCard
                                progress={pact.amountProgress}
                                members={pact.members}
                                currentUserId={currentUserId}
                                translate={this.translate}
                                themeHabits={this.themeHabits}
                                locale={this.props.user?.settings?.locale}
                            />
                        ) : null}

                        {this.renderMembersCard(pact, currentUserId)}

                        <OpenPactCard
                            isOpen={!!pact.isOpen}
                            canToggle={canToggleOpen}
                            isSaving={isOpenSaving}
                            onToggle={this.handleToggleOpen}
                            joinRequests={canManageOpenPact ? joinRequests : []}
                            answeringRequestId={answeringRequestId}
                            onApprove={(request) => this.handleAnswerJoinRequest(request, 'approve')}
                            onDecline={(request) => this.handleAnswerJoinRequest(request, 'decline')}
                            onFindOpenPacts={canFindOpenPacts ? () => this.goToOpenPacts(pact) : undefined}
                            translate={this.translate}
                            themeHabits={this.themeHabits}
                            themeButtons={this.themeButtons}
                        />

                        {canEditPledge && (
                            <PledgeCard
                                pledge={currentUserPledge}
                                canAdd={canAddPactPledge(pact)}
                                isSaving={isPledgeSaving}
                                onSave={this.handleSavePledge}
                                onRemove={this.handleRemovePledge}
                                locale={user.settings?.locale}
                                themeHabits={this.themeHabits}
                                themeButtons={this.themeButtons}
                                translate={this.translate}
                            />
                        )}

                        {this.renderPactStreakCard(pact)}

                        {this.renderContinueSoloCard(pact, isActionLoading)}

                        {isActive && pact.members && pact.members.length > 1 && (
                            <View style={this.themeHabits.styles.streakWidgetContainer}>
                                <Text style={this.themeHabits.styles.streakWidgetTitle}>
                                    {this.translate('pages.pacts.comparison')}
                                </Text>
                                <View style={this.themeHabits.styles.pactComparisonContainer}>
                                    {currentUserMember && this.renderMemberStats(
                                        currentUserMember,
                                        this.translate('pages.pacts.you'),
                                        linkableHabitGoalId
                                            ? {
                                                onPress: () => this.goToHabitDetail(linkableHabitGoalId),
                                                accessibilityLabel: this.translate('pages.pacts.viewHabitDetails'),
                                            }
                                            : undefined,
                                    )}
                                    <Text style={this.themeHabits.styles.habitCardSubtitle}>
                                        {this.translate('pages.pacts.vs')}
                                    </Text>
                                    {partnerMember && this.renderMemberStats(
                                        partnerMember,
                                        partnerName,
                                        {
                                            onPress: () => this.goToUserProfile(partnerMember.userId),
                                            accessibilityLabel: this.translate('pages.pacts.viewProfileOf', {
                                                name: partnerName,
                                            }),
                                        },
                                    )}
                                </View>
                            </View>
                        )}

                        {this.renderTimelineCard(pact)}

                        {isInvitedUser && (
                            <View style={this.themeHabits.styles.streakWidgetContainer}>
                                <Button
                                    buttonStyle={this.themeButtons.styles.btnLargeWithText}
                                    titleStyle={this.themeButtons.styles.btnLargeTitle}
                                    title={this.translate('pages.pacts.accept')}
                                    onPress={this.handleAccept}
                                    loading={isActionLoading}
                                    disabled={isActionLoading}
                                />
                                <Button
                                    buttonStyle={[this.themeButtons.styles.btnClear, { marginTop: 12 }]}
                                    titleStyle={this.themeButtons.styles.btnTitleRed}
                                    title={this.translate('pages.pacts.decline')}
                                    onPress={this.handleDecline}
                                    disabled={isActionLoading}
                                />
                            </View>
                        )}

                        {isActive && !isInvitedUser && (
                            <View style={this.themeHabits.styles.streakWidgetContainer}>
                                <Button
                                    buttonStyle={this.themeButtons.styles.btnClear}
                                    titleStyle={this.themeButtons.styles.btnTitleRed}
                                    title={this.translate('pages.pacts.abandon')}
                                    onPress={this.handleAbandon}
                                    disabled={isActionLoading}
                                />
                            </View>
                        )}

                        {isRenewable && (
                            <View style={this.themeHabits.styles.streakWidgetContainer}>
                                <Text style={this.themeHabits.styles.pactCardInvitePrompt}>
                                    {this.translate('pages.pacts.renew.prompt')}
                                </Text>
                                {/* `renewPact` creates fresh member rows, so a pledge stays with
                                    the cycle it was made on. Said up front rather than letting a
                                    renewal silently drop a promise the member thinks they kept. */}
                                {!!currentUserPledge && (
                                    <Text style={this.themeHabits.styles.cadenceHint}>
                                        {this.translate('pages.pacts.pledge.renewNotCarried')}
                                    </Text>
                                )}
                                <Button
                                    buttonStyle={this.themeButtons.styles.btnLargeWithText}
                                    titleStyle={this.themeButtons.styles.btnLargeTitle}
                                    title={this.translate('pages.pacts.renew.cta', {
                                        days: pact.durationDays,
                                    })}
                                    onPress={this.handleRenew}
                                    loading={isActionLoading}
                                    disabled={isActionLoading}
                                />
                            </View>
                        )}
                    </ScrollView>
                </SafeAreaView>
                <MainButtonMenu
                    navigation={this.props.navigation}
                    onActionButtonPress={this.handleRefresh}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />

                <ConfirmModal
                    isVisible={showConfirmModal}
                    onCancel={this.handleCancelConfirm}
                    onConfirm={this.handleConfirmAction}
                    text={this.getConfirmText(confirmAction)}
                    textConfirm={this.translate('modals.confirmModal.confirm')}
                    textCancel={this.translate('modals.confirmModal.cancel')}
                    translate={this.translate}
                    theme={this.theme}
                    themeModal={this.themeModal}
                    themeButtons={this.themeButtons}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(PactDetail);
