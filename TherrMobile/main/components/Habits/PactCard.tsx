import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { IPact, IPactMember } from 'therr-react/types';
import { ITherrThemeColors } from '../../styles/themes';

interface IPactCardProps {
    pact: IPact;
    currentUserId: string;
    onPress?: () => void;
    themeHabits: {
        colors: ITherrThemeColors;
        styles: any;
    };
    translate: (key: string, params?: any) => string;
}

const getStatusText = (status: string): string => {
    switch (status) {
        case 'pending':
            return 'Pending';
        case 'active':
            return 'Active';
        case 'completed':
            return 'Completed';
        case 'abandoned':
            return 'Abandoned';
        case 'expired':
            return 'Expired';
        default:
            return status;
    }
};

const PactCard: React.FC<IPactCardProps> = ({
    pact,
    currentUserId,
    onPress,
    themeHabits,
    translate,
}) => {
    const currentUserMember = pact.members?.find((m) => m.userId === currentUserId);
    const partnerMember = pact.members?.find((m) => m.userId !== currentUserId);

    const getStatusBadgeStyle = () => {
        if (pact.status === 'active') {
            return themeHabits.styles.pactCardStatusActive;
        }
        if (pact.status === 'pending') {
            return themeHabits.styles.pactCardStatusPending;
        }
        return {};
    };

    const renderMemberComparison = (member: IPactMember | undefined, label: string) => (
        <View style={themeHabits.styles.pactComparisonItem}>
            <Text style={themeHabits.styles.pactComparisonValue}>
                {member?.currentStreak || 0}
            </Text>
            <Text style={themeHabits.styles.pactComparisonLabel}>
                {label}
            </Text>
            {member?.completionRate !== undefined && (
                <Text style={themeHabits.styles.pactComparisonLabel}>
                    {Math.round(member.completionRate)}%
                </Text>
            )}
        </View>
    );

    return (
        <Pressable
            style={themeHabits.styles.pactCardContainer}
            onPress={onPress}
        >
            <View style={[themeHabits.styles.pactCardStatusBadge, getStatusBadgeStyle()]}>
                <Text style={themeHabits.styles.pactCardStatusText}>
                    {getStatusText(pact.status)}
                </Text>
            </View>

            <View style={themeHabits.styles.habitCardHeader}>
                <Text style={themeHabits.styles.habitCardEmoji}>
                    {pact.habitGoalEmoji || '\uD83E\uDD1D'}
                </Text>
                <View style={themeHabits.styles.habitCardTitleContainer}>
                    <Text style={themeHabits.styles.habitCardTitle}>
                        {pact.habitGoalName || translate('pages.pacts.defaultTitle')}
                    </Text>
                    <Text style={themeHabits.styles.habitCardSubtitle}>
                        {pact.durationDays} day {pact.pactType}
                    </Text>
                </View>
            </View>

            {partnerMember && (
                <View style={themeHabits.styles.pactPartnerRow}>
                    <View style={themeHabits.styles.pactPartnerAvatar}>
                        <Text>{(partnerMember.firstName?.[0] || 'P').toUpperCase()}</Text>
                    </View>
                    <Text style={themeHabits.styles.pactPartnerName}>
                        {partnerMember.firstName || partnerMember.userName || 'Partner'}
                    </Text>
                </View>
            )}

            {pact.status === 'active' && pact.members && pact.members.length > 1 && (
                <View style={themeHabits.styles.pactComparisonContainer}>
                    {renderMemberComparison(currentUserMember, translate('pages.pacts.you'))}
                    <Text style={themeHabits.styles.habitCardSubtitle}>vs</Text>
                    {renderMemberComparison(partnerMember, partnerMember?.firstName || 'Partner')}
                </View>
            )}
        </Pressable>
    );
};

export default PactCard;
