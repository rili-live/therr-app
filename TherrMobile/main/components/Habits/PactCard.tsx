import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import { IPact, IPactMember } from 'therr-react/types';
import { ITherrThemeColors } from '../../styles/themes';
import { getCheckedInToday } from './PactMemberRow';
import { isPactRenewable } from '../../routes/Habits/pactState';

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
    // Supplying this renders the re-commit CTA on a pact whose cycle has ended.
    // Omitted where a renewal has nowhere to land (another user's profile), so
    // the card stays read-only there.
    onRenew?: () => void;
    isRenewPending?: boolean;
    themeHabits: {
        colors: ITherrThemeColors;
        styles: any;
    };
    translate: (key: string, params?: any) => string;
}

/**
 * Badge wording for a pact's status.
 *
 * `pending` is deliberately not rendered as the word "Pending". The dashboard's
 * invite segment is also about pending things, so one screen carried the word
 * twice with two meanings: the segment meant "waiting on you", the badge meant
 * "not started yet". Both halves of a pending pact are named for whoever has to
 * act instead — "Awaiting acceptance" for the sender, "Needs your reply" for the
 * person holding the invite — which also makes the badge match the wording
 * `SentInviteCard` already uses on the Sent segment.
 *
 * `isAwaitingMyResponse` comes from the caller because only it knows: a group
 * pact can be `active` for the pact while this user's own member row is still an
 * open invite (see `isPactInviteAwaitingResponse`).
 */
