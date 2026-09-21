import React from 'react';
import {
    StyleSheet, Text, TextInput, View,
} from 'react-native';
import { parseSavingsAmount, SavingsAmountError } from 'therr-js-utilities/constants';
import { ITherrThemeColors } from '../../styles/themes';

/**
 * The money field for a savings habit — used by the check-in form and by the
 * create-habit wizard's target step.
 *
 * It keeps the raw text the user typed rather than a parsed number, which matters while
 * they are mid-entry: storing a number would make "12." unrepresentable and the field
 * would fight the keyboard by deleting the decimal point as soon as it was typed.
 * Parsing happens on every keystroke for the error message, and the parsed value is
 * lifted so the caller never has to re-derive it.
 *
 * Validation goes through the same `parseSavingsAmount` the users-service applies, so
 * the client cannot accept a value the server will reject — which for the notification
 * path is silent, and here would mean a check-in the user believes recorded an amount
 * that did not.
 */

const ERROR_KEY_BY_REASON: Record<SavingsAmountError, string> = {
    'not-a-number': 'pages.habits.savings.errorNotANumber',
    negative: 'pages.habits.savings.errorNegative',
    'too-large': 'pages.habits.savings.errorTooLarge',
    'too-precise': 'pages.habits.savings.errorTooPrecise',
};

export interface ISavingsAmountInputProps {
    value: string;
    onChangeText: (text: string) => void;
    /** Called with the parsed amount, or null while the text is empty or invalid. */
    onValueChange?: (amount: number | null) => void;
    currencyCode?: string | null;
    label: string;
    placeholder?: string;
    hint?: string;
    editable?: boolean;
    translate: (key: string, params?: any) => string;
    colors: ITherrThemeColors;
}

const SavingsAmountInput: React.FC<ISavingsAmountInputProps> = ({
    value,
    onChangeText,
    onValueChange,
    currencyCode,
    label,
    placeholder,
    hint,
    editable = true,
    translate,
    colors,
}) => {
    const parsed = parseSavingsAmount(value);
    // An empty field is not an error — it is "no amount recorded", which is a valid way
    // to complete a savings check-in. Only non-empty input can be wrong.
    const errorKey = value.trim().length && parsed.error ? ERROR_KEY_BY_REASON[parsed.error] : null;

    const handleChange = (text: string) => {
        onChangeText(text);

        if (onValueChange) {
            const next = parseSavingsAmount(text);
            onValueChange(next.error || next.amount === undefined ? null : next.amount);
        }
    };

    return (
        <View style={localStyles.container}>
            <Text style={[localStyles.label, { color: colors.textWhite }]}>{label}</Text>
            <View
                style={[
                    localStyles.inputRow,
                    {
                        borderColor: errorKey ? colors.alertError : colors.textGray,
                    },
                ]}
            >
                <Text style={[localStyles.currency, { color: colors.textGray }]}>
                    {(currencyCode || 'USD').toUpperCase()}
                </Text>
                <TextInput
                    value={value}
                    onChangeText={handleChange}
                    // `decimal-pad` rather than `numeric`: `numeric` shows a full phone-style
                    // keypad on Android with no decimal separator on some OEM keyboards, which
                    // makes cents unenterable.
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    placeholder={placeholder || '0'}
                    placeholderTextColor={colors.textGray}
                    editable={editable}
                    style={[localStyles.input, { color: colors.textWhite }]}
                    accessibilityLabel={label}
                />
            </View>
            {errorKey ? (
                <Text style={[localStyles.message, { color: colors.alertError }]}>
                    {translate(errorKey)}
                </Text>
            ) : null}
            {!errorKey && hint ? (
                <Text style={[localStyles.message, { color: colors.textGray }]}>{hint}</Text>
            ) : null}
        </View>
    );
};

const localStyles = StyleSheet.create({
    container: {
        paddingHorizontal: 10,
        paddingBottom: 12,
    },
    label: {
        fontSize: 15,
        fontWeight: '600',
        paddingBottom: 6,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        gap: 8,
    },
    currency: {
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    input: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 16,
    },
    message: {
        fontSize: 12,
        paddingTop: 4,
    },
});

export default SavingsAmountInput;
