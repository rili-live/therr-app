import React from 'react';
import { View, Text, Pressable } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { IPactMember } from 'therr-react/types';
import { Avatar } from '../BaseAvatar';
import { getUserImageUri } from '../../utilities/content';
import { ITherrThemeColors } from '../../styles/themes';

interface IPactMemberRowProps {
    member: IPactMember;
    /** Divider above the row — omitted on the first row of the card. */
    isDivided?: boolean;
    onPress: () => void;
    /** Omitted when direct messaging is unavailable for the brand. */
    onMessagePress?: () => void;
    themeHabits: {
        colors: ITherrThemeColors;
        styles: any;
    };
    translate: (key: string, params?: any) => string;
}

const getMemberName = (
    member: IPactMember,
    translate: (key: string, params?: any) => string,
): string => {
    const fullName = [member.firstName, member.lastName].filter(Boolean).join(' ');
    return fullName || member.userName || translate('pages.pacts.partnerFallback');
};

const getMemberInitials = (member: IPactMember): string => {
    const initials = `${member.firstName?.[0] || ''}${member.lastName?.[0] || ''}`;
    return (initials || member.userName?.[0] || '?').toUpperCase();
};

/**
 * Whether this member checked in today, when the server is new enough to say.
 *
 * Read defensively rather than off the `IPactMember` type: users-service began
 * deriving `checkedInToday` after this screen shipped, so a client talking to an
 * older service gets `undefined`. That must render as *nothing* — silently
 * treating "unknown" as `false` would show a green-dot-less row that reads as
 * "they missed today", which is the one wrong thing this indicator can say.
 */
const getCheckedInToday = (member: IPactMember): boolean | undefined => (
    member as IPactMember & { checkedInToday?: boolean }
).checkedInToday;

const getMemberMeta = (
    member: IPactMember,
    translate: (key: string, params?: any) => string,
): string => {
    const role = translate(`pages.pacts.memberRole.${member.role}`);
    // Statuses come from habits.pact_members.status. Anything unrecognized
    // falls back to the raw value rather than rendering a missing-key string.
    const knownStatuses = ['pending', 'active', 'completed', 'left', 'removed'];
    const status = knownStatuses.includes(member.status)
        ? translate(`pages.pacts.memberStatus.${member.status}`)
        : member.status;

    // The streak belongs on the row for an active member and nowhere else: on a
    // pending invite there is no shared streak yet, and on someone who left it
    // is a number about a habit they are no longer keeping with you.
    const streak = member.status === 'active' && member.currentStreak > 0
        ? translate('pages.pacts.memberStreak', { count: member.currentStreak })
        : '';

    return [role, status, streak].filter(Boolean).join(' · ');
};

const PactMemberRow: React.FC<IPactMemberRowProps> = ({
    member,
    isDivided,
    onPress,
    onMessagePress,
    themeHabits,
    translate,
}) => {
    const name = getMemberName(member, translate);
    const checkedInToday = getCheckedInToday(member);
    // Only meaningful for someone actually in the pact today.
    const showTodayState = member.status === 'active' && checkedInToday !== undefined;

    return (
        <View style={[
            themeHabits.styles.pactMemberRow,
            isDivided && themeHabits.styles.pactMemberRowDivided,
        ]}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={translate('pages.pacts.viewProfileOf', { name })}
                onPress={onPress}
                style={({ pressed }) => [
                    themeHabits.styles.pactMemberRowLink,
                    pressed && themeHabits.styles.pactPressedSurface,
                ]}
            >
                <Avatar
                    title={getMemberInitials(member)}
                    rounded
                    size="small"
                    source={{
                        uri: getUserImageUri({
                            details: { id: member.userId, media: member.userMedia },
                        }, 100),
                    }}
                />
                <View style={themeHabits.styles.pactMemberDetails}>
                    <Text style={themeHabits.styles.pactMemberName}>{name}</Text>
                    <Text style={themeHabits.styles.pactMemberMeta}>
                        {getMemberMeta(member, translate)}
                    </Text>
                </View>
                {showTodayState && (
                    <View
                        accessible
                        accessibilityLabel={translate(checkedInToday
                            ? 'pages.pacts.memberCheckedInToday'
                            : 'pages.pacts.memberNotCheckedInToday', { name })}
                        style={[
                            themeHabits.styles.pactMemberTodayBadge,
                            checkedInToday
                                ? themeHabits.styles.pactMemberTodayBadgeDone
                                : themeHabits.styles.pactMemberTodayBadgePending,
                        ]}
                    >
                        <MaterialIcon
                            name={checkedInToday ? 'check' : 'schedule'}
                            size={14}
                            color={checkedInToday
                                ? themeHabits.colors.alertSuccess
                                : themeHabits.colors.textGray}
                        />
                    </View>
                )}
                <MaterialIcon
                    name="chevron-right"
                    size={24}
                    color={themeHabits.colors.textGray}
                />
            </Pressable>
            {onMessagePress && (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={translate('pages.pacts.messagePartner', { name })}
                    onPress={onMessagePress}
                    style={({ pressed }) => [
                        themeHabits.styles.pactMemberAction,
                        pressed && themeHabits.styles.pactPressedSurface,
                    ]}
                >
                    <MaterialIcon
                        name="chat-bubble-outline"
                        size={20}
                        color={themeHabits.colors.primary3}
                    />
                </Pressable>
            )}
        </View>
    );
};

export default PactMemberRow;

export {
    getMemberName,
    getMemberInitials,
    getMemberMeta,
    getCheckedInToday,
};
