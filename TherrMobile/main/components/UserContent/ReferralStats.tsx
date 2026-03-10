import React from 'react';
import { Share, Text, View } from 'react-native';
import { ReferralRewards } from 'therr-js-utilities/constants';
import { Button } from '../BaseButton';
import { ITherrThemeColors } from '../../styles/themes';
import { buildInviteUrl } from '../../utilities/shareUrls';

interface IReferralStatsProps {
    locale: string;
    referralCount: number;
    userName: string;
    translate: Function;
    theme: {
        colors: ITherrThemeColors;
        styles: any;
    };
    themeForms: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

const ReferralStats: React.FC<IReferralStatsProps> = ({
    locale,
    referralCount,
    userName,
    translate,
    theme,
    themeForms,
}) => {
    const shareUrl = buildInviteUrl(locale, userName);
    const onShareLink = () => {
        Share.share({
            message: translate('forms.createConnection.shareLink.message', {
                inviteCode: userName,
                shareUrl,
            }),
            url: shareUrl,
            title: translate('forms.createConnection.shareLink.title'),
        }).catch((err) => console.error(err));
    };

    return (
        <View style={[theme.styles.sectionContainer, { marginBottom: 20 }]}>
            <Text style={[theme.styles.sectionTitle, { marginBottom: 10 }]}>
                {translate('components.referralStats.title')}
            </Text>
            <Text style={[theme.styles.sectionDescription, { marginBottom: 5 }]}>
                {translate('components.referralStats.friendsJoined', { count: referralCount })}
            </Text>
            <Text style={[theme.styles.sectionDescription, { marginBottom: 15, fontSize: 12 }]}>
                {translate('components.referralStats.coinsEarned', { count: referralCount * ReferralRewards.inviterCoins })}
            </Text>
            <Button
                buttonStyle={themeForms.styles.button}
                titleStyle={themeForms.styles.buttonTitle}
                title={translate('components.referralStats.shareLink')}
                onPress={onShareLink}
            />
        </View>
    );
};

export default ReferralStats;
