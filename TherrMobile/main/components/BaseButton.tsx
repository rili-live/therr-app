import React from 'react';
import { ActivityIndicator, GestureResponderEvent, StyleProp, StyleSheet, Text, View, ViewStyle, TextStyle } from 'react-native';
import { TouchableRipple } from 'react-native-paper';

// Uses a View (visual container) → TouchableRipple (fills container) → View
// (content layout) structure so the ripple and press target always cover the
// full button area regardless of buttonStyle dimensions.

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
    TouchableComponent?: any;
}

const styles = StyleSheet.create({
    elevated: {
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.23,
        shadowRadius: 2.62,
    },
    container: {
        overflow: 'hidden',
        alignItems: 'stretch',
    },
    ripple: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
    contentColumn: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
    },
    contentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    contentRowSpaced: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    titleReset: {
        marginVertical: 0,
        marginHorizontal: 0,
    },
    titleSolid: {
        color: '#fff',
    },
});

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
    // PaperButton auto-set white text for contained mode; replicate that
    // default for solid buttons so consumers don't need an explicit color.
    const isSolid = type !== 'clear' && type !== 'outline';

    const contentLayout = iconTop
        ? styles.contentColumn
        : (iconRight && title) ? styles.contentRowSpaced : styles.contentRow;

    const renderContent = () => {
        if (loading) {
            return <ActivityIndicator />;
        }

        const titleElement = title != null ? (
            <Text style={[
                styles.titleReset,
                isSolid && styles.titleSolid,
                titleStyle as StyleProp<TextStyle>,
                disabled && disabledTitleStyle,
            ]}>
                {title}
            </Text>
        ) : null;

        if (iconRight) {
            return <>{titleElement}{icon}</>;
        }

        return <>{icon}{titleElement}</>;
    };

    const button = (
        <View style={[
            raised && styles.elevated,
            buttonStyle as StyleProp<ViewStyle>,
            disabled && disabledStyle,
            // Clips ripple to border radius and stretches TouchableRipple
            // to fill the full width (overriding any alignItems from buttonStyle).
            styles.container,
        ]}>
            <TouchableRipple
                onPress={onPress}
                disabled={disabled}
                style={styles.ripple}
                accessibilityLabel={accessibilityLabel}
                testID={testID}
            >
                <View style={[styles.content, contentLayout]}>
                    {renderContent()}
                </View>
            </TouchableRipple>
        </View>
    );

    if (containerStyle) {
        return <View style={[containerStyle, { overflow: 'hidden' }]}>{button}</View>;
    }

    return button;
};

export default Button;
