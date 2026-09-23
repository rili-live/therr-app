import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { FeatureFlags, HabitGoalType, HabitGoalTypes } from 'therr-js-utilities/constants';
import { HabitActions } from 'therr-react/redux/actions';
import { IUserState } from 'therr-react/types';
import BaseStatusBar from '../../components/BaseStatusBar';
import CheckinDetailForm, { ICheckinDetailDraft } from '../../components/Habits/CheckinDetailForm';
import { getApiErrorMessage } from '../../utilities/apiErrorMessage';
import celebrationQueue from '../../utilities/celebrationQueue';
import uploadCheckinProofImage from '../../utilities/checkinProofUpload';
import getConfig from '../../utilities/getConfig';
import { logAppEvent } from '../../utilities/analyticsEvents';
import { toLocalDateKey } from '../../utilities/localDateKey';
import { showToast } from '../../utilities/toasts';
import translator from '../../utilities/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildHabitStyles } from '../../styles/habits';

interface ICheckinDetailParams {
    habitGoalId: string;
    habitName?: string;
    /** Where the user came from, for the analytics event only. */
    source?: string;
    /**
     * The habit's goal type, passed by the caller rather than re-fetched: every screen
     * that opens this one is already rendering the habit and has it to hand, and a
     * fetch here would put a spinner in front of a form the user just asked for.
     * Absent reads as "not a savings habit", which is the safe default — the amount
     * field simply does not appear.
     */
    goalType?: HabitGoalType;
    /** The goal's currency, for the amount field's prefix. Display only. */
    currencyCode?: string | null;
}

interface ICheckinDetailProps {
    navigation: any;
    // `any` rather than `{ params: ICheckinDetailParams }`: a narrower `route` makes the
    // connected component unassignable to React Navigation's ScreenComponentType. The params
    // are read through one typed destructure below instead.
    route: any;
    user: IUserState;
    createCheckin: Function;
    shareCheckin: Function;
    getActiveStreaks: Function;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    createCheckin: HabitActions.createCheckin,
    shareCheckin: HabitActions.shareCheckin,
    getActiveStreaks: HabitActions.getActiveStreaks,
}, dispatch);

/**
 * Attach a note or photo to a check-in that has already been logged.
 *
 * This was a bottom-sheet dialog. It is a screen now for three reasons: the note field is the
 * main event and a sheet gave it 80pt above a keyboard; the photo picker takes the user out to
 * the OS and back, which a sheet survives awkwardly; and back-navigation now behaves the way
 * the rest of the app does instead of being a dismiss gesture with no header.
 *
 * It also owns the whole submit — upload, check-in, optional share — which the Dashboard and
 * HabitDetail screens previously carried in byte-identical copies.
 *
 * While it is on screen the celebration queue is blocked, so a streak celebration cannot
 * interrupt the note the user is writing. The block is released on unmount, whichever way the
 * screen was left.
 */
