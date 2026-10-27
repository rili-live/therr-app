import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Share,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RefreshControl } from 'react-native-gesture-handler';
import { connect } from 'react-redux';
import Toast from 'react-native-toast-message';
import { HabitsChallengesService } from 'therr-react/services';
import { IUserState } from 'therr-react/types';
import { buildStyles } from '../../styles';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import { buildStyles as buildModalStyles } from '../../styles/modal/confirmModal';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buttonMenuHeight } from '../../styles/navigation/buttonMenu';
import spacingStyles from '../../styles/layouts/spacing';
import translator from '../../utilities/translator';
import { getApiErrorMessage } from '../../utilities/apiErrorMessage';
import { getHabitCapPaywallParams } from '../../utilities/habitCapPaywall';
import { logAppEvent } from '../../utilities/analyticsEvents';
import getDeviceTimeZone from '../../utilities/deviceTimeZone';
import BaseStatusBar from '../../components/BaseStatusBar';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import {
    IChallenge,
    buildChallengeShareMessage,
    buildChallengeUrl,
    formatChallengeScore,
    formatChallengeTimeLeft,
    getChallengeActions,
    isChallenge,
} from './challengeFormat';

interface IChallengeDetailProps {
    user: IUserState;
    navigation: any;
    // `any` so the connected component stays assignable to React Navigation's ScreenComponentType.
    // Params: `joinToken` (required), `justCreated?` (opens the share sheet once on arrival).
    route: any;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const getTimeZone = (): string | undefined => getDeviceTimeZone() || undefined;

/**
 * One join-by-link challenge: the scoreboard, and what the viewer can do about it.
 *
 * Reached from a habits.therr.com/c/<token> link (Layout), from the challenge just created
 * (CreateChallenge), from My Habits, and from the `challengeJoined` push. Members check in on the
 * habit itself — a challenge is a view over ordinary check-ins — so "Open habit" is the way in.
 *
 * Screen-local state rather than redux: nothing else in the app renders a single challenge.
 */
export const ChallengeDetail: React.FC<IChallengeDetailProps> = ({ user, navigation, route }) => {
    const themeName = user.settings?.mobileThemeName;
    const theme = useMemo(() => buildStyles(themeName), [themeName]);
    const themeHabits = useMemo(() => buildHabitStyles(themeName), [themeName]);
    const themeConfirmModal = useMemo(() => buildModalStyles(themeName), [themeName]);
    const themeButtons = useMemo(() => buildButtonStyles(themeName), [themeName]);
    const locale = user.settings?.locale || 'en-us';
    const translate = useCallback((key: string, params?: any) => translator(locale, key, params), [locale]);
    const { styles } = themeHabits;

    const joinToken: string | undefined = route?.params?.joinToken;
    const justCreated: boolean = !!route?.params?.justCreated;

    const [challenge, setChallenge] = useState<IChallenge | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [isBusy, setIsBusy] = useState(false);
    const [confirm, setConfirm] = useState<'leave' | 'end' | null>(null);
    const hasOfferedShare = useRef(false);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const load = useCallback(() => {
        if (!joinToken) {
            setLoadError(true);
            setHasLoaded(true);
            return;
        }
        setIsLoading(true);
        HabitsChallengesService.getByToken(joinToken, getTimeZone())
            .then((response: any) => {
                if (!isMounted.current) return;
                if (response?.isOfflineFallback || !isChallenge(response?.data)) {
                    setLoadError(true);
                    return;
                }
                setChallenge(response.data);
                setLoadError(false);
            })
            .catch(() => {
                if (isMounted.current) setLoadError(true);
            })
            .finally(() => {
                if (!isMounted.current) return;
                setIsLoading(false);
                setHasLoaded(true);
            });
    }, [joinToken]);

    useEffect(() => {
        navigation.setOptions({ title: translate('pages.challenges.headerTitle') });
        logAppEvent('habit_challenge_view', { userId: user.details?.id, justCreated });
        load();
        // Mount only: `load` is stable per token, and the header title per locale.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleShare = useCallback((source: string) => {
        if (!challenge) return;
        logAppEvent('habit_challenge_share', { userId: user.details?.id, source });
        Share.share({
            message: buildChallengeShareMessage(challenge, translate),
            url: buildChallengeUrl(challenge.joinToken),
            title: translate('pages.challenges.shareTitle'),
        }).catch(() => {});
    }, [challenge, translate, user.details?.id]);

    // A challenge nobody has heard of is a scoreboard of one, so the share sheet opens by itself
    // the first time the creator lands here.
    useEffect(() => {
        if (justCreated && challenge && !hasOfferedShare.current) {
            hasOfferedShare.current = true;
            handleShare('created');
        }
    }, [justCreated, challenge, handleShare]);

    const handleJoin = () => {
        if (!challenge) return;
        setIsBusy(true);
        HabitsChallengesService.join(challenge.joinToken, getTimeZone())
            .then((response: any) => {
                logAppEvent('habit_challenge_join', { userId: user.details?.id, source: 'app' });
                if (isMounted.current && isChallenge(response?.data)) {
                    setChallenge(response.data);
                }
                Toast.show({
                    type: 'success',
                    text1: translate('pages.challenges.joinedTitle'),
                    text2: translate('pages.challenges.joinedMessage'),
                    visibilityTime: 3000,
                });
            })
            .catch((error: any) => {
                // Joining starts the habit, so the free-tier habit cap answers with a 402.
                const paywallParams = getHabitCapPaywallParams(error, 'challenge-join');
                if (paywallParams) {
                    navigation.navigate('UpgradePaywall', paywallParams);
                    return;
                }
                Toast.show({
                    type: 'error',
                    text1: translate('pages.challenges.errorTitle'),
                    text2: getApiErrorMessage(error) || translate('pages.challenges.joinError'),
                    visibilityTime: 3000,
                });
                load();
            })
            .finally(() => {
                if (isMounted.current) setIsBusy(false);
            });
    };

    const handleConfirm = () => {
        if (!challenge || !confirm) return;
        const action = confirm;
        setConfirm(null);
        setIsBusy(true);
        const request = action === 'end'
            ? HabitsChallengesService.cancel(challenge.id)
            : HabitsChallengesService.leave(challenge.id);
        request
            .then(() => {
                logAppEvent(action === 'end' ? 'habit_challenge_end' : 'habit_challenge_leave', { userId: user.details?.id });
                navigation.goBack();
            })
            .catch((error: any) => {
                Toast.show({
                    type: 'error',
                    text1: translate('pages.challenges.errorTitle'),
                    text2: getApiErrorMessage(error) || translate('pages.challenges.genericError'),
                    visibilityTime: 3000,
                });
            })
            .finally(() => {
                if (isMounted.current) setIsBusy(false);
            });
    };

    const renderActions = (current: IChallenge) => {
        const actions = getChallengeActions(current);

        return (
            <View style={styles.challengeActions}>
                {actions.canJoin && (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={translate('pages.challenges.join')}
                        disabled={isBusy}
                        onPress={handleJoin}
                        style={({ pressed }) => [styles.myHabitsPrimaryButton, (pressed || isBusy) && styles.pressedOpacity]}
                    >
                        {isBusy
                            ? <ActivityIndicator color={themeHabits.colors.onBrand} />
                            : <Text style={styles.myHabitsPrimaryButtonText}>{translate('pages.challenges.join')}</Text>}
                    </Pressable>
                )}
                {actions.canOpenHabit && (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={translate('pages.challenges.openHabit')}
                        onPress={() => navigation.navigate('HabitDetail', { habitGoalId: current.habitGoalId })}
                        style={({ pressed }) => [styles.myHabitsPrimaryButton, pressed && styles.pressedOpacity]}
                    >
                        <Text style={styles.myHabitsPrimaryButtonText}>{translate('pages.challenges.openHabit')}</Text>
                    </Pressable>
                )}
                {actions.canShare && (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={translate('pages.challenges.share')}
                        onPress={() => handleShare('detail')}
                        style={({ pressed }) => [styles.challengeSecondaryButton, pressed && styles.pressedOpacity]}
                    >
                        <Text style={styles.challengeSecondaryButtonText}>{translate('pages.challenges.share')}</Text>
                    </Pressable>
                )}
                {!actions.canJoin && current.isFull && !current.viewer?.isMember && (
                    <Text style={styles.challengeHint}>{translate('pages.challenges.fullHint')}</Text>
                )}
                {actions.canJoin && (
                    <Text style={styles.challengeHint}>{translate('pages.challenges.joinHint')}</Text>
                )}
            </View>
        );
    };

    const renderStandings = (current: IChallenge) => {
        const viewerRank = current.viewer?.rank;
        const viewerUserName = user.details?.userName;

        return (
            <View style={styles.challengeCard}>
                <Text style={styles.challengeSectionTitle}>{translate('pages.challenges.leaderboard')}</Text>
                <Text style={[styles.challengeHint, spacingStyles.marginBotSm]}>
                    {translate(current.rankedBy === 'amount' && current.goal.amountUnit
                        ? 'pages.challenges.rankedByAmount'
                        : 'pages.challenges.rankedByDays', { unit: current.goal.amountUnit })}
                </Text>
                {current.standings.length === 0 && (
                    <Text style={styles.challengeHint}>{translate('pages.challenges.emptyBoard')}</Text>
                )}
                {current.standings.map((standing) => {
                    const isMe = !!viewerRank && standing.userName === viewerUserName;
                    return (
                        <View
                            key={standing.userName}
                            style={[styles.challengeStandingRow, isMe && styles.challengeStandingRowMe]}
                            accessible
                            accessibilityLabel={translate('pages.challenges.standingA11y', {
                                rank: standing.rank,
                                name: standing.displayName,
                                score: formatChallengeScore(standing, current, translate),
                            })}
                        >
                            <Text style={styles.challengeRank}>{standing.rank}</Text>
                            <Text style={styles.challengeName} numberOfLines={1}>
                                {isMe ? translate('pages.challenges.you', { name: standing.displayName }) : standing.displayName}
                            </Text>
                            <Text style={styles.challengeScore}>{formatChallengeScore(standing, current, translate)}</Text>
                        </View>
                    );
                })}
            </View>
        );
    };

    const renderManage = (current: IChallenge) => {
        const actions = getChallengeActions(current);
        if (!actions.canLeave && !actions.canEnd) {
            return null;
        }
        const action = actions.canEnd ? 'end' : 'leave';
        const label = translate(action === 'end' ? 'pages.challenges.end' : 'pages.challenges.leave');

        return (
            <View style={styles.habitDangerZone}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    disabled={isBusy}
                    onPress={() => setConfirm(action)}
                    style={({ pressed }) => [styles.habitArchiveAction, (pressed || isBusy) && styles.pressedOpacity]}
                >
                    <Text style={styles.habitArchiveActionText}>{label}</Text>
                </Pressable>
                <Text style={styles.habitArchiveHint}>
                    {translate(action === 'end' ? 'pages.challenges.endHint' : 'pages.challenges.leaveHint')}
                </Text>
            </View>
        );
    };

    return (
        <>
            <BaseStatusBar therrThemeName={themeName} />
            <SafeAreaView edges={[]} style={[theme.styles.safeAreaView, styles.dashboardContainer]}>
                <ScrollView
                    contentContainerStyle={[spacingStyles.padMd, { paddingBottom: buttonMenuHeight + 16 }]}
                    refreshControl={<RefreshControl refreshing={isLoading && hasLoaded} onRefresh={load} />}
                >
                    {!hasLoaded && (
                        <ActivityIndicator size="large" color={theme.colors.primary3} style={styles.challengeLoader} />
                    )}

                    {hasLoaded && !challenge && loadError && (
                        <View style={[styles.emptyStateContainer, styles.challengeEmptyState]}>
                            <Text style={styles.emptyStateTitle}>{translate('pages.challenges.loadErrorTitle')}</Text>
                            <Text style={[styles.challengeHint, styles.challengeTextCenter]}>
                                {translate('pages.challenges.loadErrorHint')}
                            </Text>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={translate('pages.challenges.retry')}
                                onPress={load}
                                style={({ pressed }) => [styles.myHabitsTextAction, pressed && styles.pressedOpacity]}
                            >
                                <Text style={styles.myHabitsTextActionLabel}>{translate('pages.challenges.retry')}</Text>
                            </Pressable>
                        </View>
                    )}

                    {challenge && (
                        <>
                            <View style={styles.challengeHero}>
                                <Text style={styles.challengeEyebrow}>
                                    {translate('pages.challenges.eyebrow', { days: challenge.durationDays })}
                                </Text>
                                <Text style={styles.challengeTitle}>
                                    {challenge.goal.emoji ? `${challenge.goal.emoji} ` : ''}{challenge.title}
                                </Text>
                                <Text style={styles.challengeMeta}>
                                    {translate('pages.challenges.meta', {
                                        name: challenge.viewer?.isCreator
                                            ? translate('pages.challenges.youLower')
                                            : challenge.creator.displayName,
                                        count: challenge.memberCount,
                                    })}
                                </Text>
                                <View style={styles.challengeTimePill}>
                                    <Text style={styles.challengeTimePillText}>
                                        {formatChallengeTimeLeft(challenge, translate)}
                                    </Text>
                                </View>
                            </View>

                            {renderActions(challenge)}
                            {renderStandings(challenge)}
                            {renderManage(challenge)}
                        </>
                    )}
                </ScrollView>
            </SafeAreaView>
            <ConfirmModal
                isVisible={!!confirm}
                onCancel={() => setConfirm(null)}
                onConfirm={handleConfirm}
                text={translate(confirm === 'end' ? 'pages.challenges.endConfirm' : 'pages.challenges.leaveConfirm')}
                translate={translate}
                theme={theme}
                themeModal={themeConfirmModal}
                themeButtons={themeButtons}
            />
        </>
    );
};

export default connect(mapStateToProps)(ChallengeDetail);
