import React from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { ITherrThemeColors } from '../../styles/themes';
import { radius } from '../../styles/radii';
import { space } from '../../styles/layouts/spacing';
import { fontSizes, fontWeights } from '../../styles/text';

interface IVerificationCodeInputProps {
    value: string;
    onChangeText: (value: string) => void;
    /** Fired once the final digit is entered, so the user never hunts for a submit button. */
    onComplete?: (value: string) => void;
    length?: number;
    autoFocus?: boolean;
    disabled?: boolean;
    hasError?: boolean;
    themeForms: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

/**
 * Segmented one-time-code entry.
 *
 * A single hidden `TextInput` owns the value and the keyboard; the visible cells are plain
 * views that mirror it. This is the standard approach for OTP fields — one input per cell
 * fights the platform (backspace on an empty cell, paste of a full code, and autofill all
 * break), whereas one input keeps `oneTimeCode` / `sms-otp` autofill working, which is the
 * feature users actually notice.
 */
const VerificationCodeInput = ({
    value,
    onChangeText,
    onComplete,
    length = 6,
    autoFocus = true,
    disabled = false,
    hasError = false,
    themeForms,
}: IVerificationCodeInputProps) => {
    const inputRef = React.useRef<TextInput>(null);
    const [isFocused, setIsFocused] = React.useState(autoFocus);

    const handleChange = (text: string) => {
        const digits = text.replace(/\D/g, '').slice(0, length);
        onChangeText(digits);

        if (digits.length === length) {
            onComplete?.(digits);
        }
    };

    const focusInput = () => {
        if (!disabled) {
            inputRef.current?.focus();
        }
    };

    const characters = value.split('');
    // The caret sits on the first empty cell, or stays on the last one when full.
    const activeIndex = Math.min(characters.length, length - 1);

    return (
        <Pressable onPress={focusInput} accessibilityRole="none">
            <View style={localStyles.cellRow}>
                {Array.from({ length }).map((_, index) => {
                    const isActive = isFocused && index === activeIndex && !disabled;
                    const cellBorderColor = (() => {
                        if (hasError) return themeForms.colors.alertError;
                        if (isActive) return themeForms.colors.brand;
                        return themeForms.colors.border;
                    })();

                    return (
                        <View
                            key={index}
                            style={[
                                localStyles.cell,
                                {
                                    borderColor: cellBorderColor,
                                    backgroundColor: themeForms.colors.surfaceAlt,
                                    borderWidth: isActive || hasError ? 2 : 1,
                                },
                            ]}
                        >
                            <Text style={[localStyles.cellText, { color: themeForms.colors.onSurface }]}>
                                {characters[index] || ''}
                            </Text>
                        </View>
                    );
                })}
            </View>
            <TextInput
                ref={inputRef}
                value={value}
                onChangeText={handleChange}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                autoFocus={autoFocus}
                editable={!disabled}
                maxLength={length}
                caretHidden
                style={localStyles.hiddenInput}
                testID="verification-code-input"
            />
        </Pressable>
    );
};

const localStyles = StyleSheet.create({
    cellRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: space.sm,
    },
    cell: {
        width: 46,
        height: 58,
        borderRadius: radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cellText: {
        fontSize: fontSizes.xxl,
        fontWeight: fontWeights.bold,
    },
    // Stretched over the cells rather than `display: none` so taps land on it and the
    // keyboard opens; `opacity: 0` keeps the native caret and selection invisible.
    hiddenInput: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0,
    },
});

export default VerificationCodeInput;
