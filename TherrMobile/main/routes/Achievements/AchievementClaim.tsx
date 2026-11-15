import React from 'react';
import { InteractionManager, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { IUserState } from 'therr-react/types';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import SharePromptModal from '../../components/Modals/SharePromptModal';
import UsersActions from '../../redux/actions/UsersActions';
import translator from '../../utilities/translator';
import { showToast } from '../../utilities/toasts';
import {
    triggerClaimErrorFeedback,
    triggerClaimPressFeedback,
    triggerClaimSuccessFeedback,
    triggerRewardCelebration,
} from '../../utilities/rewardFeedback';
import { recordPositiveSignal } from '../../utilities/appReviewPrompt';
import { buildAchievementsShareUrl } from '../../utilities/shareUrls';
import {
    getAchievementBadgeKey,
    getAchievementCopy,
    getBadgeTrack,
    IAchievementBadge,
    toAchievementBadge,
} from '../../utilities/achievementCollection';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildConfirmModalStyles } from '../../styles/modal/confirmModal';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildAchievementStyles } from '../../styles/achievements';
import BaseStatusBar from '../../components/BaseStatusBar';
import { ScrollView } from 'react-native-gesture-handler';
import TherrIcon from '../../components/TherrIcon';
import AchievementDetail from './AchievementDetail';

interface IAchievementClaimDispatchProps {
    claimMyAchievement: Function;
    getMyAchievements: Function;
    updateUser: Function;
}

interface IStoreProps extends IAchievementClaimDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IAchievementClaimProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IAchievementClaimState {
    // Keys of badges whose reward was claimed while this screen was open (or on the way
    // into it). The Redux row can lag the claim by a refetch; this keeps the screen from
    // offering the button again in the meantime.
    claimedKeys: { [key: string]: boolean };
    // The badge whose claim is being celebrated, if any.
    celebratingKey: string | null;
    hasTransitioned: boolean;
    isClaimRequestPending: boolean;
    isSharePromptVisible: boolean;
    // Which badge is on screen. Starts as the one navigated to; tapping a level on the
    // ladder changes it in place.
    selectedKey: string;
}

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    claimMyAchievement: UsersActions.claimMyAchievement,
    getMyAchievements: UsersActions.getMyAchievements,
    updateUser: UsersActions.update,
}, dispatch);

export class AchievementClaim extends React.Component<IAchievementClaimProps, IAchievementClaimState> {
    private scrollViewRef;
    private translate: Function;
    private theme = buildStyles();
    private themeButtons = buildButtonStyles();
    private themeConfirmModal = buildConfirmModalStyles();
    private themeMenu = buildMenuStyles();
    private themeAchievements = buildAchievementStyles();
    private interactionHandle: { cancel: () => void } | null = null;
    private cancelCelebration: (() => void) | null = null;
    // A claim can resolve after the user has backed out. Nothing may start a celebration
    // (queued haptic taps, the share prompt) for a screen that is no longer there.
    private isUnmounted = false;

