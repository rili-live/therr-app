import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { ITherrThemeColors } from '../../styles/themes';
import { logAppEvent } from '../../utilities/analyticsEvents';
import { PaywallSource } from '../../utilities/upgradeNudge';

interface IUpgradeNudgeCardProps {
    title: string;
    body: string;
    /** Which surface this is, reported on the impression and carried to the paywall. */
    source: PaywallSource;
    onPress: () => void;
    themeHabits: { colors: ITherrThemeColors; styles: any };
    /**
     * `strip` is the compact row that sits inside another screen's list (the
     * dashboard header, the wizard's first step); `card` is a standalone
     * surface with its own margins (the end of the weekly recap).
     */
    variant?: 'strip' | 'card';
    /** Set when a purchase is not the point — a status row that only opens the screen. */
    isStatus?: boolean;
}

/**
 * The one component every path to the paywall renders, so the surfaces look
 * like one offer rather than five ads, and so each impression is counted.
 *
 * Impressions are logged here rather than by the screens because the
 * interesting number is click-through per surface (`habits_paywall_view` with
 * the same `source` is the click), and a screen that forgot to log the
 * impression would make its surface look infinitely effective.
 */
const UpgradeNudgeCard: React.FC<IUpgradeNudgeCardProps> = ({
    title,
    body,
    source,
    onPress,
    themeHabits,
    variant = 'strip',
    isStatus = false,
}) => {
    useEffect(() => {
        logAppEvent('habits_upgrade_nudge_view', { source });
        // Once per mount: a re-render is not a second impression.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { styles } = themeHabits;

    return (
        <Pressable
            accessibilityRole="button"
            // Both lines: an explicit label replaces what the children would
            // compose, and the body is what makes the ask concrete.
            accessibilityLabel={`${title}. ${body}`}
            onPress={onPress}
            style={({ pressed }) => [
                styles.upgradeNudge,
                variant === 'card' && styles.upgradeNudgeCard,
                pressed && styles.pressedOpacity,
            ]}
        >
            <View style={[styles.upgradeNudgeIconCircle, isStatus && styles.upgradeNudgeIconCircleStatus]}>
                <FontAwesome5Icon
                    name={isStatus ? 'check' : 'star'}
                    solid
                    size={14}
                    style={isStatus ? styles.upgradeNudgeIconStatus : styles.upgradeNudgeIcon}
                />
            </View>
            <View style={styles.upgradeNudgeTextContainer}>
                <Text style={styles.upgradeNudgeTitle} numberOfLines={2}>{title}</Text>
                <Text style={styles.upgradeNudgeBody} numberOfLines={2}>{body}</Text>
            </View>
            <MaterialIcon name="chevron-right" size={24} style={styles.upgradeNudgeChevron} />
        </Pressable>
    );
};

export default UpgradeNudgeCard;
