import React from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { HabitActions } from 'therr-react/redux/actions';
import { IUserState } from 'therr-react/types';
import translator from '../../utilities/translator';
import permissions from '../../utilities/permissionsOrchestrator';
import { logAppEvent } from '../../utilities/analyticsEvents';
import { toLocalDateKey } from '../../utilities/localDateKey';
import { getApiErrorMessage } from '../../utilities/apiErrorMessage';
import { getHabitCapPaywallParams } from '../../utilities/habitCapPaywall';
import { showToast } from '../../utilities/toasts';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import { Button } from '../../components/BaseButton';
import BaseStatusBar from '../../components/BaseStatusBar';

/**
 * The first session's first check-in (#3010).
 *
 * The wizard's solo start hands off here when it was opened from onboarding: the user has just
 * picked their first habit, and the next thing they see is "check in for today?", not the
 * dashboard and not a request to invite someone. Of the users who ever checked in, 19 of 26 did
 * it on day one; the ones who did not start that day almost never started.
 *
 * Only after the check-in does the friend come up, and as protection for a streak that now
 * exists rather than a toll on the way in. "Invite a friend" opens the wizard on this habit;
 * "Later" goes to the dashboard. Either way the habit is tracked and day 1 is done.
 */

interface IFirstCheckinDispatchProps {
    createCheckin: Function;
    getActiveStreaks: Function;
}

interface IFirstCheckinProps extends IFirstCheckinDispatchProps {
    user: IUserState;
    navigation: any;
    route: any;
}

interface IFirstCheckinState {
    isSubmitting: boolean;
    isDone: boolean;
}

const mapStateToProps = (state: any) => ({ user: state.user });

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    createCheckin: HabitActions.createCheckin,
    getActiveStreaks: HabitActions.getActiveStreaks,
}, dispatch);

export class FirstCheckin extends React.Component<IFirstCheckinProps, IFirstCheckinState> {
    private translate: (key: string, params?: any) => string;
    private theme = buildStyles();
    private themeButtons = buildButtonStyles();
    private themeHabits = buildHabitStyles();
    private isUnmounted = false;