    constructor(props) {
        super(props);

        const { userAchievement, isClaiming } = props.route?.params || {};
        const routeKey = getAchievementBadgeKey(userAchievement?.achievementClass, userAchievement?.achievementId);

        this.state = {
            claimedKeys: isClaiming ? { [routeKey]: true } : {},
            celebratingKey: isClaiming ? routeKey : null,
            hasTransitioned: false,
            isClaimRequestPending: false,
            isSharePromptVisible: false,
            selectedKey: routeKey,
        };

        this.themeButtons = buildButtonStyles(props.user.settings?.mobileThemeName);
        this.themeConfirmModal = buildConfirmModalStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeAchievements = buildAchievementStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount = () => {
        const { route } = this.props;
        const { isClaiming } = route?.params || {};

        this.props.navigation.setOptions({
            title: this.translate('pages.achievements.headerTitle'),
            headerLeft: () => (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={this.translate('pages.achievements.buttons.back')}
                    onPress={this.handleBack}
                    hitSlop={8}
                    style={localStyles.headerBackButton}
                >
                    <TherrIcon name="go-back" size={24} />
                </Pressable>
            ),
        });

        if (isClaiming) {
            this.setState({ isSharePromptVisible: true });
        }

        // Defer heavy Lottie animations until after the navigation transition
        // completes, otherwise mounting them on the JS thread blocks the screen
        // push and makes card taps feel unresponsive.
        this.interactionHandle = InteractionManager.runAfterInteractions(() => {
            this.setState({ hasTransitioned: true });

            // Fire the fanfare + haptic ramp only once the push transition is
            // done, so the audio lands with the confetti rather than under the
            // still-animating screen.
            if (isClaiming) {
                this.cancelCelebration = triggerRewardCelebration();
            }
        });

    };

    componentWillUnmount() {
        this.isUnmounted = true;

        if (this.interactionHandle) {
            this.interactionHandle.cancel();
        }

        // Stop any queued haptic taps if the user navigates away mid-celebration.
        if (this.cancelCelebration) {
            this.cancelCelebration();
            this.cancelCelebration = null;
        }
    }

    /**
     * Back to wherever the badge was opened from. This used to always go to the
     * Achievements screen, which was the only way in; a badge can now be opened from a
     * profile too, and leaving it should return there.
     */
    handleBack = () => {
        const { navigation } = this.props;

        if (navigation.canGoBack?.()) {
            navigation.goBack();
            return;
        }
        navigation.navigate('Achievements');
    };

    handleRefresh = () => {
        if (this.isReadOnly()) {
            return;
        }
        this.props.getMyAchievements().catch((err) => console.log('GET_ACHIEVEMENTS_ERROR', err));
    };

    onDismissSharePrompt = () => {
        this.setState({ isSharePromptVisible: false });
    };

    /** A badge opened from someone else's profile: their rows arrive with the route. */
    isReadOnly = () => Array.isArray(this.props.route?.params?.ownerAchievements);

    /**
     * The rows the screen draws from: the profile owner's when read-only, otherwise the
     * signed-in user's, plus the row that was navigated with in case the store has not
     * loaded it. Anything claimed from here is shown as claimed whatever the store says.
     */
    getRows = (): any[] => {
        const { route, user } = this.props;
        const { claimedKeys } = this.state;
        const { ownerAchievements, userAchievement } = route?.params || {};

        if (Array.isArray(ownerAchievements)) {
            return ownerAchievements;
        }

        const rows: any[] = Object.values(user.achievements || {});
        const routeKey = getAchievementBadgeKey(userAchievement?.achievementClass, userAchievement?.achievementId);
        const hasRouteRow = rows.some((row: any) => getAchievementBadgeKey(row?.achievementClass, row?.achievementId) === routeKey);
        if (!hasRouteRow && userAchievement?.id) {
            rows.push(userAchievement);
        }

        return rows.map((row: any) => {
            const key = getAchievementBadgeKey(row?.achievementClass, row?.achievementId);
            if (!row || !claimedKeys[key]) {
                return row;
            }
            return {
                ...row,
                unclaimedRewardPts: 0,
                completedAt: row.completedAt || new Date().toISOString(),
            };
        });
    };

    /** The badge on screen and the ladder it sits on, or `null` for an achievement this build does not know. */
    getSelection = (): { badge: IAchievementBadge; track: IAchievementBadge[] } | null => {
        const { route } = this.props;
        const { selectedKey } = this.state;
        const { userAchievement } = route?.params || {};
        const routeBadge = toAchievementBadge(userAchievement);

        if (!routeBadge) {
            return null;
        }

        const rows = this.getRows();
        // The selected badge is always on the same ladder as the one navigated to, so one
        // ladder holds every badge this screen can show.
        const track = getBadgeTrack(routeBadge, rows);
        const badge = track.find((candidate) => candidate.key === selectedKey)
            || track.find((candidate) => candidate.key === routeBadge.key)
            || routeBadge;

        return { badge, track };
    };

    handleSelectBadge = (badge: IAchievementBadge) => {
        this.setState({ selectedKey: badge.key });
    };

    handleClaim = () => {
        const selection = this.getSelection();
        const row = selection?.badge.userAchievement;

        if (!selection || !row?.id || this.state.isClaimRequestPending || selection.badge.state !== 'claimable') {
            return;
        }

        const { badge } = selection;

        // Tactile acknowledgement fires before the request so the button feels
        // instant even when the network is slow.
        triggerClaimPressFeedback();
        this.setState({ isClaimRequestPending: true });

        this.props.claimMyAchievement(row.id, row.unclaimedRewardPts).then(() => {
            triggerClaimSuccessFeedback();
            // Counts toward the app-review prompt. Fire-and-forget: a storage failure must
            // not affect the claim that just succeeded.
            recordPositiveSignal('achievementClaimed').catch((err) => console.log('APP_REVIEW_SIGNAL_ERROR', err));
            showToast.success({
                text1: this.translate('alertTitles.coinsReceived'),
                text2: this.translate('alertMessages.coinsReceived', {
                    total: row.unclaimedRewardPts,
                }),
            });

            if (this.isUnmounted) {
                return;
            }

            if (this.cancelCelebration) {
                this.cancelCelebration();
            }
            this.cancelCelebration = triggerRewardCelebration();
            this.setState((prev) => ({
                claimedKeys: { ...prev.claimedKeys, [badge.key]: true },
                celebratingKey: badge.key,
                isSharePromptVisible: true,
            }));
            this.handleRefresh();
        }).catch(() => {
            triggerClaimErrorFeedback();
            showToast.error({
                text1: this.translate('alertTitles.backendErrorMessage'),
                text2: this.translate('alertMessages.backendErrorMessage'),
            });
        }).finally(() => {
            if (!this.isUnmounted) {
                this.setState({ isClaimRequestPending: false });
            }
        });
    };

    render() {
        const { navigation, user } = this.props;
        const {
            celebratingKey,
            hasTransitioned,
            isClaimRequestPending,
            isSharePromptVisible,
        } = this.state;
        const selection = this.getSelection();
        // The share copy used to name Therr and link therr.com verbatim, which on the
        // Friends with Habits app advertised the wrong product. `{appName}` resolves per
        // brand in the translator; the URL follows the brand in shareUrls.
        const shareUrl = buildAchievementsShareUrl(user.settings?.locale || 'en-us');
        const celebratedBadge = selection?.track.find((candidate) => candidate.key === celebratingKey);
        // Names the badge that was earned ("Habit Formed"), not the ladder it is on.
        const sharedBadge = celebratedBadge || selection?.badge;
        const shareMessage = this.translate('modals.sharePrompt.achievementEarned.shareMessage', {
            achievementClass: sharedBadge
                ? getAchievementCopy(sharedBadge, this.translate as (key: string, params?: any) => string).title
                : '',
            url: shareUrl,
        });

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName} />
                <SafeAreaView edges={[]}  style={[this.theme.styles.safeAreaView]}>
                    <ScrollView
                        style={[this.theme.styles.body]}
                        contentContainerStyle={localStyles.scrollContent}
                    >
                        {!selection && (
                            // Opened with no achievement, or one this build has no config for.
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionDescriptionCentered}>
                                    {this.translate('pages.achievements.info.unavailable')}
                                </Text>
                            </View>
                        )}
                        {selection && (
                            <AchievementDetail
                                badge={selection.badge}
                                track={selection.track}
                                isCelebrating={celebratingKey === selection.badge.key}
                                isClaiming={isClaimRequestPending}
                                isReadOnly={this.isReadOnly()}
                                showAnimation={hasTransitioned}
                                onClaim={this.handleClaim}
                                onSelectBadge={this.handleSelectBadge}
                                themeAchievements={this.themeAchievements}
                                translate={this.translate as (key: string, params?: any) => string}
                            />
                        )}
                    </ScrollView>
                </SafeAreaView>
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={this.handleRefresh}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />
                <SharePromptModal
                    isVisible={isSharePromptVisible}
                    headerText={this.translate('modals.sharePrompt.achievementEarned.header')}
                    message={this.translate('modals.sharePrompt.achievementEarned.message')}
                    shareMessage={shareMessage}
                    shareUrl={shareUrl}
                    shareTitle={this.translate('modals.sharePrompt.achievementEarned.header')}
                    onDismiss={this.onDismissSharePrompt}
                    translate={this.translate}
                    themeModal={this.themeConfirmModal}
                    themeButtons={this.themeButtons}
                />
            </>
        );
    }
}

const localStyles = StyleSheet.create({
    headerBackButton: {
        marginLeft: 12,
    },
    scrollContent: {
        flexGrow: 1,
    },
});

export default connect(mapStateToProps, mapDispatchToProps)(AchievementClaim);
