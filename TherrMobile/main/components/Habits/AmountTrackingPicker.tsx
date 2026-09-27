import React from 'react';
import {
    Pressable, StyleSheet, Text, View,
} from 'react-native';
import { Switch } from 'react-native-paper';
import { HABIT_AMOUNT_UNITS, HabitAmountUnit } from 'therr-js-utilities/constants';
import { ITherrThemeColors } from '../../styles/themes';
import { getHabitAmountUnitLabel, getHabitAmountUnitShort } from '../../utilities/habitAmountFormat';
import { IAmountTrackingChoice } from '../../routes/Pacts/amountTrackingOptions';
import SavingsAmountInput from './SavingsAmountInput';

/**
 * "Track an amount" on a habit that is not a savings goal: an off-by-default switch, then
 * what is being counted and an optional weekly target. Used by the create wizard's
 * configure step and by the habit detail editor.
 *
 * Nothing here is required. The switch starts off, and once on, a target can be left blank.
 * A savings habit never shows this: it always tracks an amount, in its currency.
 */
interface IAmountTrackingPickerProps {
    value: IAmountTrackingChoice;
    onChange: (next: IAmountTrackingChoice) => void;
    themeHabits: {
        colors: ITherrThemeColors;
        styles: any;
    };
    translate: (key: string, params?: any) => string;
    /** Shows "choose a unit" under the chips once the user has tried to move on without one. */
    showUnitError?: boolean;
}

const AmountTrackingPicker: React.FC<IAmountTrackingPickerProps> = ({
    value,
    onChange,
    themeHabits,
    translate,
    showUnitError = false,
}) => {
    const toggle = (enabled: boolean) => onChange({ ...value, enabled });
    const selectUnit = (unit: HabitAmountUnit) => onChange({ ...value, unit });

    return (
        <View style={themeHabits.styles.cadenceSection}>
            <Pressable
                onPress={() => toggle(!value.enabled)}
                accessibilityRole="switch"
                accessibilityState={{ checked: value.enabled }}
                accessibilityHint={translate('pages.habits.amounts.toggleHint')}
                style={[
                    themeHabits.styles.choiceCard,
                    localStyles.toggleRow,
                    value.enabled && themeHabits.styles.choiceCardSelected,
                ]}
            >
                <View style={localStyles.toggleText}>
                    <Text style={themeHabits.styles.choiceCardLabel}>
                        {translate('pages.habits.amounts.toggleLabel')}
                    </Text>
                    <Text style={themeHabits.styles.habitCardSubtitle}>
                        {translate('pages.habits.amounts.toggleHint')}
                    </Text>
                </View>
                {/* The whole row is the control for screen readers; the switch is its visual. */}
                <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                    <Switch
                        value={value.enabled}
                        onValueChange={toggle}
                        color={themeHabits.colors.brand}
                    />
                </View>
            </Pressable>

            {value.enabled && (
                <View>
                    <Text style={[themeHabits.styles.cadenceSectionLabel, localStyles.unitLabel]}>
                        {translate('pages.habits.amounts.unitLabel')}
                    </Text>
                    <View style={localStyles.chipRow} accessibilityRole="radiogroup">
                        {HABIT_AMOUNT_UNITS.map((unit) => {
                            const isSelected = value.unit === unit;

                            return (
                                <Pressable
                                    key={unit}
                                    onPress={() => selectUnit(unit)}
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected: isSelected }}
                                    accessibilityLabel={getHabitAmountUnitLabel(unit, translate)}
                                    style={[
                                        themeHabits.styles.cadenceOption,
                                        localStyles.chip,
                                        isSelected && themeHabits.styles.cadenceOptionSelected,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            themeHabits.styles.cadenceOptionText,
                                            isSelected && themeHabits.styles.cadenceOptionTextSelected,
                                        ]}
                                    >
                                        {getHabitAmountUnitLabel(unit, translate)}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                    {showUnitError && !value.unit ? (
                        <Text style={[localStyles.error, { color: themeHabits.colors.alertError }]}>
                            {translate('pages.habits.amounts.chooseUnit')}
                        </Text>
                    ) : null}

                    {!!value.unit && (
                        <View style={localStyles.targetInput}>
                            <SavingsAmountInput
                                value={value.targetText}
                                onChangeText={(targetText) => onChange({ ...value, targetText })}
                                unitLabel={getHabitAmountUnitShort(value.unit, translate)}
                                label={translate('pages.habits.amounts.weeklyTargetLabel')}
                                hint={translate('pages.habits.amounts.weeklyTargetHint')}
                                translate={translate}
                                colors={themeHabits.colors}
                            />
                        </View>
                    )}
                </View>
            )}
        </View>
    );
};

const localStyles = StyleSheet.create({
    toggleRow: {
        alignItems: 'center',
        marginTop: 12,
    },
    toggleText: {
        flex: 1,
    },
    unitLabel: {
        marginTop: 8,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        marginBottom: 0,
    },
    error: {
        fontSize: 12,
        paddingTop: 6,
    },
    targetInput: {
        marginTop: 12,
        // SavingsAmountInput pads itself for use inside a form; this section already does.
        marginHorizontal: -10,
    },
});

export default AmountTrackingPicker;
