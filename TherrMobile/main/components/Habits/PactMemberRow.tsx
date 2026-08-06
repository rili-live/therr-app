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

    return [role, status].filter(Boolean).join(' · ');
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
};
