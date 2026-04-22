import React from 'react';
import { View, Text, Pressable } from 'react-native';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import spacingStyles from '../../styles/layouts/spacing';

interface IStepSectionHeaderProps {
    stepNumber: number;
    title: string;
    isActive: boolean;
    isCollapsible?: boolean;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
    theme: any;
}

const StepSectionHeader = ({
    stepNumber,
    title,
    isActive,
    isCollapsible,
    isCollapsed,
    onToggleCollapse,
    theme,
}: IStepSectionHeaderProps) => {
    const Container = isCollapsible ? Pressable : View;

    return (
        <Container
            style={[spacingStyles.flexRow, spacingStyles.alignCenter, theme.styles.stepSectionHeader]}
            onPress={isCollapsible ? onToggleCollapse : undefined}
        >
            <View style={isActive ? theme.styles.stepCircleActive : theme.styles.stepCircle}>
                <Text style={theme.styles.stepCircleText}>{stepNumber}</Text>
            </View>
            <Text style={theme.styles.sectionTitleSmall}>{title}</Text>
            {isCollapsible && (
                <FontAwesome5Icon
                    name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                    size={14}
                    color={theme.colors.textGray}
                    style={{ marginLeft: 'auto' }}
                />
            )}
        </Container>
    );
};

export default StepSectionHeader;
