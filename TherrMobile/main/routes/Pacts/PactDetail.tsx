import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { FeatureFlags } from 'therr-js-utilities/constants';
import { HabitActions } from 'therr-react/redux/actions';
import permissions from '../../utilities/permissionsOrchestrator';
import isPactInviteAwaitingResponse from '../../utilities/pactInviteState';
// Shared so the pending-pact wording can't drift between the card and this screen.
import { getStatusText } from '../../components/Habits/PactCard';
import { isPactRenewable } from '../Habits/pactState';
import getPactTimeline from '../../utilities/pactTimeline';
import getConfig from '../../utilities/getConfig';
import { IUserState, IHabitsState, IPact, IPactMember } from 'therr-react/types';
import { RefreshControl } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import translator from '../../utilities/translator';
import { Button } from '../../components/BaseButton';
import { PactMemberRow } from '../../components/Habits';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import BaseStatusBar from '../../components/BaseStatusBar';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import { buildStyles as buildModalStyles } from '../../styles/modal/confirmModal';

interface IPactDetailDispatchProps {
    getPactDetails: Function;
    getUserGoals: Function;
    acceptPact: Function;
    declinePact: Function;
    abandonPact: Function;
    renewPact: Function;
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
    showConfirmModal: boolean;
    confirmAction: 'decline' | 'abandon' | null;
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
}, dispatch);

export class PactDetail extends React.Component<IPactDetailProps, IPactDetailState> {
    private translate: (key: string, params?: any) => string;
    private theme = buildStyles();
    private themeButtons = buildButtonStyles();
    private themeHabits = buildHabitStyles();
    private themeModal = buildModalStyles();

    constructor(props: IPactDetailProps) {
        super(props);

        this.state = {
            isRefreshing: false,
            isActionLoading: false,
            showConfirmModal: false,
            confirmAction: null,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonStyles(props.user.settings?.mobileThemeName);
        this.themeHabits = buildHabitStyles(props.user.settings?.mobileThemeName);
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

    handleRefresh = () => {
        const { getPactDetails, getUserGoals, route } = this.props;
        const { pactId } = route.params;

        this.setState({ isRefreshing: true });

        // Goals are fetched alongside the pact so the "view habit" link can be
        // offered on a cold navigation (deep link, push notification) that never
        // passed through the habits dashboard.
        Promise.all([
            getPactDetails(pactId),
            getUserGoals(),
        ]).catch(() => undefined).finally(() => {
            this.setState({ isRefreshing: false });
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
        this.handleRefresh();
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
                Toast.show({
                    type: 'success',
                    text1: this.translate('pages.pacts.acceptedTitle'),
                    text2: this.translate('pages.pacts.acceptedMessage'),
                    visibilityTime: 2000,
                });
                permissions.requestIfAppropriate('notifications', { trigger: 'pactAccept' });
                this.handleRefresh();
            })
            .catch(() => {
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
        const { declinePact, abandonPact, route, navigation } = this.props;
        const { pactId } = route.params;
        const { confirmAction } = this.state;

        this.setState({ isActionLoading: true, showConfirmModal: false });

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
                this.setState({ isActionLoading: false, confirmAction: null });
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
                    this.handleRefresh();
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
                const apiMessage = error?.statusCode && typeof error?.message === 'string'
                    ? error.message
                    : '';

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

    handleCancelConfirm = () => {
        this.setState({ showConfirmModal: false, confirmAction: null });
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

        if (!otherMembers.length) {
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
                        themeHabits={this.themeHabits}
                        translate={this.translate}
                    />
                ))}
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
                    {new Date(pact.startDate).toLocaleDateString()} - {new Date(pact.endDate).toLocaleDateString()}
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
        const { isRefreshing, isActionLoading, showConfirmModal, confirmAction } = this.state;

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
        const partnerName = partnerMember?.firstName
            || partnerMember?.userName
            || this.translate('pages.pacts.partnerFallback');

        if (!pact) {
            return (
                <SafeAreaView edges={['bottom']} style={this.theme.styles.safeAreaView}>
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
            );
        }

        return (
            <>
                <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
                {/* `edges={['bottom']}`: Layout pads the header, but this screen has no
                    ButtonMenu and its ScrollView runs to the bottom edge. React Native's
                    own SafeAreaView is a no-op on Android, so that last row sat under the
                    gesture handle. */}
                <SafeAreaView
                    edges={['bottom']}
                    style={[this.theme.styles.safeAreaView, this.themeHabits.styles.dashboardContainer]}
                >
                    <ScrollView
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

                        {this.renderMembersCard(pact, currentUserId)}

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

                <ConfirmModal
                    isVisible={showConfirmModal}
                    onCancel={this.handleCancelConfirm}
                    onConfirm={this.handleConfirmAction}
                    text={this.translate(
                        confirmAction === 'decline'
                            ? 'pages.pacts.confirmDecline'
                            : 'pages.pacts.confirmAbandon',
                    )}
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
