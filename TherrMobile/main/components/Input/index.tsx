import React from 'react';
import { View, TextInputProps } from 'react-native';
import { TextInput as PaperTextInput, HelperText } from 'react-native-paper';
import 'react-native-gesture-handler';
import { ITherrThemeColors } from '../../styles/themes';

// Extended props interface that preserves the react-native-elements Input API
// for backwards compatibility with existing consumers.
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
    dense?: boolean;
}

// Adapter that maps the react-native-elements Input API to react-native-paper TextInput.
// Preserves the same prop interface so RoundInput, SquareInput, and AccentInput
// work without changes to their consumers.
export class BaseInput extends React.Component<IBaseInputProps, any> {
    constructor(props) {
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

        return (
            <View style={containerStyle}>
                <PaperTextInput
                    mode={mode}
                    label={label}
                    selectionColor={themeForms.colors.selectionColor as string}
                    underlineColor={underlineColor as string}
                    activeUnderlineColor={activeColor as string}
                    disabled={disabled}
                    error={!!errorMessage}
                    right={right}
                    left={left}
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
