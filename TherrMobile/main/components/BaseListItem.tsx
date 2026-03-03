import React from 'react';
import { Pressable, View, Text, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { Checkbox, useTheme } from 'react-native-paper';

// ListItem compound component using plain RN primitives + Paper Checkbox.

interface IListItemProps {
    onPress?: () => void;
    bottomDivider?: boolean;
    containerStyle?: StyleProp<ViewStyle>;
    children: React.ReactNode;
}

const ListItemBase = ({ onPress, bottomDivider, containerStyle, children }: IListItemProps) => {
    const theme = useTheme();
    return (
        <Pressable
            onPress={onPress}
            style={[
                {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                } as ViewStyle,
                containerStyle,
                bottomDivider ? { borderBottomWidth: 1, borderBottomColor: theme.colors.outlineVariant } as ViewStyle : undefined,
            ]}
        >
            {children}
        </Pressable>
    );
};

interface ITextProps {
    children: React.ReactNode;
    style?: StyleProp<TextStyle>;
    numberOfLines?: number;
}

const Title = ({ children, style, numberOfLines }: ITextProps) => {
    const theme = useTheme();
    return (
        <Text style={[{ fontSize: 16, fontWeight: '500', color: theme.colors.onSurface } as TextStyle, style]} numberOfLines={numberOfLines}>
            {children}
        </Text>
    );
};

const Subtitle = ({ children, style, numberOfLines }: ITextProps) => {
    const theme = useTheme();
    return (
        <Text style={[{ fontSize: 14, color: theme.colors.onSurfaceVariant } as TextStyle, style]} numberOfLines={numberOfLines}>
            {children}
        </Text>
    );
};

const Content = ({ children }: { children: React.ReactNode }) => (
    <View style={{ flex: 1 }}>{children}</View>
);

interface ICheckBoxProps {
    checked?: boolean;
    onPress?: () => void;
    checkedColor?: string;
}

const CheckBox = ({ checked, onPress, checkedColor }: ICheckBoxProps) => (
    <Checkbox
        status={checked ? 'checked' : 'unchecked'}
        onPress={onPress}
        color={checkedColor}
    />
);

// Assemble compound component
export const ListItem = Object.assign(ListItemBase, {
    Title,
    Subtitle,
    Content,
    CheckBox,
});

export default ListItem;
