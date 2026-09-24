import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ITherrThemeColors } from '../../styles/themes';
import {
    clampWeeklyCount,
    fromGoal,
    isComplete,
    sanitizeWeekdays,
    toggleWeekday,
    CadenceChoice,
    DEFAULT_WEEKLY_COUNT,
    MAX_WEEKLY_COUNT,
    MIN_WEEKLY_COUNT,
} from '../../routes/Pacts/cadenceOptions';

/**
 * How often a habit asks for a check-in.
 *
 * Three shapes, because the backend supports three and leaving one out would make it
 * unreachable from the app while the habit card happily renders it. See
 * `routes/Pacts/cadenceOptions.ts` for what each one sends.
 *
 * The rule the user is actually agreeing to, and the reason this control exists: on a day the
 * cadence does not ask for, nothing is lost — no broken streak, and no streak freeze spent.
 * Before cadence was selectable, every habit was daily and someone doing four workouts a week
 * burned a freeze on each of their three off days.
 */

interface ICadencePickerProps {
    value: CadenceChoice;
    onChange: (next: CadenceChoice) => void;
    themeHabits: {
        colors: ITherrThemeColors;
        styles: any;
    };
    translate: (key: string, params?: any) => string;
    /** Hides the section heading where the surrounding screen already provides one. */
    hideLabel?: boolean;
}

/** Sunday-first, matching `targetDaysOfWeek` and the existing `daysOfWeekShort` dictionary. */
const DAY_SHORT_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * The count a user lands on when they pick "N times a week" from another shape.
 *
 * Carried over from the current choice where there is one, so switching to weekday mode and
 * back does not silently reset a number they already set.
 */
const resolveInitialCount = (value: CadenceChoice): number => {
    if (value.kind === 'weeklyCount') {
        return clampWeeklyCount(value.count);
    }
    if (value.kind === 'weekdays') {
        const days = sanitizeWeekdays(value.days);
        return days.length ? clampWeeklyCount(days.length) : DEFAULT_WEEKLY_COUNT;
    }
    return DEFAULT_WEEKLY_COUNT;
};

const CadencePicker: React.FC<ICadencePickerProps> = ({
    value,
    onChange,
    themeHabits,
    translate,
    hideLabel,
}) => {
    const selectedDays = value.kind === 'weekdays' ? sanitizeWeekdays(value.days) : [];
    const weeklyCount = value.kind === 'weeklyCount' ? clampWeeklyCount(value.count) : resolveInitialCount(value);

    const renderOption = (kind: CadenceChoice['kind'], labelKey: string, trailing?: React.ReactNode) => {
        const isSelected = value.kind === kind;

        return (
            <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={translate(labelKey, { count: weeklyCount })}
                onPress={() => {
                    if (isSelected) {
                        return;
                    }
                    if (kind === 'daily') {
                        onChange({ kind: 'daily' });
                    } else if (kind === 'weeklyCount') {
                        onChange({ kind: 'weeklyCount', count: resolveInitialCount(value) });
                    } else {
                        // Opens empty on purpose. Pre-selecting days would put words in the
                        // user's mouth about which ones, and `isComplete` stops them advancing
                        // until they say.
                        onChange({ kind: 'weekdays', days: [] });
                    }
                }}
                style={[
                    themeHabits.styles.cadenceOption,
                    isSelected && themeHabits.styles.cadenceOptionSelected,
                ]}
            >
                <Text
                    style={[
                        themeHabits.styles.cadenceOptionText,
                        isSelected && themeHabits.styles.cadenceOptionTextSelected,
                    ]}
                >
                    {translate(labelKey, { count: weeklyCount })}
                </Text>
                {isSelected && trailing}
            </Pressable>
        );
    };

    const renderStepper = () => {
        const setCount = (next: number) => onChange({ kind: 'weeklyCount', count: clampWeeklyCount(next) });
        const canDecrease = weeklyCount > MIN_WEEKLY_COUNT;
        const canIncrease = weeklyCount < MAX_WEEKLY_COUNT;

        return (
            <View style={themeHabits.styles.cadenceStepperRow}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={translate('pages.habits.cadence.decreaseCount')}
                    accessibilityState={{ disabled: !canDecrease }}
                    disabled={!canDecrease}
                    onPress={() => setCount(weeklyCount - 1)}
                    style={[
                        themeHabits.styles.cadenceStepperButton,
                        !canDecrease && themeHabits.styles.cadenceStepperButtonDisabled,
                    ]}
                >
                    <Text style={themeHabits.styles.cadenceStepperButtonText}>{'−'}</Text>
                </Pressable>
                <Text style={themeHabits.styles.cadenceStepperValue}>{weeklyCount}</Text>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={translate('pages.habits.cadence.increaseCount')}
                    accessibilityState={{ disabled: !canIncrease }}
                    disabled={!canIncrease}
                    onPress={() => setCount(weeklyCount + 1)}
                    style={[
                        themeHabits.styles.cadenceStepperButton,
                        !canIncrease && themeHabits.styles.cadenceStepperButtonDisabled,
                    ]}
                >
                    <Text style={themeHabits.styles.cadenceStepperButtonText}>{'+'}</Text>
                </Pressable>
            </View>
        );
    };

    return (
        <View style={themeHabits.styles.cadenceSection}>
            {!hideLabel && (
                <Text style={themeHabits.styles.cadenceSectionLabel}>
                    {translate('pages.habits.cadence.sectionLabel')}
                </Text>
            )}

            {renderOption('daily', 'pages.habits.cadence.optionDaily')}
            {renderOption('weeklyCount', 'pages.habits.cadence.optionWeeklyCount', renderStepper())}
            {renderOption('weekdays', 'pages.habits.cadence.optionWeekdays')}

            {value.kind === 'weekdays' && (
                <>
                    <View style={themeHabits.styles.cadenceWeekdayRow}>
                        {DAY_SHORT_KEYS.map((dayKey, index) => {
                            const isSelected = selectedDays.includes(index);

                            return (
                                <Pressable
                                    key={dayKey}
                                    accessibilityRole="checkbox"
                                    accessibilityState={{ checked: isSelected }}
                                    accessibilityLabel={translate(`pages.habits.daysOfWeekShort.${dayKey}`)}
                                    onPress={() => onChange(toggleWeekday(value, index))}
                                    style={[
                                        themeHabits.styles.cadenceWeekdayChip,
                                        isSelected && themeHabits.styles.cadenceWeekdayChipSelected,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            themeHabits.styles.cadenceWeekdayChipText,
                                            isSelected && themeHabits.styles.cadenceWeekdayChipTextSelected,
                                        ]}
                                    >
                                        {translate(`pages.habits.daysOfWeekShort.${dayKey}`)}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                    {!isComplete(value) && (
                        <Text style={[themeHabits.styles.cadenceHint, themeHabits.styles.cadenceHintWarning]}>
                            {translate('pages.habits.cadence.pickAtLeastOneDay')}
                        </Text>
                    )}
                </>
            )}

            <Text style={themeHabits.styles.cadenceHint}>
                {translate('pages.habits.cadence.restDayHint')}
            </Text>
        </View>
    );
};

export { fromGoal };
export default CadencePicker;