    constructor(props: IFirstCheckinProps) {
        super(props);
        this.state = { isSubmitting: false, isDone: false };
        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonStyles(props.user.settings?.mobileThemeName);
        this.themeHabits = buildHabitStyles(props.user.settings?.mobileThemeName);
        this.translate = (key, params) => translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount() {
        this.props.navigation.setOptions({
            title: this.translate('pages.firstCheckin.title'),
        });
    }

    componentWillUnmount() {
        this.isUnmounted = true;
    }

    getHabit = () => {
        const params = this.props.route?.params || {};
        return {
            habitGoalId: typeof params.habitGoalId === 'string' ? params.habitGoalId : '',
            habitName: typeof params.habitName === 'string' && params.habitName
                ? params.habitName
                : this.translate('pages.firstCheckin.defaultHabitName'),
            habitEmoji: typeof params.habitEmoji === 'string' && params.habitEmoji ? params.habitEmoji : '✅',
        };
    };

    goToDashboard = () => {
        this.props.navigation.reset({ index: 0, routes: [{ name: 'HabitsDashboard' }] });
    };

    handleCheckin = () => {
        const { createCheckin, getActiveStreaks, navigation } = this.props;
        const { habitGoalId } = this.getHabit();

        // Opened without a habit — a stale link, a param dropped in a refactor — there is nothing to
        // check into here, but the habit (if any) is on the dashboard.
        if (!habitGoalId) {
            this.goToDashboard();
            return;
        }

        this.setState({ isSubmitting: true });

        // The same write the dashboard makes: the user's own calendar day, with the device zone
        // so the service can resolve that day for an account that has none saved yet.
        const today = toLocalDateKey(new Date());
        Promise.resolve(createCheckin({
            habitGoalId,
            scheduledDate: today,
            localDate: today,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            status: 'completed',
        }))
            .then(() => {
                logAppEvent('habit_checkin_complete', {
                    userId: this.props.user?.details?.id,
                    source: 'first_session',
                    hasProof: false,
                    isFirstSession: true,
                });
                Promise.resolve(getActiveStreaks()).catch(() => {});
                // The first moment a reminder has something to protect. Replaces the opt-in
                // screen that used to sit in front of the dashboard before the user had done
                // anything.
                permissions.requestIfAppropriate('notifications', { trigger: 'firstCheckin' }).catch(() => {});
                if (!this.isUnmounted) {
                    this.setState({ isDone: true });
                }
            })
            .catch((err: any) => {
                const paywallParams = getHabitCapPaywallParams(err, 'first-checkin');
                if (paywallParams) {
                    navigation.navigate('UpgradePaywall', paywallParams);
                    return;
                }
                showToast.error({
                    text1: this.translate('alertTitles.backendErrorMessage'),
                    text2: getApiErrorMessage(err) || this.translate('pages.habits.checkinError'),
                });
            })
            .finally(() => {
                if (!this.isUnmounted) {
                    this.setState({ isSubmitting: false });
                }
            });
    };

    handleInvite = () => {
        const { habitGoalId, habitName, habitEmoji } = this.getHabit();

        logAppEvent('habits_first_checkin_invite_tap', { userId: this.props.user?.details?.id });
        this.props.navigation.replace('CreatePactInvite', { habitGoalId, habitName, habitEmoji });
    };

    handleLater = () => {
        logAppEvent('habits_first_checkin_invite_later', { userId: this.props.user?.details?.id });
        this.goToDashboard();
    };

    renderReady = (habitName: string, habitEmoji: string) => (
        <>
            <Text style={{ fontSize: 64, textAlign: 'center', marginBottom: 16 }}>{habitEmoji}</Text>
            <Text style={[this.themeHabits.styles.dashboardGreeting, { textAlign: 'center', fontSize: 24 }]}>
                {this.translate('pages.firstCheckin.askTitle')}
            </Text>
            <Text style={[this.themeHabits.styles.dashboardSubtitle, { textAlign: 'center', marginTop: 12 }]}>
                {this.translate('pages.firstCheckin.askSubtitle', { habitName })}
            </Text>
        </>
    );

    renderDone = (habitName: string) => (
        <>
            <Text style={{ fontSize: 64, textAlign: 'center', marginBottom: 16 }}>{'🔥'}</Text>
            <Text style={[this.themeHabits.styles.dashboardGreeting, { textAlign: 'center', fontSize: 24 }]}>
                {this.translate('pages.firstCheckin.doneTitle')}
            </Text>
            <Text style={[this.themeHabits.styles.dashboardSubtitle, { textAlign: 'center', marginTop: 12 }]}>
                {this.translate('pages.firstCheckin.doneStreak')}
            </Text>
            <Text style={[this.themeHabits.styles.streakMilestoneText, { textAlign: 'center', marginTop: 32 }]}>
                {this.translate('pages.firstCheckin.inviteAsk', { habitName })}
            </Text>
        </>
    );

    render() {
        const { user } = this.props;
        const { isSubmitting, isDone } = this.state;
        const { habitName, habitEmoji } = this.getHabit();

        return (
            <>
                <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
                {/* `edges={['bottom']}`: Layout pads the header, but this screen has no ButtonMenu
                    and its footer sits at the bottom edge — the same reason HabitsPushOptIn sets it. */}
                <SafeAreaView
                    edges={['bottom']}
                    style={[this.theme.styles.safeAreaView, this.themeHabits.styles.dashboardContainer]}
                >
                    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 48 }}>
                        {isDone ? this.renderDone(habitName) : this.renderReady(habitName, habitEmoji)}
                    </ScrollView>
                    <View style={{ padding: 24 }}>
                        {isDone ? (
                            <>
                                <Button
                                    buttonStyle={[this.themeButtons.styles.btnLargeWithText, { width: '100%' }]}
                                    titleStyle={this.themeButtons.styles.btnLargeTitle}
                                    title={this.translate('pages.firstCheckin.inviteButton')}
                                    onPress={this.handleInvite}
                                />
                                <Pressable
                                    accessibilityRole="button"
                                    onPress={this.handleLater}
                                    style={{ alignItems: 'center', marginTop: 16, paddingVertical: 12 }}
                                >
                                    <Text style={this.themeButtons.styles.btnTitleBlack}>
                                        {this.translate('pages.firstCheckin.laterButton')}
                                    </Text>
                                </Pressable>
                            </>
                        ) : (
                            <>
                                <Button
                                    buttonStyle={[this.themeButtons.styles.btnLargeWithText, { width: '100%' }]}
                                    titleStyle={this.themeButtons.styles.btnLargeTitle}
                                    title={this.translate('pages.firstCheckin.checkinButton')}
                                    onPress={this.handleCheckin}
                                    disabled={isSubmitting}
                                    loading={isSubmitting}
                                />
                                <Pressable
                                    accessibilityRole="button"
                                    onPress={this.goToDashboard}
                                    disabled={isSubmitting}
                                    style={{ alignItems: 'center', marginTop: 16, paddingVertical: 12 }}
                                >
                                    <Text style={this.themeButtons.styles.btnTitleBlack}>
                                        {this.translate('pages.firstCheckin.notYetButton')}
                                    </Text>
                                </Pressable>
                            </>
                        )}
                    </View>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(FirstCheckin);
