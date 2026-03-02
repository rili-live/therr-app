import React from 'react';
import { GestureResponderEvent, StyleProp, Text, View, ViewStyle, TextStyle } from 'react-native';
import { Button as PaperButton, TouchableRipple } from 'react-native-paper';

// Adapter that maps the react-native-elements Button API to react-native-paper's Button.
// This allows a mass migration of imports without restructuring every Button's JSX.
// In Phase 6 (polish), consumers can be migrated directly to Paper's API and this file removed.
//
// Key difference: RNE had one container (buttonStyle), Paper has two layers
// (style -> outer, contentStyle -> inner with its own padding). We zero out
// Paper's inner padding so buttonStyle dimensions match the old RNE behavior.

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
    iconTop?: boolean;
    loading?: boolean;
    disabled?: boolean;
    onPress?: (event?: GestureResponderEvent) => void;
    accessibilityLabel?: string;
    testID?: string;
    // Silently ignored RNE props to avoid TS errors in consumers
    iconContainerStyle?: any;
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
    iconTop,
    loading,
    disabled,
    onPress,
    accessibilityLabel,
    testID,
}: IButtonProps) => {
    const mode = mapMode(type, raised);

    // Paper icon prop accepts a render function or icon name string
    const iconProp = icon ? () => <>{icon}</> : undefined;

    // Zero out Paper's inner padding layers so that buttonStyle is the sole
    // source of sizing — matching react-native-elements' single-container model.
    const contentStyle: ViewStyle = {
        minHeight: 0,
        paddingHorizontal: 0,
        paddingVertical: 0,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    };

    // For iconTop layout, bypass PaperButton's icon wrapper (which adds
    // internal marginRight that offsets icons in column layout) and use
    // TouchableRipple with manual layout for precise centering.
    if (iconTop) {
        // TODO: User react-native-paper IconButton
        const content = (
            <TouchableRipple
                onPress={onPress}
                disabled={disabled}
                style={[buttonStyle as StyleProp<ViewStyle>, disabled && disabledStyle]}
                accessibilityLabel={accessibilityLabel}
                testID={testID}
            >
                <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                    {icon}
                    {title != null && (
                        <Text style={[
                            { marginVertical: 0, marginHorizontal: 0 } as TextStyle,
                            titleStyle as StyleProp<TextStyle>,
                            disabled && disabledTitleStyle,
                        ]}>
                            {title}
                        </Text>
                    )}
                </View>
            </TouchableRipple>
        );

        if (containerStyle) {
            return <View style={containerStyle}>{content}</View>;
        }
        return content;
    }

    // For iconRight layout, bypass PaperButton and use TouchableRipple
    // with manual row layout so text aligns left and icon aligns right.
    if (iconRight) {
        const content = (
            <TouchableRipple
                onPress={onPress}
                disabled={disabled}
                style={[buttonStyle as StyleProp<ViewStyle>, disabled && disabledStyle]}
                accessibilityLabel={accessibilityLabel}
                testID={testID}
            >
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: title ? 'space-between' : 'center',
                    flex: 1,
                }}>
                    {title ? (
                        <Text style={[
                            { marginVertical: 0, marginHorizontal: 0 } as TextStyle,
                            titleStyle as StyleProp<TextStyle>,
                            disabled && disabledTitleStyle,
                        ]}>
                            {title}
                        </Text>
                    ) : null}
                    {icon}
                </View>
            </TouchableRipple>
        );

        if (containerStyle) {
            return <View style={containerStyle}>{content}</View>;
        }
        return content;
    }

    // For icon-only buttons (no title), bypass PaperButton to avoid its
    // internal icon marginRight that offsets icons from center.
    if (icon && !title) {
        const content = (
            <TouchableRipple
                onPress={onPress}
                disabled={disabled}
                style={[buttonStyle as StyleProp<ViewStyle>, disabled && disabledStyle]}
                accessibilityLabel={accessibilityLabel}
                testID={testID}
            >
                <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                    {icon}
                </View>
            </TouchableRipple>
        );

        if (containerStyle) {
            return <View style={containerStyle}>{content}</View>;
        }
        return content;
    }

    const button = (
        <PaperButton
            mode={mode}
            compact
            onPress={onPress}
            loading={loading}
            disabled={disabled}
            icon={iconProp}
            style={[buttonStyle as StyleProp<ViewStyle>, disabled && disabledStyle]}
            labelStyle={[
                { marginVertical: 0, marginHorizontal: 0 } as TextStyle,
                titleStyle as StyleProp<TextStyle>,
                disabled && disabledTitleStyle,
            ]}
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
