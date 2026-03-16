import React from 'react';
import { View, TextInputProps } from 'react-native';
import { TextInput as PaperTextInput, HelperText } from 'react-native-paper';
import 'react-native-gesture-handler';
import { ITherrThemeColors } from '../../styles/themes';

// Props interface for the BaseInput component.
export interface IBaseInputProps extends TextInputProps {
    themeForms: {
        colors: ITherrThemeColors;
        styles: any;
    };
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
            underlineStyle,
            roundness,
            style,
            // Separate TextInput-native props
            ...textInputProps
        } = this.props;
        /* eslint-enable @typescript-eslint/no-unused-vars */

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
        const paperTheme = roundness != null ? { roundness } : undefined;

        return (
            <View style={containerStyle}>
                <PaperTextInput
                    mode={mode}
                    label={label}
                    cursorColor={themeForms.colors.selectionColor as unknown as string}
                    selectionColor={themeForms.colors.selectionColor as unknown as string}
                    underlineColor={underlineColor as string}
                    activeUnderlineColor={activeColor as string}
                    underlineStyle={underlineStyle}
                    disabled={disabled}
                    error={!!errorMessage}
                    right={right}
                    left={left}
                    theme={paperTheme}
                    style={[
                        { backgroundColor: 'transparent' },
                        inputContainerStyle,
                        inputStyle || themeForms.styles.input,
                        style,
                    ]}
                    contentStyle={inputStyle}
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
