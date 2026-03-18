import React from 'react';
import { View, Text } from 'react-native';

interface IInterestChipProps {
    emoji: string;
    label: string;
    ranking: number;
    theme: any;
    themeForms: any;
}

const InterestChip = ({
    emoji,
    label,
    ranking,
    themeForms,
}: IInterestChipProps) => (
    <View style={themeForms.styles.buttonPillContainer}>
        <View style={themeForms.styles.buttonPill}>
            <Text style={themeForms.styles.buttonPillTitle}>
                {emoji} {label} {ranking}
            </Text>
        </View>
    </View>
);

export default InterestChip;