export const getStatusText = (
    status: string,
    translate: (key: string, params?: any) => string,
    isAwaitingMyResponse: boolean,
): string => {
    if (status === 'pending') {
        return isAwaitingMyResponse
            ? translate('pages.pacts.status.needsYourReply')
            : translate('pages.pacts.status.awaitingAcceptance');
    }

    const known = ['active', 'completed', 'abandoned', 'expired'];
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
    onRenew,
    isRenewPending,
    themeHabits,
    translate,
}) => {
    const currentUserMember = pact.members?.find((m) => m.userId === currentUserId);
    const partnerMember = pact.members?.find((m) => m.userId !== currentUserId);
    const showInviteActions = !!onAccept && !!onDecline;
    const showRenewAction = !!onRenew && !showInviteActions && isPactRenewable(pact);

    // Badge surface, dot and label color move together — a tonal badge is only
    // legible when its foreground matches the tint it sits on.
    const getStatusBadgeStyles = () => {
        if (pact.status === 'active') {
            return {
                container: themeHabits.styles.pactCardStatusActive,
                label: themeHabits.styles.pactCardStatusTextActive,
                dot: themeHabits.colors.alertSuccess,
            };
        }
        if (pact.status === 'pending') {
            return {
                container: themeHabits.styles.pactCardStatusPending,
                label: themeHabits.styles.pactCardStatusTextPending,
                dot: themeHabits.colors.alertWarning,
            };
        }
        return {
            container: themeHabits.styles.pactCardStatusNeutral,
            label: themeHabits.styles.pactCardStatusTextNeutral,
            dot: themeHabits.colors.onSurfaceMuted,
        };
    };

    const statusStyles = getStatusBadgeStyles();

    const renderMemberComparison = (member: IPactMember | undefined, label: string) => {
        // `undefined` means the server has not told us — see getCheckedInToday.
        // Render nothing rather than an indicator that reads as "missed today".
        const checkedInToday = member && getCheckedInToday(member);

        return (
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
                {checkedInToday !== undefined && (
                    <View style={themeHabits.styles.pactComparisonTodayRow}>
                        <FontAwesome5Icon
                            name={checkedInToday ? 'check-circle' : 'clock'}
                            size={11}
                            color={checkedInToday
                                ? themeHabits.colors.alertSuccess
                                : themeHabits.colors.textGray}
                        />
                        <Text style={themeHabits.styles.pactComparisonLabel}>
                            {translate(checkedInToday
                                ? 'pages.pacts.todayDone'
                                : 'pages.pacts.todayPending')}
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={pact.habitGoalName || translate('pages.pacts.defaultTitle')}
            style={({ pressed }) => [
                themeHabits.styles.pactCardContainer,
                pressed && themeHabits.styles.pactCardContainerPressed,
            ]}
            onPress={onPress}
        >
            <View style={[themeHabits.styles.pactCardStatusBadge, statusStyles.container]}>
                <View style={[themeHabits.styles.pactCardStatusDot, { backgroundColor: statusStyles.dot }]} />
                <Text style={[themeHabits.styles.pactCardStatusText, statusStyles.label]}>
                    {getStatusText(pact.status, translate, showInviteActions)}
                </Text>
            </View>

            <View style={themeHabits.styles.habitCardHeader}>
                <View style={themeHabits.styles.habitCardEmojiContainer}>
                    <Text style={themeHabits.styles.habitCardEmojiContained}>
                        {pact.habitGoalEmoji || '\uD83E\uDD1D'}
                    </Text>
                </View>
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
                        <Text style={themeHabits.styles.pactPartnerAvatarInitial}>
                            {(partnerMember.firstName?.[0] || partnerMember.userName?.[0] || 'P').toUpperCase()}
                        </Text>
                    </View>
                    <Text style={themeHabits.styles.pactPartnerName} numberOfLines={1}>
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
                                themeHabits.styles.pactCardInviteButtonInline,
                                themeHabits.styles.pactCardInviteButtonPrimary,
                                pressed && themeHabits.styles.pactCardInviteButtonPressed,
                            ]}
                        >
                            {isRespondPending
                                ? <ActivityIndicator color={themeHabits.colors.onBrand} size="small" />
                                : (
                                    <>
                                        <FontAwesome5Icon name="check" size={13} color={themeHabits.colors.onBrand} />
                                        <Text style={themeHabits.styles.pactCardInviteButtonPrimaryText}>
                                            {translate('pages.pacts.acceptShort')}
                                        </Text>
                                    </>
                                )}
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={translate('pages.pacts.decline')}
                            disabled={isRespondPending}
                            onPress={onDecline}
                            style={({ pressed }) => [
                                themeHabits.styles.pactCardInviteButton,
                                themeHabits.styles.pactCardInviteButtonInline,
                                themeHabits.styles.pactCardInviteButtonSecondary,
                                pressed && themeHabits.styles.pactCardInviteButtonPressed,
                            ]}
                        >
                            <Text style={themeHabits.styles.pactCardInviteButtonDestructiveText}>
                                {translate('pages.pacts.decline')}
                            </Text>
                        </Pressable>
                    </View>
                </>
            )}

            {showRenewAction && (
                <>
                    <Text style={themeHabits.styles.pactCardInvitePrompt}>
                        {translate('pages.pacts.renew.prompt')}
                    </Text>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={translate('pages.pacts.renew.cta', { days: pact.durationDays })}
                        accessibilityState={{ disabled: !!isRenewPending }}
                        disabled={isRenewPending}
                        onPress={onRenew}
                        style={({ pressed }) => [
                            themeHabits.styles.pactCardInviteButton,
                            themeHabits.styles.pactCardInviteButtonPrimary,
                            pressed && themeHabits.styles.pactCardInviteButtonPressed,
                        ]}
                    >
                        {isRenewPending
                            ? <ActivityIndicator color={themeHabits.colors.onBrand} size="small" />
                            : (
                                <>
                                    <FontAwesome5Icon name="redo" size={13} color={themeHabits.colors.onBrand} />
                                    <Text style={themeHabits.styles.pactCardInviteButtonPrimaryText}>
                                        {translate('pages.pacts.renew.cta', { days: pact.durationDays })}
                                    </Text>
                                </>
                            )}
                    </Pressable>
                </>
            )}
        </Pressable>
    );
};

export default PactCard;
