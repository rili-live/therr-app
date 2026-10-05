import React from 'react';
import {
    ActivityIndicator, ScrollView, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect } from 'react-redux';
import { RefreshControl } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { PactsService } from 'therr-react/services';
import { IOpenPact, IUserState } from 'therr-react/types';
import { getApiErrorMessage } from '../../utilities/apiErrorMessage';
import { logAppEvent } from '../../utilities/analyticsEvents';
import { getHabitCapPaywallParams } from '../../utilities/habitCapPaywall';
import translator from '../../utilities/translator';
import { Button } from '../../components/BaseButton';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import { buttonMenuHeight } from '../../styles/navigation/buttonMenu';
import BaseStatusBar from '../../components/BaseStatusBar';

/**
 * The server's ceiling on an open pact's seats (users-service `MAX_OPEN_PACT_MEMBERS`). Display only:
 * the list never includes a full pact, and the server re-checks at request and approval time.
 */
const OPEN_PACT_SEATS = 6;

interface IStoreProps {
    user: IUserState;
}

export interface IOpenPactsProps extends IStoreProps {
    navigation: any;
    // `any` so the connected component stays assignable to React Navigation's ScreenComponentType —
    // the same reason AddPactMembers types it loosely. Params: `habitGoalId?`, `habitName?`.
    route: any;
}

interface IOpenPactsState {
    pacts: IOpenPact[];
    isLoading: boolean;
    hasLoaded: boolean;
    pendingPactId: string | null;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

/**
 * Open pacts on one habit that the viewer could ask to join. Reached from a pact nobody has accepted
 * yet (PactDetail) and from the digest's "your invite went unanswered" push. Asking sends the pact's
 * creator a request; nothing is joined until they approve it, so the only commitment here is a tap.
 *
 * Screen-local state rather than redux: the list is a short, read-once suggestion that nothing else
 * in the app renders.
 */
export class OpenPacts extends React.Component<IOpenPactsProps, IOpenPactsState> {
    private translate: (key: string, params?: any) => string;
    private theme = buildStyles();
    private themeButtons = buildButtonStyles();
    private themeHabits = buildHabitStyles();

