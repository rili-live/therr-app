import React from 'react';
import {
    ActivityIndicator, Pressable, ScrollView, Text, View,
} from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
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
import OpenPactListingCard from '../../components/Habits/OpenPactListingCard';
import { buildStyles } from '../../styles';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import { buttonMenuHeight } from '../../styles/navigation/buttonMenu';
import BaseStatusBar from '../../components/BaseStatusBar';

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
    /** The last read failed. Kept apart from an empty list, which is an answer rather than a failure. */
    loadError: boolean;
    /**
     * The server's seat ceiling (users-service `MAX_OPEN_PACT_MEMBERS`), sent with the list. Display
     * only: the list never includes a full pact, and the server re-checks at request and approval
     * time. Null from a server that predates the field, which drops "of N" rather than guess N.
     */
    maxMembers: number | null;
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
    private themeHabits = buildHabitStyles();

    constructor(props: IOpenPactsProps) {
        super(props);

        this.state = {
            pacts: [],
            isLoading: false,
            hasLoaded: false,
            loadError: false,
            maxMembers: null,
            pendingPactId: null,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
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
                // The interceptor answers a transient GET failure with `{ data: {}, isOfflineFallback }`,
                // which must not read as "nobody has an open pact". Whatever is on screen stays.
                const pacts = response?.data?.pacts;
                if (response?.isOfflineFallback || !Array.isArray(pacts)) {
                    this.setState({ loadError: true });
                    return;
                }
                const maxMembers = response.data.maxMembers;
                this.setState({
                    pacts,
                    loadError: false,
                    maxMembers: typeof maxMembers === 'number' && maxMembers > 0 ? maxMembers : null,
                });
            })
            .catch(() => {
                this.setState({ loadError: true });
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

    renderPactCard = (pact: IOpenPact) => {
        const { pendingPactId, maxMembers } = this.state;

        return (
            <OpenPactListingCard
                key={pact.id}
                pact={pact}
                maxMembers={maxMembers}
                isBusy={!!pendingPactId}
                isPending={pendingPactId === pact.id}
                onAskToJoin={this.handleAskToJoin}
                onCancelRequest={this.handleCancelRequest}
                translate={this.translate}
                themeHabits={this.themeHabits}
            />
        );
    };

    render() {
        const { user, route } = this.props;
        const {
            pacts, isLoading, hasLoaded, loadError,
        } = this.state;
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
                        <Text style={this.themeHabits.styles.openPactsIntro}>
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
                            <View>
                                {pacts.map(this.renderPactCard)}
                            </View>
                        )}

                        {hasLoaded && loadError && !pacts.length && (
                            <View style={this.themeHabits.styles.emptyStateContainer}>
                                <View style={this.themeHabits.styles.emptyStateIconCircle}>
                                    <MaterialIcon name="wifi-off" size={32} color={this.themeHabits.colors.brand} />
                                </View>
                                <Text style={this.themeHabits.styles.emptyStateTitle}>
                                    {this.translate('pages.pacts.openPact.loadErrorTitle')}
                                </Text>
                                <Text style={this.themeHabits.styles.emptyStateSubtitle}>
                                    {this.translate('pages.pacts.openPact.loadErrorHint')}
                                </Text>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityState={{ disabled: isLoading }}
                                    onPress={this.handleRefresh}
                                    disabled={isLoading}
                                    style={({ pressed }) => [
                                        this.themeHabits.styles.emptyStateActionButton,
                                        pressed && this.themeHabits.styles.pactCardInviteButtonPressed,
                                    ]}
                                >
                                    <Text style={this.themeHabits.styles.emptyStateActionLabel}>
                                        {this.translate('pages.pacts.openPact.retry')}
                                    </Text>
                                </Pressable>
                            </View>
                        )}

                        {hasLoaded && !loadError && !pacts.length && (
                            <View style={this.themeHabits.styles.emptyStateContainer}>
                                <View style={this.themeHabits.styles.emptyStateIconCircle}>
                                    <Text style={this.themeHabits.styles.emptyStateEmoji}>{'🤝'}</Text>
                                </View>
                                <Text style={this.themeHabits.styles.emptyStateTitle}>
                                    {this.translate('pages.pacts.openPact.emptyTitle')}
                                </Text>
                                <Text style={this.themeHabits.styles.emptyStateSubtitle}>
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
