import React from 'react';
import {
    View, Text, Pressable, Share, ActivityIndicator,
} from 'react-native';
import { IPact } from 'therr-react/types';
import { ITherrThemeColors } from '../../styles/themes';
import { buildInviteUrl } from '../../utilities/shareUrls';
import { hoursDaysOrYearsSince } from '../../utilities/formatDate';
import { getSentInviteState } from '../../utilities/pactInviteState';

interface ISentInviteCardProps {
    pact: IPact;
    locale: string;
    currentUserId?: string;
    userName: string;
    isNudging?: boolean;
    onNudge?: (pact: IPact) => void;
    onInviteSomeoneElse?: (pact: IPact) => void;
    themeHabits: { colors: ITherrThemeColors; styles: any };
    themeButtons: { colors: ITherrThemeColors; styles: any };
    translate: (key: string, params?: any) => string;
    onPress?: () => void;
}

const SentInviteCard: React.FC<ISentInviteCardProps> = ({
    pact,
    locale,
    currentUserId,
    userName,
    isNudging,
    onNudge,
    onInviteSomeoneElse,
    themeHabits,
    themeButtons,
    translate,
    onPress,
}) => {
    const {
        partnerMember,
        invitedAt,
        nudgedAt,
        canNudge,
        nudgeSentRecently,
        showRecoveryPath,
    } = getSentInviteState(pact, currentUserId);
    const partnerLabel = partnerMember?.firstName
        || partnerMember?.userName
        || translate('pages.pacts.partnerFallback');

    const handleShareInvite = () => {
        const shareUrl = buildInviteUrl(locale, userName);
        Share.share({
            message: translate('forms.createConnection.shareLink.message', {
                inviteCode: userName,
                shareUrl,
            }),
            url: shareUrl,
            title: translate('pages.pacts.outgoing.nudgeShareTitle'),
        }).catch(() => {});
    };

    return (
        <Pressable style={themeHabits.styles.pactCardContainer} onPress={onPress}>
            <View style={[themeHabits.styles.pactCardStatusBadge, themeHabits.styles.pactCardStatusPending]}>
                <Text style={themeHabits.styles.pactCardStatusText}>
                    {translate('pages.pacts.outgoing.cardSubtitle')}
                </Text>
            </View>
            <View style={themeHabits.styles.habitCardHeader}>
                <Text style={themeHabits.styles.habitCardEmoji}>
                    {pact.habitGoalEmoji || '🤝'}
                </Text>
                <View style={themeHabits.styles.habitCardTitleContainer}>
                    <Text style={themeHabits.styles.habitCardTitle}>
                        {pact.habitGoalName || translate('pages.pacts.defaultTitle')}
                    </Text>
                    <Text style={themeHabits.styles.habitCardSubtitle}>
                        {partnerLabel}
                        {' · '}
                        {translate('pages.pacts.outgoing.invitedTimeAgo', {
                            timeAgo: hoursDaysOrYearsSince(invitedAt, translate),
                        })}
                    </Text>
                </View>
            </View>

            {canNudge && !!onNudge && (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={translate('pages.pacts.outgoing.sendNudge')}
                    disabled={isNudging}
                    onPress={() => onNudge(pact)}
                    style={({ pressed }) => [
                        themeHabits.styles.pactCardInviteButton,
                        themeHabits.styles.pactCardInviteButtonPrimary,
                        themeHabits.styles.pactCardInviteButtonStacked,
                        pressed && themeHabits.styles.pactCardInviteButtonPressed,
                    ]}
                >
                    {isNudging
                        ? <ActivityIndicator color={themeHabits.colors.brandingWhite} size="small" />
                        : (
                            <Text style={themeHabits.styles.pactCardInviteButtonPrimaryText}>
                                {translate('pages.pacts.outgoing.sendNudge')}
                            </Text>
                        )}
                </Pressable>
            )}

            {nudgeSentRecently && (
                <Text style={themeHabits.styles.pactCardNudgeSent}>
                    {'✓ '}
                    {translate('pages.pacts.outgoing.nudgeSentTimeAgo', {
                        timeAgo: hoursDaysOrYearsSince(nudgedAt as Date, translate),
                    })}
                </Text>
            )}

            {showRecoveryPath && !!onInviteSomeoneElse && (
                <>
                    <Text style={themeHabits.styles.pactCardInvitePrompt}>
                        {translate('pages.pacts.outgoing.noResponseYet')}
                    </Text>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={translate('pages.pacts.outgoing.inviteSomeoneElse')}
                        onPress={() => onInviteSomeoneElse(pact)}
                        style={({ pressed }) => [
                            themeHabits.styles.pactCardInviteButton,
                            themeHabits.styles.pactCardInviteButtonPrimary,
                            themeHabits.styles.pactCardInviteButtonStacked,
                            pressed && themeHabits.styles.pactCardInviteButtonPressed,
                        ]}
                    >
                        <Text style={themeHabits.styles.pactCardInviteButtonPrimaryText}>
                            {translate('pages.pacts.outgoing.inviteSomeoneElse')}
                        </Text>
                    </Pressable>
                </>
            )}

            <Pressable
                accessibilityRole="button"
                onPress={handleShareInvite}
                style={[themeButtons.styles.btnMediumWithText, { marginTop: 8, alignItems: 'center' }]}
            >
                <Text style={themeButtons.styles.btnMediumTitle}>
                    {translate('pages.pacts.outgoing.shareInviteButton')}
                </Text>
            </Pressable>
        </Pressable>
    );
};

export default SentInviteCard;
