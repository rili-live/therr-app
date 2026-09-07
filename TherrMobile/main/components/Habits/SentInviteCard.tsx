import React from 'react';
import {
    View, Text, Pressable, Share, ActivityIndicator,
} from 'react-native';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
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
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={pact.habitGoalName || translate('pages.pacts.defaultTitle')}
            style={({ pressed }) => [
                themeHabits.styles.pactCardContainer,
                pressed && themeHabits.styles.pactCardContainerPressed,
            ]}
            onPress={onPress}
        >
            <View style={[themeHabits.styles.pactCardStatusBadge, themeHabits.styles.pactCardStatusPending]}>
                <View style={[themeHabits.styles.pactCardStatusDot, { backgroundColor: themeHabits.colors.alertWarning }]} />
                <Text style={[themeHabits.styles.pactCardStatusText, themeHabits.styles.pactCardStatusTextPending]}>
                    {translate('pages.pacts.outgoing.cardSubtitle')}
                </Text>
            </View>
            <View style={themeHabits.styles.habitCardHeader}>
                <View style={themeHabits.styles.habitCardEmojiContainer}>
                    <Text style={themeHabits.styles.habitCardEmojiContained}>
                        {pact.habitGoalEmoji || '🤝'}
                    </Text>
                </View>
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
                        ? <ActivityIndicator color={themeHabits.colors.onBrand} size="small" />
                        : (
                            <>
                                <FontAwesome5Icon name="hand-point-right" size={13} color={themeHabits.colors.onBrand} />
                                <Text style={themeHabits.styles.pactCardInviteButtonPrimaryText}>
                                    {translate('pages.pacts.outgoing.sendNudge')}
                                </Text>
                            </>
                        )}
                </Pressable>
            )}

            {nudgeSentRecently && (
                <View style={themeHabits.styles.pactCardNudgeSent}>
                    <FontAwesome5Icon name="check" size={11} color={themeHabits.colors.alertSuccess} />
                    <Text style={themeHabits.styles.pactCardNudgeSentText}>
                        {translate('pages.pacts.outgoing.nudgeSentTimeAgo', {
                            timeAgo: hoursDaysOrYearsSince(nudgedAt as Date, translate),
                        })}
                    </Text>
                </View>
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
                        <FontAwesome5Icon name="user-plus" size={13} color={themeHabits.colors.onBrand} />
                        <Text style={themeHabits.styles.pactCardInviteButtonPrimaryText}>
                            {translate('pages.pacts.outgoing.inviteSomeoneElse')}
                        </Text>
                    </Pressable>
                </>
            )}

            {/* Sharing is the fallback path, so it reads as a text action
                rather than a second filled button competing with the nudge. */}
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={translate('pages.pacts.outgoing.shareInviteButton')}
                onPress={handleShareInvite}
                style={({ pressed }) => [
                    themeHabits.styles.pactCardTextAction,
                    pressed && themeHabits.styles.pactCardInviteButtonPressed,
                ]}
            >
                <FontAwesome5Icon name="share-alt" size={13} color={themeHabits.colors.brand} />
                <Text style={themeHabits.styles.pactCardTextActionLabel}>
                    {translate('pages.pacts.outgoing.shareInviteButton')}
                </Text>
            </Pressable>
        </Pressable>
    );
};

export default SentInviteCard;
