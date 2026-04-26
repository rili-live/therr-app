import React from 'react';
import { Platform, StyleSheet, View, TextInputProps } from 'react-native';
import { TextInput as PaperTextInput, HelperText } from 'react-native-paper';
import 'react-native-gesture-handler';
import { ITherrThemeColors } from '../../styles/themes';

const inputStyles = StyleSheet.create({
    transparentBg: {
        backgroundColor: 'transparent',
    },
    hidden: {
        display: 'none',
    },
});

export type InputVariant = 'round' | 'square' | 'accent';

// Props interface for the BaseInput component.
export interface IBaseInputProps extends TextInputProps {
    themeForms: {
        colors: ITherrThemeColors;
        styles: any;
    };
    /**
     * Visual treatment. When set, BaseInput pulls the appropriate overrides
     * from `themeForms.styles` so callers don't have to thread containerStyle/
     * inputContainerStyle/inputStyle by hand. When omitted, legacy callers
     * (which pass those style props explicitly) keep working unchanged.
     *
     * Replaces the standalone Round/Square/Accent wrapper components.
     */
    variant?: InputVariant;
    containerStyle?: any;
    inputContainerStyle?: any;
    inputStyle?: any;
    label?: string;
    labelStyle?: any;
    rightIcon?: React.ReactNode;
    leftIcon?: React.ReactNode;
    rightIconContainerStyle?: any;
    leftIconContainerStyle?: any;
    errorMessage?: string;
    errorStyle?: any;
    disabled?: boolean;
    renderErrorMessage?: boolean;
    // Paper-specific escape hatches
    paperMode?: 'flat' | 'outlined';
    underlineColor?: string;
    activeUnderlineColor?: string;
    underlineStyle?: any;
    dense?: boolean;
    roundness?: number;
    // Paper TextInput render override. Useful to bypass Paper's deferred
    // placeholder state (which is initialized to ' ' and only swapped to
    // the real value via a 50ms timer that races with native-stack header
    // animations, leaving headers blank on first render).
    render?: (props: any) => React.ReactNode;
}

// BaseInput wrapping react-native-paper TextInput.
export class BaseInput extends React.Component<IBaseInputProps, any> {
    constructor(props: IBaseInputProps) {
        super(props);
    }

    render() {
        /* eslint-disable @typescript-eslint/no-unused-vars */
        const {
            themeForms,
            variant,
            containerStyle,
            inputContainerStyle,
            inputStyle,
            label,
            labelStyle: _labelStyle,
            rightIcon,
            leftIcon,
            rightIconContainerStyle: _rightIconContainerStyle,
            leftIconContainerStyle: _leftIconContainerStyle,
            errorMessage,
            errorStyle: _errorStyle,
            disabled,
            renderErrorMessage,
            paperMode,
            underlineColor: underlineColorProp,
            activeUnderlineColor: activeUnderlineColorProp,
            underlineStyle: underlineStyleProp,
            roundness: roundnessProp,
            style,
            value,
            placeholderTextColor: placeholderTextColorProp,
            selectionColor: selectionColorProp,
            // Separate TextInput-native props
            ...textInputProps
        } = this.props;
        /* eslint-enable @typescript-eslint/no-unused-vars */

        // Variant-driven style overrides. Each variant matches the existing
        // Round/Square/Accent wrappers exactly so call sites can swap from
        // <RoundInput /> to <BaseInput variant="round" /> without visual drift.
        const variantContainerStyle = variant === 'round'
            ? themeForms.styles.containerRound
            : undefined;
        const variantInputContainerStyle = (() => {
            if (variant === 'round') return themeForms.styles.inputContainerRound;
            if (variant === 'square') return themeForms.styles.inputContainerSquare;
            return undefined;
        })();
        const variantInputStyle = (() => {
            if (variant === 'round') {
                return Platform.OS !== 'ios' ? themeForms.styles.input : themeForms.styles.inputAlt;
            }
            if (variant === 'accent') return themeForms.styles.inputAccent;
            return undefined;
        })();
        const variantStyle = variant === 'round'
            ? (!value?.length ? themeForms.styles.placeholderText : themeForms.styles.inputText)
            : undefined;
        const variantUnderlineStyle = variant === 'round' ? inputStyles.hidden : undefined;
        const variantRoundness = variant === 'round' ? 15 : undefined;
        const variantPlaceholderColor = variant === 'round'
            ? themeForms.styles.placeholderText.color
            : undefined;
        const variantSelectionColor = variant === 'accent'
            ? themeForms.colors.accentYellow
            : undefined;

        const mode = paperMode || 'flat';

        // Map RNE rightIcon/leftIcon to Paper ReactNode props
        const right = rightIcon ? <View>{rightIcon}</View> : undefined;
        const left = leftIcon ? <View>{leftIcon}</View> : undefined;

        // Underline colors match the existing bottom-border styling.
        // Transparent background preserves the pre-migration appearance
        // where inputs had no filled background.
        const underlineColor = underlineColorProp || themeForms.colors.textDarkGray || 'gray';
        const activeColor = activeUnderlineColorProp || themeForms.colors.primary3 || '#1C7F8A';

        // Paper's flat TextInput internally applies borderTopLeftRadius and
        // borderTopRightRadius from theme.roundness (default ~4). Without
        // overriding this, the top corners appear less curved than the bottom
        // corners when a custom borderRadius (e.g. 15) is set in inputContainerStyle.
        const roundness = roundnessProp ?? variantRoundness;
        const paperTheme = roundness != null ? { roundness } : undefined;

        // Compose the final inputStyle: variant default first, caller override
        // last. Matches the precedence Round/Square/Accent used to apply.
        const composedInputStyle = inputStyle != null
            ? (variantInputStyle != null ? [variantInputStyle, inputStyle] : inputStyle)
            : variantInputStyle;

        return (
            <View style={containerStyle ?? variantContainerStyle}>
                <PaperTextInput
                    mode={mode}
                    label={label}
                    cursorColor={themeForms.colors.selectionColor as unknown as string}
                    selectionColor={(selectionColorProp ?? variantSelectionColor ?? themeForms.colors.selectionColor) as unknown as string}
                    underlineColor={underlineColor as string}
                    activeUnderlineColor={activeColor as string}
                    underlineStyle={underlineStyleProp ?? variantUnderlineStyle}
                    disabled={disabled}
                    error={!!errorMessage}
                    right={right}
                    left={left}
                    theme={paperTheme}
                    placeholderTextColor={placeholderTextColorProp ?? variantPlaceholderColor}
                    value={value}
                    style={[
                        inputStyles.transparentBg,
                        inputContainerStyle ?? variantInputContainerStyle,
                        composedInputStyle ?? themeForms.styles.input,
                        variantStyle,
                        style,
                    ]}
                    contentStyle={composedInputStyle}
                    {...textInputProps}
                />
                {(errorMessage || renderErrorMessage !== false) && errorMessage ? (
                    <HelperText type="error" visible={!!errorMessage}>
                        {errorMessage}
                    </HelperText>
                ) : null}
            </View>
        );
    }
}

export default BaseInput;