    constructor(props: IOpenPactsProps) {
        super(props);

        this.state = {
            pacts: [],
            isLoading: false,
            hasLoaded: false,
            pendingPactId: null,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonStyles(props.user.settings?.mobileThemeName);
        this.themeHabits = buildHabitStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params?: any) => translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount() {
        this.props.navigation.setOptions({
            title: this.translate('pages.pacts.openPact.listTitle'),
        });
        logAppEvent('habit_open_pacts_view', {
            userId: this.props.user?.details?.id,
            hasHabit: !!this.props.route?.params?.habitGoalId,
        });
        this.handleRefresh();
    }

    handleRefresh = () => {
        const habitGoalId = this.props.route?.params?.habitGoalId;

        this.setState({ isLoading: true });

        PactsService.getOpenPacts(habitGoalId)
            .then((response: any) => {
                this.setState({ pacts: response?.data?.pacts || [] });
            })
            .catch(() => {
                this.setState({ pacts: [] });
            })
            .finally(() => {
                this.setState({ isLoading: false, hasLoaded: true });
            });
    };

    setRequested = (pactId: string, hasPendingJoinRequest: boolean) => {
        this.setState((prev) => ({
            pacts: prev.pacts.map((p) => (p.id === pactId ? { ...p, hasPendingJoinRequest } : p)),
        }));
    };

    handleAskToJoin = (pact: IOpenPact) => {
        this.setState({ pendingPactId: pact.id });

        PactsService.requestToJoin(pact.id)
            .then(() => {
                logAppEvent('habit_pact_join_request', { userId: this.props.user?.details?.id });
                this.setRequested(pact.id, true);
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
                // Joining takes a habit slot, so the server checks the free-tier cap at the ask
                // rather than letting the creator approve someone who cannot join.
                const paywallParams = getHabitCapPaywallParams(error, 'open-pacts');
                if (paywallParams) {
                    this.props.navigation.navigate('UpgradePaywall', paywallParams);
                    return;
                }
                Toast.show({
                    type: 'error',
                    text1: this.translate('pages.pacts.errorTitle'),
                    text2: getApiErrorMessage(error) || this.translate('pages.pacts.openPact.requestError'),
                    visibilityTime: 3000,
                });
                // Most refusals mean the pact filled up or closed since the list loaded.
                this.handleRefresh();
            })
            .finally(() => {
                this.setState({ pendingPactId: null });
            });
    };

    handleCancelRequest = (pact: IOpenPact) => {
        this.setState({ pendingPactId: pact.id });

        PactsService.cancelJoinRequest(pact.id)
            .then(() => {
                this.setRequested(pact.id, false);
            })
            .catch((error: any) => {
                Toast.show({
                    type: 'error',
                    text1: this.translate('pages.pacts.errorTitle'),
                    text2: getApiErrorMessage(error) || this.translate('pages.pacts.openPact.requestError'),
                    visibilityTime: 3000,
                });
                this.handleRefresh();
            })
            .finally(() => {
                this.setState({ pendingPactId: null });
            });
    };

    renderPactRow = (pact: IOpenPact, index: number) => {
        const { pendingPactId } = this.state;
        const isPending = pendingPactId === pact.id;
        const creatorName = pact.creatorUserName || this.translate('pages.pacts.partnerFallback');

        return (
            <View
                key={pact.id}
                style={[
                    this.themeHabits.styles.habitNotificationPrefsRow,
                    index > 0 && this.themeHabits.styles.pactMemberRowDivided,
                    { paddingHorizontal: 16 },
                ]}
            >
                <Text style={[this.themeHabits.styles.habitCardEmoji, { marginRight: 12 }]}>
                    {pact.habitGoalEmoji || '🤝'}
                </Text>
                <View style={this.themeHabits.styles.habitNotificationPrefsLabelContainer}>
                    <Text style={this.themeHabits.styles.habitNotificationPrefsLabel}>
                        {pact.habitGoalName}
                    </Text>
                    <Text style={this.themeHabits.styles.habitNotificationPrefsHint}>
                        {this.translate('pages.pacts.openPact.rowDetail', {
                            name: creatorName,
                            count: pact.memberCount,
                            seats: OPEN_PACT_SEATS,
                            days: pact.durationDays,
                        })}
                    </Text>
                    <Text style={this.themeHabits.styles.habitNotificationPrefsHint}>
                        {this.translate(pact.status === 'active'
                            ? 'pages.pacts.openPact.rowRunning'
                            : 'pages.pacts.openPact.rowStarting')}
                    </Text>
                </View>
                {isPending ? (
                    <ActivityIndicator color={this.themeHabits.colors.primary3} />
                ) : (
                    <Button
                        buttonStyle={this.themeButtons.styles.btnClear}
                        titleStyle={this.themeButtons.styles.btnTitleBlack}
                        title={this.translate(pact.hasPendingJoinRequest
                            ? 'pages.pacts.openPact.requested'
                            : 'pages.pacts.openPact.askToJoin')}
                        accessibilityLabel={this.translate(pact.hasPendingJoinRequest
                            ? 'pages.pacts.openPact.cancelRequestFor'
                            : 'pages.pacts.openPact.askToJoinFor', { name: creatorName })}
                        onPress={() => (pact.hasPendingJoinRequest
                            ? this.handleCancelRequest(pact)
                            : this.handleAskToJoin(pact))}
                        disabled={!!pendingPactId}
                    />
                )}
            </View>
        );
    };

    render() {
        const { user, route } = this.props;
        const { pacts, isLoading, hasLoaded } = this.state;
        const habitName = route?.params?.habitName;

        return (
            <>
                <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
                <SafeAreaView
                    edges={[]}
                    style={[this.theme.styles.safeAreaView, this.themeHabits.styles.dashboardContainer]}
                >
                    <ScrollView
                        contentContainerStyle={{ paddingBottom: buttonMenuHeight + 16 }}
                        refreshControl={(
                            <RefreshControl
                                refreshing={isLoading && hasLoaded}
                                onRefresh={this.handleRefresh}
                            />
                        )}
                    >
                        <Text style={[this.themeHabits.styles.dashboardSubtitle, { paddingHorizontal: 20, marginTop: 12 }]}>
                            {habitName
                                ? this.translate('pages.pacts.openPact.listSubtitleHabit', { habitName })
                                : this.translate('pages.pacts.openPact.listSubtitle')}
                        </Text>

                        {!hasLoaded && (
                            <ActivityIndicator
                                size="large"
                                color={this.theme.colors.primary3}
                                style={{ marginTop: 32 }}
                            />
                        )}

                        {hasLoaded && pacts.length > 0 && (
                            <View style={{ marginTop: 8 }}>
                                {pacts.map((p, i) => this.renderPactRow(p, i))}
                            </View>
                        )}

                        {hasLoaded && !pacts.length && (
                            <View style={[this.themeHabits.styles.emptyStateContainer, { paddingTop: 24 }]}>
                                <Text style={this.themeHabits.styles.emptyStateEmoji}>{'🤝'}</Text>
                                <Text style={this.themeHabits.styles.emptyStateTitle}>
                                    {this.translate('pages.pacts.openPact.emptyTitle')}
                                </Text>
                                <Text style={[this.themeHabits.styles.habitNotificationPrefsHint, { textAlign: 'center', paddingHorizontal: 24 }]}>
                                    {this.translate('pages.pacts.openPact.emptyHint')}
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps)(OpenPacts);