export const CheckinDetail = ({
    navigation,
    route,
    user,
    createCheckin,
    shareCheckin,
    getActiveStreaks,
}: ICheckinDetailProps) => {
    const {
        habitGoalId, habitName, source, goalType, currencyCode,
    } = route.params || ({} as ICheckinDetailParams);
    const isSavingsGoal = goalType === HabitGoalTypes.SAVINGS_GOAL;
    const [isSubmitting, setIsSubmitting] = useState(false);
    const draftRef = useRef<ICheckinDetailDraft>({
        notes: '',
        image: null,
        sharePublicly: false,
    });

    const theme = useMemo(() => buildStyles(user.settings?.mobileThemeName), [user.settings?.mobileThemeName]);
    const themeHabits = useMemo(() => buildHabitStyles(user.settings?.mobileThemeName), [user.settings?.mobileThemeName]);
    const translate = useCallback(
        (key: string, params?: any) => translator(user.settings?.locale || 'en-us', key, params),
        [user.settings?.locale],
    );

    const isFeedEnabled = getConfig().featureFlags?.[FeatureFlags.ENABLE_HABITS_FEED] === true;

    // Hold the celebration queue for as long as this screen is up. The check-in that opened it
    // may well have earned a streak celebration; showing it over a half-written note is exactly
    // what the queue exists to prevent.
    useEffect(() => {
        celebrationQueue.block();

        return () => celebrationQueue.unblock();
    }, []);

    useEffect(() => {
        navigation.setOptions({
            title: translate('pages.habits.checkinProof.addDetailTitle'),
        });
    }, [navigation, translate]);

    const handleDraftChange = useCallback((draft: ICheckinDetailDraft) => {
        draftRef.current = draft;
    }, []);

    const handleSave = () => {
        if (isSubmitting || !habitGoalId) {
            return;
        }

        const {
            notes, image, sharePublicly, savedAmount, hasInvalidSavedAmount,
        } = draftRef.current;
        const trimmedNotes = notes.trim();

        // The amount field is already showing why the text does not parse. Submitting
        // anyway would save the check-in without the number the user typed.
        if (hasInvalidSavedAmount) {
            return;
        }

        // An amount counts as something to attach. Without this, a savings check-in whose
        // only content is the number — which is the common case, and the whole point of
        // the feature — would be treated as an empty save and silently discarded.
        const hasSavedAmount = savedAmount !== undefined;

        // Nothing to attach — treat Save as Done rather than re-POSTing the check-in for no
        // reason.
        if (!trimmedNotes.length && !image && !hasSavedAmount) {
            navigation.goBack();
            return;
        }

        setIsSubmitting(true);

        // The user's own calendar day, via `toLocalDateKey` — a habit day is the user's day,
        // not UTC's, and this screen has to stamp the same one the dashboard's one-tap
        // check-in does or a note added minutes later lands on a different row. `timeZone`
        // still travels so the service can resolve the day itself for a client that sends
        // no date; see resolveCheckinHabitDate in the service.
        const scheduledDate = toLocalDateKey(new Date());
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const uploadPromise = image
            ? uploadCheckinProofImage(habitGoalId, image).then((media) => [media])
            : Promise.resolve(undefined);

        uploadPromise
            .then((proofMedias) => createCheckin({
                habitGoalId,
                scheduledDate,
                localDate: scheduledDate,
                timeZone,
                status: 'completed',
                notes: trimmedNotes.length ? trimmedNotes : undefined,
                proofMedias,
                // Spread so the key is genuinely absent on a non-savings habit, and on a
                // savings habit whose field was left empty. The POST upserts today's row
                // and an explicit null would clear an amount already logged today (say,
                // from the notification quick-reply), so the draft never carries one.
                ...(savedAmount === undefined ? {} : { savedAmount }),
            }))
            .then((checkin: any) => {
                // Opt-in public share: only with a photo (the backend copies that proof into the
                // public bucket, moderates it, and mints a public post). Fire-and-forget — a
                // failed share must not fail the check-in, which already committed.
                if (sharePublicly && !!image && checkin?.id) {
                    shareCheckin(checkin.id, trimmedNotes)
                        .then(() => {
                            logAppEvent('habit_checkin_shared', {
                                userId: user?.details?.id,
                                source: source || 'checkinDetail',
                            });
                            showToast.success({
                                text1: translate('pages.habits.checkinProof.sharedTitle'),
                            });
                        })
                        .catch(() => {
                            showToast.error({
                                text1: translate('pages.habits.checkinProof.shareFailed'),
                            });
                        });
                } else {
                    showToast.success({
                        text1: translate('pages.habits.checkinToast.detailSavedTitle'),
                    });
                }

                // The streak card reads `habits.streaks`, which this re-POST can move only in
                // edge cases — but the screen it returns to renders from it either way.
                getActiveStreaks().catch(() => {});
                navigation.goBack();
            })
            .catch((err: any) => {
                setIsSubmitting(false);
                showToast.error({
                    text1: translate('alertTitles.backendErrorMessage'),
                    // `getApiErrorMessage` withholds a 5xx body, which is an internal token
                    // rather than copy — see the note in utilities/apiErrorMessage.
                    text2: getApiErrorMessage(err) || translate(image
                        ? 'pages.habits.checkinProof.uploadFailed'
                        : 'pages.habits.checkinError'),
                });
            });
    };

    return (
        <>
            <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
            <SafeAreaView
                edges={['bottom']}
                style={[theme.styles.safeAreaView, { backgroundColor: theme.colors.backgroundGray }]}
            >
                <View style={[theme.styles.body, { backgroundColor: theme.colors.backgroundGray }]}>
                    <KeyboardAwareScrollView
                        contentContainerStyle={localStyles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        <CheckinDetailForm
                            isSubmitting={isSubmitting}
                            habitName={habitName}
                            userId={user?.details?.id}
                            canShare={isFeedEnabled}
                            defaultSharePublicly={isFeedEnabled && !!user?.settings?.settingsIsProfilePublic}
                            isSavingsGoal={isSavingsGoal}
                            currencyCode={currencyCode}
                            onChange={handleDraftChange}
                            translate={translate}
                            colors={theme.colors}
                            styles={themeHabits.styles}
                        />
                    </KeyboardAwareScrollView>
                    <View style={[localStyles.footer, { borderTopColor: theme.colors.textGray }]}>
                        <Pressable
                            onPress={() => navigation.goBack()}
                            disabled={isSubmitting}
                            accessibilityRole="button"
                            style={[
                                localStyles.button,
                                localStyles.buttonSecondary,
                                { borderColor: theme.colors.brand, opacity: isSubmitting ? 0.5 : 1 },
                            ]}
                        >
                            <Text style={[localStyles.buttonText, { color: theme.colors.brand }]}>
                                {translate('pages.habits.checkinProof.cancel')}
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={handleSave}
                            disabled={isSubmitting}
                            accessibilityRole="button"
                            style={[
                                localStyles.button,
                                { backgroundColor: theme.colors.brand, opacity: isSubmitting ? 0.7 : 1 },
                            ]}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator size="small" color={theme.colors.brandingWhite} />
                            ) : (
                                <Text style={[localStyles.buttonText, { color: theme.colors.brandingWhite }]}>
                                    {translate('pages.habits.checkinProof.save')}
                                </Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            </SafeAreaView>
        </>
    );
};

const localStyles = StyleSheet.create({
    scrollContent: {
        paddingTop: 12,
        paddingBottom: 24,
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    button: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonSecondary: {
        borderWidth: 2,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});

export default connect(mapStateToProps, mapDispatchToProps)(CheckinDetail);
