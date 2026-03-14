import React, { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, Share, StyleSheet, Text, UIManager, View } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { ReferralRewards } from 'therr-js-utilities/constants';
import { Button } from '../BaseButton';
import { ITherrThemeColors } from '../../styles/themes';
import { buildInviteUrl } from '../../utilities/shareUrls';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

const styles = StyleSheet.create({
    container: {
        marginTop: 18,
        marginBottom: 4,
        marginHorizontal: 15,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    badge: {
        fontSize: 12,
        fontWeight: '500',
        marginLeft: 8,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 10,
        overflow: 'hidden',
    },
    expandedContent: {
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 12,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
    },
    statLabel: {
        fontSize: 11,
        marginTop: 2,
    },
    shareButton: {
        marginTop: 4,
        borderRadius: 8,
        paddingVertical: 8,
    },
    shareButtonTitle: {
        fontSize: 14,
    },
});

const ReferralStats: React.FC<IReferralStatsProps> = ({
    locale,
    referralCount,
    userName,
    translate,
    theme,
    themeForms,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const shareUrl = buildInviteUrl(locale, userName);
    const coinsEarned = referralCount * ReferralRewards.inviterCoins;

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

    const toggleExpanded = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsExpanded(!isExpanded);
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.backgroundWhite || theme.colors.brandingWhite }]}>
            <Pressable onPress={toggleExpanded} style={[styles.header, { backgroundColor: theme.colors.brandingBlueGreen || theme.colors.primary3 }]}>
                <View style={styles.headerLeft}>
                    <MaterialIcon name="person-add" size={18} color="#fff" />
                    <Text style={[styles.title, { color: '#fff' }]}>
                        {translate('components.referralStats.title')}
                    </Text>
                    {referralCount > 0 && (
                        <Text style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.3)', color: '#fff' }]}>
                            {referralCount}
                        </Text>
                    )}
                </View>
                <MaterialIcon
                    name={isExpanded ? 'expand-less' : 'expand-more'}
                    size={24}
                    color="#fff"
                />
            </Pressable>
            {isExpanded && (
                <View style={styles.expandedContent}>
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: theme.colors.textWhite }]}>
                                {referralCount}
                            </Text>
                            <Text style={[styles.statLabel, { color: theme.colors.textGray }]}>
                                {translate('components.referralStats.friendsLabel')}
                            </Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: theme.colors.textWhite }]}>
                                {coinsEarned}
                            </Text>
                            <Text style={[styles.statLabel, { color: theme.colors.textGray }]}>
                                {translate('components.referralStats.coinsLabel')}
                            </Text>
                        </View>
                    </View>
                    <Button
                        buttonStyle={[themeForms.styles.button, styles.shareButton]}
                        titleStyle={[themeForms.styles.buttonTitle, styles.shareButtonTitle]}
                        title={translate('components.referralStats.shareLink')}
                        onPress={onShareLink}
                    />
                </View>
            )}
        </View>
    );
};

export default ReferralStats;
