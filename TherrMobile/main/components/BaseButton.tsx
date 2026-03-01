import React from 'react';
import { GestureResponderEvent, StyleProp, View, ViewStyle, TextStyle } from 'react-native';
import { Button as PaperButton } from 'react-native-paper';

// Adapter that maps the react-native-elements Button API to react-native-paper's Button.
// This allows a mass migration of imports without restructuring every Button's JSX.
// In Phase 6 (polish), consumers can be migrated directly to Paper's API and this file removed.

interface IButtonProps {
    title?: React.ReactNode;
    type?: 'clear' | 'solid' | 'outline';
    raised?: boolean;
    buttonStyle?: StyleProp<ViewStyle>;
    titleStyle?: StyleProp<TextStyle>;
    containerStyle?: StyleProp<ViewStyle>;
    disabledStyle?: StyleProp<ViewStyle>;
    disabledTitleStyle?: StyleProp<TextStyle>;
    icon?: React.ReactNode;
    iconRight?: boolean;
    loading?: boolean;
    disabled?: boolean;
    onPress?: (event?: GestureResponderEvent) => void;
    accessibilityLabel?: string;
    testID?: string;
}

const mapMode = (type?: string, raised?: boolean): 'text' | 'contained' | 'outlined' | 'elevated' => {
    if (raised) {
        return 'elevated';
    }
    switch (type) {
        case 'clear':
            return 'text';
        case 'outline':
            return 'outlined';
        default:
            return 'contained';
    }
};

export const Button = ({
    title,
    type,
    raised,
    buttonStyle,
    titleStyle,
    containerStyle,
    disabledStyle,
    disabledTitleStyle,
    icon,
    iconRight,
    loading,
    disabled,
    onPress,
    accessibilityLabel,
    testID,
}: IButtonProps) => {
    const mode = mapMode(type, raised);

    // Paper icon prop accepts a render function or icon name string
    const iconProp = icon ? () => <>{icon}</> : undefined;

    // Handle icon-right positioning via contentStyle
    const contentStyle: ViewStyle | undefined = iconRight
        ? { flexDirection: 'row-reverse' }
        : undefined;

    const button = (
        <PaperButton
            mode={mode}
            onPress={onPress}
            loading={loading}
            disabled={disabled}
            icon={iconProp}
            style={[buttonStyle as StyleProp<ViewStyle>, disabled && disabledStyle]}
            labelStyle={[titleStyle as StyleProp<TextStyle>, disabled && disabledTitleStyle]}
            contentStyle={contentStyle}
            accessibilityLabel={accessibilityLabel}
            testID={testID}
        >
            {title}
        </PaperButton>
    );

    if (containerStyle) {
        return <View style={containerStyle}>{button}</View>;
    }

    return button;
};

export default Button;
