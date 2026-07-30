import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { IPact, IPactMember } from 'therr-react/types';
import { ITherrThemeColors } from '../../styles/themes';

interface IPactCardProps {
    pact: IPact;
    currentUserId: string;
    onPress?: () => void;
    // When both handlers are supplied the card renders inline Accept/Decline
    // actions. Used for invites awaiting this user's response so they never
    // have to discover the pact detail screen to respond.
    onAccept?: () => void;
    onDecline?: () => void;
    isRespondPending?: boolean;
    themeHabits: {
        colors: ITherrThemeColors;
        styles: any;
    };
    translate: (key: string, params?: any) => string;
}

const getStatusText = (
    status: string,
    translate: (key: string, params?: any) => string,
): string => {
    const known = ['pending', 'active', 'completed', 'abandoned', 'expired'];
    if (known.includes(status)) {
        return translate(`pages.pacts.status.${status}`);
    }
    return status;
};

const PactCard: React.FC<IPactCardProps> = ({
    pact,
    currentUserId,
    onPress,
    onAccept,
    onDecline,
    isRespondPending,
    themeHabits,
    translate,
}) => {
    const currentUserMember = pact.members?.find((m) => m.userId === currentUserId);
    const partnerMember = pact.members?.find((m) => m.userId !== currentUserId);
    const showInviteActions = !!onAccept && !!onDecline;

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
                    {getStatusText(pact.status, translate)}
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
                        {translate('pages.pacts.durationLabel', {
                            days: pact.durationDays,
                            type: translate(`pages.pacts.pactType.${pact.pactType}`),
                        })}
                    </Text>
                </View>
            </View>

            {partnerMember && (
                <View style={themeHabits.styles.pactPartnerRow}>
                    <View style={themeHabits.styles.pactPartnerAvatar}>
                        <Text>{(partnerMember.firstName?.[0] || 'P').toUpperCase()}</Text>
                    </View>
                    <Text style={themeHabits.styles.pactPartnerName}>
                        {partnerMember.firstName
                            || partnerMember.userName
                            || translate('pages.pacts.partnerFallback')}
                    </Text>
                </View>
            )}

            {pact.status === 'active' && pact.members && pact.members.length > 1 && (
                <View style={themeHabits.styles.pactComparisonContainer}>
                    {renderMemberComparison(currentUserMember, translate('pages.pacts.you'))}
                    <Text style={themeHabits.styles.habitCardSubtitle}>
                        {translate('pages.pacts.vs')}
                    </Text>
                    {renderMemberComparison(
                        partnerMember,
                        partnerMember?.firstName || translate('pages.pacts.partnerFallback'),
                    )}
                </View>
            )}

            {showInviteActions && (
                <>
                    <Text style={themeHabits.styles.pactCardInvitePrompt}>
                        {translate('pages.pacts.inviteePrompt')}
                    </Text>
                    <View style={themeHabits.styles.pactCardInviteActions}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={translate('pages.pacts.accept')}
                            disabled={isRespondPending}
                            onPress={onAccept}
                            style={({ pressed }) => [
                                themeHabits.styles.pactCardInviteButton,
                                themeHabits.styles.pactCardInviteButtonPrimary,
                                pressed && themeHabits.styles.pactCardInviteButtonPressed,
                            ]}
                        >
                            {isRespondPending
                                ? <ActivityIndicator color={themeHabits.colors.brandingWhite} size="small" />
                                : (
                                    <Text style={themeHabits.styles.pactCardInviteButtonPrimaryText}>
                                        {translate('pages.pacts.acceptShort')}
                                    </Text>
                                )}
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={translate('pages.pacts.decline')}
                            disabled={isRespondPending}
                            onPress={onDecline}
                            style={({ pressed }) => [
                                themeHabits.styles.pactCardInviteButton,
                                themeHabits.styles.pactCardInviteButtonSecondary,
                                pressed && themeHabits.styles.pactCardInviteButtonPressed,
                            ]}
                        >
                            <Text style={themeHabits.styles.pactCardInviteButtonSecondaryText}>
                                {translate('pages.pacts.decline')}
                            </Text>
                        </Pressable>
                    </View>
                </>
            )}
        </Pressable>
    );
};

export default PactCard;
