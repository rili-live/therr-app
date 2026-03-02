import React from 'react';
import { Pressable, View, Text, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { Checkbox } from 'react-native-paper';

// ListItem compound component using plain RN primitives + Paper Checkbox.

interface IListItemProps {
    onPress?: () => void;
    bottomDivider?: boolean;
    containerStyle?: StyleProp<ViewStyle>;
    children: React.ReactNode;
}

const ListItemBase = ({ onPress, bottomDivider, containerStyle, children }: IListItemProps) => (
    <Pressable
        onPress={onPress}
        style={[
            {
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 10,
                paddingVertical: 8,
            } as ViewStyle,
            containerStyle,
            bottomDivider ? { borderBottomWidth: 1, borderBottomColor: '#e1e8ee' } as ViewStyle : undefined,
        ]}
    >
        {children}
    </Pressable>
);

interface ITextProps {
    children: React.ReactNode;
    style?: StyleProp<TextStyle>;
    numberOfLines?: number;
}

const Title = ({ children, style, numberOfLines }: ITextProps) => (
    <Text style={[{ fontSize: 16, fontWeight: '500' } as TextStyle, style]} numberOfLines={numberOfLines}>
        {children}
    </Text>
);

const Subtitle = ({ children, style, numberOfLines }: ITextProps) => (
    <Text style={[{ fontSize: 14, color: '#86939e' } as TextStyle, style]} numberOfLines={numberOfLines}>
        {children}
    </Text>
);

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
