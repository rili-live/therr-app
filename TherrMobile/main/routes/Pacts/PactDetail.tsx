import React from 'react';
import { SafeAreaView, View, Text, ScrollView } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Button } from 'react-native-elements';
import { HabitActions } from 'therr-react/redux/actions';
import { IUserState, IHabitsState, IPact, IPactMember } from 'therr-react/types';
import { RefreshControl } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import translator from '../../services/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import BaseStatusBar from '../../components/BaseStatusBar';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import { buildStyles as buildModalStyles } from '../../styles/modal/confirmModal';

interface IPactDetailDispatchProps {
    getPactDetails: Function;
    acceptPact: Function;
    declinePact: Function;
    abandonPact: Function;
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
    acceptPact: HabitActions.acceptPact,
    declinePact: HabitActions.declinePact,
    abandonPact: HabitActions.abandonPact,
}, dispatch);

export class PactDetail extends React.Component<IPactDetailProps, IPactDetailState> {
    private translate: Function;
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

        this.themeButtons = buildButtonStyles(props.user.settings?.mobileThemeName);
        this.themeHabits = buildHabitStyles(props.user.settings?.mobileThemeName);
        this.themeModal = buildModalStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params?: any) =>
            translator('en-us', key, params);
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
        return habits.pacts.find((p: IPact) => p.id === pactId);
    };

    handleRefresh = () => {
        const { getPactDetails, route } = this.props;
        const { pactId } = route.params;

        this.setState({ isRefreshing: true });

        getPactDetails(pactId).finally(() => {
            this.setState({ isRefreshing: false });
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

    handleCancelConfirm = () => {
        this.setState({ showConfirmModal: false, confirmAction: null });
    };

    renderMemberStats = (member: IPactMember, label: string) => (
        <View style={this.themeHabits.styles.pactComparisonItem}>
            <Text style={this.themeHabits.styles.pactComparisonValue}>
                {member.currentStreak}
            </Text>
            <Text style={this.themeHabits.styles.pactComparisonLabel}>
                {label}
            </Text>
            <Text style={this.themeHabits.styles.streakMilestoneText}>
                {member.completedCheckins}/{member.totalCheckins} checkins
            </Text>
            {member.completionRate !== undefined && (
                <Text style={this.themeHabits.styles.streakMilestoneText}>
                    {Math.round(member.completionRate)}% completion
                </Text>
            )}
        </View>
    );

    render() {
        const { user } = this.props;
        const { isRefreshing, isActionLoading, showConfirmModal, confirmAction } = this.state;

        const pact = this.getPact();
        const currentUserId = user.details?.id || '';
        const currentUserMember = pact?.members?.find((m) => m.userId === currentUserId);
        const partnerMember = pact?.members?.find((m) => m.userId !== currentUserId);
        const isPending = pact?.status === 'pending';
        const isActive = pact?.status === 'active';
        const isInvitedUser = pact?.partnerUserId === currentUserId && isPending;

        if (!pact) {
            return (
                <SafeAreaView style={this.theme.styles.safeAreaView}>
                    <View style={this.themeHabits.styles.emptyStateContainer}>
                        <Text style={this.themeHabits.styles.emptyStateTitle}>
                            {this.translate('pages.pacts.pactNotFound')}
                        </Text>
                    </View>
                </SafeAreaView>
            );
        }

        return (
            <>
                <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
                <SafeAreaView style={[this.theme.styles.safeAreaView, this.themeHabits.styles.dashboardContainer]}>
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
                                        {pact.durationDays} day {pact.pactType}
                                    </Text>
                                </View>
                            </View>

                            <View style={[
                                this.themeHabits.styles.pactCardStatusBadge,
                                pact.status === 'active'
                                    ? this.themeHabits.styles.pactCardStatusActive
                                    : this.themeHabits.styles.pactCardStatusPending,
                            ]}>
                                <Text style={this.themeHabits.styles.pactCardStatusText}>
                                    {pact.status.toUpperCase()}
                                </Text>
                            </View>
                        </View>

                        {isActive && pact.members && pact.members.length > 1 && (
                            <View style={this.themeHabits.styles.streakWidgetContainer}>
                                <Text style={this.themeHabits.styles.dashboardSectionTitle}>
                                    {this.translate('pages.pacts.comparison')}
                                </Text>
                                <View style={this.themeHabits.styles.pactComparisonContainer}>
                                    {currentUserMember && this.renderMemberStats(
                                        currentUserMember,
                                        this.translate('pages.pacts.you'),
                                    )}
                                    <Text style={this.themeHabits.styles.habitCardSubtitle}>vs</Text>
                                    {partnerMember && this.renderMemberStats(
                                        partnerMember,
                                        partnerMember.firstName || 'Partner',
                                    )}
                                </View>
                            </View>
                        )}

                        {pact.startDate && pact.endDate && (
                            <View style={this.themeHabits.styles.streakWidgetContainer}>
                                <Text style={this.themeHabits.styles.streakWidgetTitle}>
                                    {this.translate('pages.pacts.timeline')}
                                </Text>
                                <Text style={this.themeHabits.styles.habitCardSubtitle}>
                                    {new Date(pact.startDate).toLocaleDateString()} - {new Date(pact.endDate).toLocaleDateString()}
                                </Text>
                            </View>
                        )}

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

                        {isActive && (
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
