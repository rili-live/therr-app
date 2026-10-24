import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { connect } from 'react-redux';
import Toast from 'react-native-toast-message';
import { HabitsChallengesService } from 'therr-react/services';
import { IUserState } from 'therr-react/types';
import { buildStyles } from '../../styles';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import { buttonMenuHeight } from '../../styles/navigation/buttonMenu';
import spacingStyles from '../../styles/layouts/spacing';
import translator from '../../utilities/translator';
import { getApiErrorMessage } from '../../utilities/apiErrorMessage';
import { logAppEvent } from '../../utilities/analyticsEvents';
import getDeviceTimeZone from '../../utilities/deviceTimeZone';
import BaseStatusBar from '../../components/BaseStatusBar';
import {
    CHALLENGE_DURATIONS,
    CHALLENGE_TITLE_MAX_LENGTH,
    DEFAULT_CHALLENGE_DURATION,
    isChallenge,
} from './challengeFormat';

interface ICreateChallengeProps {
    user: IUserState;
    navigation: any;
    // Params: `habitGoalId` (required, a habit the user tracks), `habitName?` for the copy.
    route: any;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

/**
 * Start a challenge on a habit the user already tracks, then hand them the link.
 *
 * Two choices and nothing else — how long, and an optional name — because the point of the
 * screen is the share sheet on the next one. The server picks the start date (the user's own
 * today) and refuses a habit they are not tracking.
 */
export const CreateChallenge: React.FC<ICreateChallengeProps> = ({ user, navigation, route }) => {
    const themeName = user.settings?.mobileThemeName;
    const theme = useMemo(() => buildStyles(themeName), [themeName]);
    const themeHabits = useMemo(() => buildHabitStyles(themeName), [themeName]);
    const locale = user.settings?.locale || 'en-us';
    const translate = useCallback((key: string, params?: any) => translator(locale, key, params), [locale]);
    const { styles } = themeHabits;

    const habitGoalId: string | undefined = route?.params?.habitGoalId;
    const habitName: string = route?.params?.habitName || '';

    const [durationDays, setDurationDays] = useState(DEFAULT_CHALLENGE_DURATION);
    const [title, setTitle] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        navigation.setOptions({ title: translate('pages.challenges.createHeaderTitle') });
        return () => { isMounted.current = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCreate = () => {
        if (!habitGoalId || isSubmitting) return;
        setIsSubmitting(true);

        const timeZone = getDeviceTimeZone() || undefined;

        HabitsChallengesService.create({
            habitGoalId,
            durationDays,
            title: title.trim() || undefined,
            timeZone,
        })
            .then((response: any) => {
                if (!isChallenge(response?.data)) {
                    throw new Error('unexpected-response');
                }
                logAppEvent('habit_challenge_create', { userId: user.details?.id, durationDays });
                // Replace, so Back from the challenge returns to the habit rather than this form.
                navigation.replace('ChallengeDetail', { joinToken: response.data.joinToken, justCreated: true });
            })
            .catch((error: any) => {
                Toast.show({
                    type: 'error',
                    text1: translate('pages.challenges.errorTitle'),
                    text2: getApiErrorMessage(error) || translate('pages.challenges.createError'),
                    visibilityTime: 3500,
                });
            })
            .finally(() => {
                if (isMounted.current) setIsSubmitting(false);
            });
    };

    return (
        <>
            <BaseStatusBar therrThemeName={themeName} />
            <SafeAreaView edges={[]} style={[theme.styles.safeAreaView, styles.dashboardContainer]}>
                <KeyboardAvoidingView behavior="padding" style={styles.challengeFlex}>
                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={[spacingStyles.padMd, { paddingBottom: buttonMenuHeight + 16 }]}
                    >
                        <View style={styles.challengeCard}>
                            <Text style={styles.challengeSectionTitle}>
                                {habitName
                                    ? translate('pages.challenges.createHeadingHabit', { habitName })
                                    : translate('pages.challenges.createHeading')}
                            </Text>
                            <Text style={[styles.challengeHint, spacingStyles.marginBotSm]}>
                                {translate('pages.challenges.createIntro')}
                            </Text>

                            <Text style={[styles.challengeSectionTitle, spacingStyles.marginBotSm]}>
                                {translate('pages.challenges.durationLabel')}
                            </Text>
                            <View style={styles.challengeOptionRow} accessibilityRole="radiogroup">
                                {CHALLENGE_DURATIONS.map((days) => {
                                    const isSelected = days === durationDays;
                                    return (
                                        <Pressable
                                            key={days}
                                            accessibilityRole="radio"
                                            accessibilityState={{ selected: isSelected }}
                                            accessibilityLabel={translate('pages.challenges.durationOption', { days })}
                                            onPress={() => setDurationDays(days)}
                                            style={({ pressed }) => [
                                                styles.challengeOption,
                                                isSelected && styles.challengeOptionSelected,
                                                pressed && styles.pressedOpacity,
                                            ]}
                                        >
                                            <Text style={[styles.challengeOptionText, isSelected && styles.challengeOptionTextSelected]}>
                                                {translate('pages.challenges.durationShort', { days })}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>

                            <Text style={[styles.challengeSectionTitle, styles.challengeFieldLabel]}>
                                {translate('pages.challenges.titleLabel')}
                            </Text>
                            <TextInput
                                value={title}
                                onChangeText={setTitle}
                                maxLength={CHALLENGE_TITLE_MAX_LENGTH}
                                placeholder={habitName || translate('pages.challenges.titlePlaceholder')}
                                placeholderTextColor={themeHabits.colors.onSurfaceMuted}
                                accessibilityLabel={translate('pages.challenges.titleLabel')}
                                returnKeyType="done"
                                style={styles.challengeInput}
                            />
                            <Text style={[styles.challengeHint, styles.challengeFieldNote]}>
                                {translate('pages.challenges.privacyNote')}
                            </Text>
                        </View>

                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={translate('pages.challenges.createButton')}
                            disabled={!habitGoalId || isSubmitting}
                            onPress={handleCreate}
                            style={({ pressed }) => [
                                styles.myHabitsPrimaryButton,
                                (pressed || isSubmitting || !habitGoalId) && styles.pressedOpacity,
                            ]}
                        >
                            {isSubmitting
                                ? <ActivityIndicator color={themeHabits.colors.onBrand} />
                                : <Text style={styles.myHabitsPrimaryButtonText}>{translate('pages.challenges.createButton')}</Text>}
                        </Pressable>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </>
    );
};

export default connect(mapStateToProps)(CreateChallenge);
