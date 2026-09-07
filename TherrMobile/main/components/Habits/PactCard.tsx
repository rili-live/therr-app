import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import { IPact, IPactMember } from 'therr-react/types';
import { ITherrThemeColors } from '../../styles/themes';
import { getCheckedInToday } from './PactMemberRow';
import { isPactRenewable, isPactSuperseded } from '../../routes/Habits/pactState';

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
    // Renewal lineage. A re-commit creates a *new* pact on the same habit goal, so
    // without a way across the boundary the finished cycle is either invisible (it is
    // left out of the list) or, when it is on screen, indistinguishable from a
    // separate pact. Supplying these renders the link in whichever direction the
    // pact has one; omit them and the card just states the relationship.
    onViewSourcePact?: (sourcePactId: string) => void;
    onViewSuccessorPact?: (successorPactId: string) => void;
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
    onViewSourcePact,
    onViewSuccessorPact,
    themeHabits,
    translate,
}) => {
    const currentUserMember = pact.members?.find((m) => m.userId === currentUserId);
    const partnerMember = pact.members?.find((m) => m.userId !== currentUserId);
    const showInviteActions = !!onAccept && !!onDecline;
    const showRenewAction = !!onRenew && !showInviteActions && isPactRenewable(pact);
    const cycleNumber = pact.renewalCycleNumber || 1;

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

    /**
     * The link across a renewal boundary, in whichever direction this pact has one.
     *
     * Only one is ever drawn. A pact that has been continued is history, and the useful
     * move from it is forward to the cycle that replaced it; a pact that continues an
     * earlier one is current, and the useful move is back to what it was built on. A
     * middle cycle in a long chain has both, and forward wins — it is the one that
     * answers "so where is my habit now".
     */
    const renderLineageLink = () => {
        const isSuperseded = isPactSuperseded(pact);
        const targetPactId = isSuperseded ? pact.supersededByPactId : pact.renewedFromPactId;
        if (!targetPactId) {
            return null;
        }

        const onPressTarget = isSuperseded ? onViewSuccessorPact : onViewSourcePact;
        const label = translate(isSuperseded
            ? 'pages.pacts.renew.continuedAs'
            : 'pages.pacts.renew.extendedFrom');

        // Without a handler the relationship is still worth stating — it is why this
        // pact's numbers start where they do — so the row renders as plain text rather
        // than a dead button.
        if (!onPressTarget) {
            return (
                <View style={themeHabits.styles.pactCardLineageRow}>
                    <FontAwesome5Icon
                        name="history"
                        size={10}
                        color={themeHabits.colors.onSurfaceMuted}
                    />
                    <Text style={themeHabits.styles.pactCardLineageText}>{label}</Text>
                </View>
            );
        }

        return (
            <Pressable
                accessibilityRole="link"
                accessibilityLabel={label}
                // Stops the tap reaching the card's own onPress, which would open this
                // pact instead of the one the link names.
                onPress={(event) => {
                    event.stopPropagation();
                    onPressTarget(targetPactId);
                }}
                style={({ pressed }) => [
                    themeHabits.styles.pactCardLineageRow,
                    pressed && themeHabits.styles.pactCardLineageRowPressed,
                ]}
            >
                <FontAwesome5Icon
                    name="history"
                    size={10}
                    color={themeHabits.colors.onSurfaceMuted}
                />
                <Text style={themeHabits.styles.pactCardLineageText}>{label}</Text>
                <FontAwesome5Icon
                    name="chevron-right"
                    size={9}
                    color={themeHabits.colors.onSurfaceMuted}
                />
            </Pressable>
        );
    };

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
                    {cycleNumber > 1 && (
                        <Text style={themeHabits.styles.pactCardCycleBadge}>
                            {translate('pages.pacts.renew.cycleLabel', { number: cycleNumber })}
                        </Text>
                    )}
                </View>
            </View>

            {renderLineageLink()}

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
