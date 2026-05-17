import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { IPact, IPactMember } from 'therr-react/types';
import { hoursDaysOrYearsSince } from '../../../utilities/formatDate';
import spacingStyles from '../../../styles/layouts/spacing';

const NUDGE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // show recovery path after 24 hours
const ACTIVE_STEP_COLOR = '#7B5EA7'; // brand purple for active pending step

interface IPactCardProps {
    pact: IPact;
    currentUserId: string;
    isSentTab: boolean;
    isNudging?: boolean;
    onNudge: (pactId: string) => void;
    onPickNewPartner: (habitGoalId: string) => void;
    onCreateNewPact: (habitGoalId: string) => void;
    onAccept?: (pactId: string) => void;
    onDecline?: (pactId: string) => void;
    translate: (key: string, params?: object) => string;
    theme: any;
}

const getPartnerMember = (members: IPactMember[], currentUserId: string): IPactMember | undefined =>
    members?.find((m) => m.userId !== currentUserId);

const getMemberDisplayName = (member?: IPactMember): string => {
    if (!member) return 'Someone';
    if (member.firstName || member.lastName) {
        return `${member.firstName || ''} ${member.lastName || ''}`.trim();
    }
    return member.userName || 'Someone';
};

const PactCard = ({
    pact,
    currentUserId,
    isSentTab,
    isNudging,
    onNudge,
    onPickNewPartner,
    onCreateNewPact,
    onAccept,
    onDecline,
    translate,
    theme,
}: IPactCardProps) => {
    const members = pact.members || [];
    const partnerMember = getPartnerMember(members, currentUserId);
    const partnerName = getMemberDisplayName(partnerMember);
    const habitName = pact.habitGoalName || translate('pages.myPacts.labels.habitGoal');
    const invitedAt = partnerMember?.invitedAt
        ? new Date(partnerMember.invitedAt)
        : new Date(pact.createdAt);
    const nudgedAt = partnerMember?.nudgedAt ? new Date(partnerMember.nudgedAt) : null;

    const nudgeAge = nudgedAt ? Date.now() - nudgedAt.getTime() : null;
    const nudgeSentRecently = nudgeAge !== null && nudgeAge < NUDGE_COOLDOWN_MS;
    const showRecoveryPath = nudgeAge !== null && nudgeAge >= NUDGE_COOLDOWN_MS;
    const isActivePendingStep = isSentTab && pact.status === 'pending';

    return (
        <View style={[localStyles.card, isActivePendingStep && localStyles.cardActiveBorder]}>
            {/* Header row: emoji + habit name */}
            <View style={[spacingStyles.flexRow, spacingStyles.alignCenter, localStyles.headerRow]}>
                {!!pact.habitGoalEmoji && (
                    <Text style={localStyles.emoji}>{pact.habitGoalEmoji}</Text>
                )}
                <Text style={[theme.styles.sectionTitleSmall, localStyles.habitName]} numberOfLines={1}>
                    {habitName}
                </Text>
                {isActivePendingStep && (
                    <View style={localStyles.activeStepBadge}>
                        <Text style={localStyles.activeStepBadgeText}>
                            {translate('pages.myPacts.labels.waitingForResponse')}
                        </Text>
                    </View>
                )}
            </View>

            {/* Sent tab */}
            {isSentTab && (
                <>
                    <Text style={localStyles.partnerText}>
                        {partnerName}
                        {' · '}
                        {translate('pages.myPacts.labels.invitedTimeAgo', {
                            timeAgo: hoursDaysOrYearsSince(invitedAt, translate),
                        })}
                    </Text>

                    {!nudgedAt && (
                        <Pressable
                            style={({ pressed }) => [localStyles.primaryButton, pressed && localStyles.buttonPressed]}
                            onPress={() => onNudge(pact.id)}
                            disabled={isNudging}
                        >
                            {isNudging
                                ? <ActivityIndicator color="#fff" size="small" />
                                : <Text style={localStyles.primaryButtonText}>{translate('pages.myPacts.buttons.sendNudge')}</Text>
                            }
                        </Pressable>
                    )}

                    {nudgeSentRecently && (
                        <Text style={localStyles.nudgeSentText}>
                            {'✓ '}
                            {translate('pages.myPacts.labels.nudgeSentTimeAgo', {
                                timeAgo: hoursDaysOrYearsSince(nudgedAt!, translate),
                            })}
                        </Text>
                    )}

                    {showRecoveryPath && (
                        <View style={localStyles.recoveryContainer}>
                            <Text style={localStyles.recoveryHint}>
                                {translate('pages.myPacts.labels.noResponseYet')}
                            </Text>
                            <Pressable
                                style={({ pressed }) => [localStyles.primaryButton, pressed && localStyles.buttonPressed]}
                                onPress={() => onPickNewPartner(pact.habitGoalId)}
                            >
                                <Text style={localStyles.primaryButtonText}>
                                    {translate('pages.myPacts.buttons.inviteSomeoneElse')}
                                </Text>
                            </Pressable>
                            <Pressable
                                style={({ pressed }) => [localStyles.outlineButton, pressed && localStyles.buttonPressed]}
                                onPress={() => onCreateNewPact(pact.habitGoalId)}
                            >
                                <Text style={localStyles.outlineButtonText}>
                                    {translate('pages.myPacts.buttons.startNewPact')}
                                </Text>
                            </Pressable>
                        </View>
                    )}
                </>
            )}

            {/* Received tab */}
            {!isSentTab && (
                <>
                    <Text style={localStyles.partnerText}>
                        {translate('pages.myPacts.labels.invitedTimeAgo', {
                            timeAgo: hoursDaysOrYearsSince(invitedAt, translate),
                        })}
                    </Text>
                    <View style={localStyles.receivedActions}>
                        <Pressable
                            style={({ pressed }) => [localStyles.primaryButton, localStyles.halfButton, pressed && localStyles.buttonPressed]}
                            onPress={() => onAccept && onAccept(pact.id)}
                        >
                            <Text style={localStyles.primaryButtonText}>
                                {translate('pages.myPacts.buttons.accept')}
                            </Text>
                        </Pressable>
                        <Pressable
                            style={({ pressed }) => [localStyles.outlineButton, localStyles.halfButton, pressed && localStyles.buttonPressed]}
                            onPress={() => onDecline && onDecline(pact.id)}
                        >
                            <Text style={localStyles.outlineButtonText}>
                                {translate('pages.myPacts.buttons.decline')}
                            </Text>
                        </Pressable>
                    </View>
                </>
            )}
        </View>
    );
};

