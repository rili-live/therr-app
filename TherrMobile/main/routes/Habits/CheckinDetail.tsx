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
import { HabitCheckinsService } from 'therr-react/services';
import { IHabitCheckin, IHabitsState, IUserState } from 'therr-react/types';
import BaseStatusBar from '../../components/BaseStatusBar';
import CheckinDetailForm, { ICheckinDetailDraft } from '../../components/Habits/CheckinDetailForm';
import { getApiErrorMessage } from '../../utilities/apiErrorMessage';
import celebrationQueue from '../../utilities/celebrationQueue';
import uploadCheckinProofImage from '../../utilities/checkinProofUpload';
import { CHECKIN_PROOF_XP } from '../../constants/checkinProofXp';
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
    /** A measured habit's unit, which offers an optional amount field. Absent: no field. */
    amountUnit?: string | null;
}

interface ICheckinDetailProps {
    navigation: any;
    // `any` rather than `{ params: ICheckinDetailParams }`: a narrower `route` makes the
    // connected component unassignable to React Navigation's ScreenComponentType. The params
    // are read through one typed destructure below instead.
    route: any;
    user: IUserState;
    habits: IHabitsState;
    createCheckin: Function;
    shareCheckin: Function;
    getActiveStreaks: Function;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    habits: state.habits,
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
    habits,
    createCheckin,
    shareCheckin,
    getActiveStreaks,
}: ICheckinDetailProps) => {
    const {
        habitGoalId, habitName, source, goalType, currencyCode, amountUnit,
    } = route.params || ({} as ICheckinDetailParams);
    const isSavingsGoal = goalType === HabitGoalTypes.SAVINGS_GOAL;
    const [isSubmitting, setIsSubmitting] = useState(false);
    const draftRef = useRef<ICheckinDetailDraft>({
        notes: '',
        image: null,
        sharePublicly: false,
    });
    // Today's check-in for this habit, if one exists, so the form opens showing what was
    // already saved instead of an empty note and an amount of 0. Seeded from the store for
    // an instant first paint, then refreshed from the server below — an amount may have
    // been logged since the store loaded (the notification quick-reply writes one).
    const [existingCheckin, setExistingCheckin] = useState<IHabitCheckin | undefined>(
        // Matched on the day as well: the store's today list can be from before midnight,
        // and prefilling yesterday's note would save it onto today's row.
        () => habits?.todayCheckins?.find((c: IHabitCheckin) => c.habitGoalId === habitGoalId
            && String(c.scheduledDate || '').slice(0, 10) === toLocalDateKey(new Date())),
    );

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

    // Fetched through the service rather than `getTodayCheckins`, which would replace the
    // store's whole today list with this one habit's row and blank every other card on the
    // dashboard this screen returns to.
    useEffect(() => {
        if (!habitGoalId) {
            return undefined;
        }
        let isCancelled = false;
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        HabitCheckinsService.getTodayCheckins(habitGoalId, timeZone)
            .then((response: any) => {
                if (isCancelled || response?.isOfflineFallback || !Array.isArray(response?.data)) {
                    return;
                }
                const checkin = response.data.find((c: IHabitCheckin) => c.habitGoalId === habitGoalId);
                if (checkin) {
                    setExistingCheckin(checkin);
                }
            })
            .catch(() => {
                // The store's copy (or an empty form) stands; the save still works.
            });

        return () => {
            isCancelled = true;
        };
    }, [habitGoalId]);

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
        const existingNotes = (existingCheckin?.notes || '').trim();
        const existingAmount = existingCheckin?.savedAmount ?? null;
        // Only what the user changed travels. The form is prefilled with the saved row, so
        // re-sending it unchanged would be a pointless re-POST; and an emptied note is sent
        // as '' so clearing a prefilled note actually clears it.
        const hasNotesChange = trimmedNotes !== existingNotes;
        const hasAmountChange = savedAmount !== undefined && savedAmount !== existingAmount;

        // The amount field is already showing why the text does not parse. Submitting
        // anyway would save the check-in without the number the user typed.
        if (hasInvalidSavedAmount) {
            return;
        }

        // An amount counts as something to attach. Without this, a savings check-in whose
        // only content is the number — which is the common case, and the whole point of
        // the feature — would be treated as an empty save and silently discarded.
        // Nothing changed — treat Save as Done rather than re-POSTing the check-in for no
        // reason.
        if (!hasNotesChange && !image && !hasAmountChange) {
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
                ...(hasNotesChange ? { notes: trimmedNotes } : {}),
                proofMedias,
                // Spread so the key is genuinely absent unless the amount changed. The POST
                // upserts today's row and an explicit null clears an amount already logged
                // today, so null is only sent when the user emptied a prefilled amount.
                ...(hasAmountChange ? { savedAmount } : {}),
            }))
            .then((checkin: any) => {
                // What the note/photo earned on the leaderboard, as the service decided it.
                // Zero when this save added nothing new (a re-save, a note too short to count,
                // or proof that was already paid for) — the plain "saved" copy covers that.
                const proofXpEarned = Number(checkin?.proofXpEarned) || 0;
                const proofXpTitle = proofXpEarned > 0
                    ? translate('pages.habits.checkinToast.proofXpTitle', { points: proofXpEarned })
                    : undefined;
                // A photo is worth the most, so a note-only save is nudged toward one next time.
                const proofXpBody = proofXpEarned > 0
                    ? translate(image
                        ? 'pages.habits.checkinToast.proofXpBodyPhoto'
                        : 'pages.habits.checkinToast.proofXpBodyNote', { photoPoints: CHECKIN_PROOF_XP.photo })
                    : undefined;

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
                                text2: proofXpTitle,
                            });
                        })
                        .catch(() => {
                            showToast.error({
                                text1: translate('pages.habits.checkinProof.shareFailed'),
                            });
                        });
                } else {
                    showToast.success({
                        text1: proofXpTitle || translate('pages.habits.checkinToast.detailSavedTitle'),
                        text2: proofXpBody,
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
                            amountUnit={amountUnit}
                            initialNotes={existingCheckin?.notes}
                            initialSavedAmount={existingCheckin?.savedAmount}
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
