import React from 'react';
import { View, Text, Pressable, Share } from 'react-native';
import { IPact } from 'therr-react/types';
import { ITherrThemeColors } from '../../styles/themes';
import { buildInviteUrl } from '../../utilities/shareUrls';

interface ISentInviteCardProps {
    pact: IPact;
    locale: string;
    userName: string;
    themeHabits: { colors: ITherrThemeColors; styles: any };
    themeButtons: { colors: ITherrThemeColors; styles: any };
    translate: (key: string, params?: any) => string;
    onPress?: () => void;
}

const SentInviteCard: React.FC<ISentInviteCardProps> = ({
    pact,
    locale,
    userName,
    themeHabits,
    themeButtons,
    translate,
    onPress,
}) => {
    const partner = pact.members?.find((m) => m.role === 'partner');
    const partnerLabel = partner?.firstName
        || partner?.userName
        || translate('pages.pacts.partnerFallback');

    const handleNudge = () => {
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
                    </Text>
                </View>
            </View>
            <Pressable
                onPress={handleNudge}
                style={[themeButtons.styles.btnMediumWithText, { marginTop: 8, alignItems: 'center' }]}
            >
                <Text style={themeButtons.styles.btnMediumTitle}>
                    {translate('pages.pacts.outgoing.nudgeButton')}
                </Text>
            </Pressable>
        </Pressable>
    );
};

export default SentInviteCard;