const localStyles = StyleSheet.create({
    card: {
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.06)',
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    cardActiveBorder: {
        borderWidth: 2,
        borderColor: ACTIVE_STEP_COLOR,
    },
    headerRow: {
        marginBottom: 8,
        gap: 6,
    },
    emoji: {
        fontSize: 22,
    },
    habitName: {
        flex: 1,
    },
    activeStepBadge: {
        backgroundColor: ACTIVE_STEP_COLOR,
        borderRadius: 99,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    activeStepBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
    },
    partnerText: {
        marginBottom: 10,
        opacity: 0.75,
        fontSize: 13,
        color: '#fff',
    },
    nudgeSentText: {
        color: ACTIVE_STEP_COLOR,
        fontSize: 13,
        fontStyle: 'italic',
        marginTop: 4,
    },
    recoveryContainer: {
        marginTop: 8,
        gap: 8,
    },
    recoveryHint: {
        opacity: 0.65,
        fontStyle: 'italic',
        marginBottom: 4,
        color: '#fff',
        fontSize: 13,
    },
    primaryButton: {
        backgroundColor: ACTIVE_STEP_COLOR,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 40,
    },
    outlineButton: {
        borderWidth: 1.5,
        borderColor: ACTIVE_STEP_COLOR,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 40,
    },
    buttonPressed: {
        opacity: 0.75,
    },
    primaryButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    outlineButtonText: {
        color: ACTIVE_STEP_COLOR,
        fontWeight: '600',
        fontSize: 14,
    },
    receivedActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4,
    },
    halfButton: {
        flex: 1,
    },
});

export default PactCard;
