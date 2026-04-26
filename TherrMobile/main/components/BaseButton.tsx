import React from 'react';
import { ActivityIndicator, GestureResponderEvent, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { TouchableRipple } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { getTheme, ITherrTheme } from '../styles/themes';
import { BRAND_BLACK, BRAND_WHITE } from '../styles/themes/brandConstants';
import { fontSizes, fontWeights } from '../styles/text';
import { radius } from '../styles/radii';

// TouchableRipple is the outermost element so the entire visual button area
// (including padding) is the press target.

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';
export type ButtonShape = 'pill' | 'rounded' | 'square';

interface IButtonProps {
    title?: React.ReactNode;
    type?: 'clear' | 'solid' | 'outline';
    /**
     * Color intent. When omitted, the component falls back to the legacy
     * behavior (consumers control color via `buttonStyle`/`titleStyle`).
     * When set, the component computes a coherent palette from the active
     * theme and merges it under any caller-supplied styles.
     */
    variant?: ButtonVariant;
    /**
     * Touch-target size. When omitted, no padding/min-height/font-size is
     * applied (legacy behavior).
     */
    size?: ButtonSize;
    /**
     * Border radius. When omitted, no `borderRadius` is applied (legacy).
     */
    shape?: ButtonShape;
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
        shadowColor: BRAND_BLACK,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.23,
        shadowRadius: 2.62,
    },
    container: {
        overflow: 'hidden',
    },
    contentColumn: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
    },
    contentRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    contentRowSpaced: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    titleReset: {
        marginVertical: 0,
        marginHorizontal: 0,
    },
    titleSolid: {
        color: BRAND_WHITE,
    },
});

// Resolves the variant's "background" color (used as bg in solid type, as
// border + text in outline, and as text in clear). `brandingBlueGreen` is
// theme-agnostic and gives every theme the same primary teal — important
// because retro's `primary` color is a different teal that we don't want
// to use for primary CTAs.
const variantBg = (theme: ITherrTheme, variant: ButtonVariant): string => {
    switch (variant) {
        case 'primary':
            return theme.colors.brandingBlueGreen;
        case 'secondary':
            return theme.colors.secondary;
        case 'tertiary':
            return theme.colors.backgroundGray;
        case 'danger':
            return theme.colors.alertError;
    }
};

// Foreground color used on top of the variant's filled background. Tertiary
// uses the theme's text color since it sits on a neutral surface, not a
// brand-colored fill.
const variantOn = (theme: ITherrTheme, variant: ButtonVariant): string => {
    if (variant === 'tertiary') return theme.colors.textWhite;
    return theme.colors.brandingWhite;
};

const buildVariantStyle = (
    theme: ITherrTheme,
    variant: ButtonVariant,
    type: IButtonProps['type'],
): { container: ViewStyle; title: TextStyle } => {
    const bg = variantBg(theme, variant);

    if (type === 'outline') {
        return {
            container: { backgroundColor: 'transparent', borderColor: bg, borderWidth: 1 },
            title: { color: bg, fontWeight: fontWeights.semibold },
        };
    }
    if (type === 'clear') {
        return {
            container: { backgroundColor: 'transparent' },
            title: { color: bg, fontWeight: fontWeights.semibold },
        };
    }
    // solid (default)
    return {
        container: { backgroundColor: bg },
        title: { color: variantOn(theme, variant), fontWeight: fontWeights.semibold },
    };
};

const SIZE_TABLE: Record<ButtonSize, { container: ViewStyle; title: TextStyle }> = {
    sm: {
        container: { minHeight: 32, paddingVertical: 6, paddingHorizontal: 12 },
        title: { fontSize: fontSizes.sm },
    },
    md: {
        container: { minHeight: 40, paddingVertical: 8, paddingHorizontal: 16 },
        title: { fontSize: fontSizes.md },
    },
    lg: {
        container: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 20 },
        title: { fontSize: fontSizes.md },
    },
    xl: {
        container: { minHeight: 56, paddingVertical: 14, paddingHorizontal: 24 },
        title: { fontSize: fontSizes.lg },
    },
};

const SHAPE_TABLE: Record<ButtonShape, ViewStyle> = {
    pill: { borderRadius: radius.pill },
    rounded: { borderRadius: radius.md },
    square: { borderRadius: radius.none },
};

export const Button = ({
    title,
    type,
    variant,
    size,
    shape,
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
    const themeName = useSelector((state: any) => state?.user?.settings?.mobileThemeName);

    // Compute variant-driven styles only when `variant` is set. This preserves
    // the legacy API surface — callers that pass `buttonStyle`/`titleStyle`
    // continue to behave identically.
    const variantStyles = variant
        ? buildVariantStyle(getTheme(themeName), variant, type)
        : null;
    const sizeStyles = size ? SIZE_TABLE[size] : null;
    const shapeStyles = shape ? SHAPE_TABLE[shape] : null;

    // PaperButton auto-set white text for contained mode; replicate that
    // default for solid buttons (when no variant is provided) so consumers
    // don't need an explicit color.
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
                // Legacy auto-white text only when no variant is in play.
                !variant && isSolid && styles.titleSolid,
                variantStyles?.title,
                sizeStyles?.title,
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
        <TouchableRipple
            onPress={onPress}
            disabled={disabled}
            style={[
                raised && styles.elevated,
                variantStyles?.container,
                sizeStyles?.container,
                shapeStyles,
                buttonStyle as StyleProp<ViewStyle>,
                disabled && disabledStyle,
                styles.container,
            ]}
            accessibilityLabel={accessibilityLabel}
            testID={testID}
        >
            <View style={contentLayout}>
                {renderContent()}
            </View>
        </TouchableRipple>
    );

    if (containerStyle) {
        return <View style={[containerStyle, styles.container]}>{button}</View>;
    }

    return button;
};

export default Button;
