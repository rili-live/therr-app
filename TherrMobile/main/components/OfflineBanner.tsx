import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import translator from '../services/translator';

const TOOLTIP_AUTO_DISMISS_MS = 3000;

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        left: 6,
        zIndex: 9999,
        // Above the header/status bar on Android
        elevation: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    badge: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.25,
        shadowRadius: 2,
    },
    tooltip: {
        marginLeft: 8,
        maxWidth: 220,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 6,
        backgroundColor: 'rgba(26, 26, 26, 0.92)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
    },
    tooltipText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontFamily: 'Lexend-Regular',
    },
});

// Subtle offline indicator: a small red warning icon pinned to the top-left
// safe-area corner. Tapping the icon reveals a tooltip describing the offline
// state, which auto-dismisses. Renders nothing when connected so it never
// blocks the header.
const OfflineBanner = () => {
    const isConnected = useSelector((state: any) => state.network?.isConnected);
    const locale = useSelector((state: any) => state?.user?.settings?.locale || 'en-us');
    const insets = useSafeAreaInsets();
    const [tooltipVisible, setTooltipVisible] = React.useState(false);
    const dismissTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearDismissTimer = React.useCallback(() => {
        if (dismissTimeoutRef.current) {
            clearTimeout(dismissTimeoutRef.current);
            dismissTimeoutRef.current = null;
        }
    }, []);

    // Hide tooltip and clear timers when connectivity returns
    React.useEffect(() => {
        if (isConnected !== false) {
            clearDismissTimer();
            setTooltipVisible(false);
        }
    }, [isConnected, clearDismissTimer]);

    React.useEffect(() => () => clearDismissTimer(), [clearDismissTimer]);

    if (isConnected !== false) {
        return null;
    }

    const tooltipLabel = translator(locale, 'components.offlineBanner.tooltip');

    const toggleTooltip = () => {
        clearDismissTimer();
        setTooltipVisible((prev) => {
            const next = !prev;
            if (next) {
                dismissTimeoutRef.current = setTimeout(() => {
                    setTooltipVisible(false);
                    dismissTimeoutRef.current = null;
                }, TOOLTIP_AUTO_DISMISS_MS);
            }
            return next;
        });
    };

    return (
        <View
            pointerEvents="box-none"
            style={[styles.overlay, { top: insets.top + 4 }]}
            accessibilityLiveRegion="polite"
        >
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={tooltipLabel}
                style={styles.badge}
                hitSlop={6}
                onPress={toggleTooltip}
            >
                <Icon name="warning" size={18} color="#D70000" />
            </Pressable>
            {tooltipVisible && (
                <Pressable style={styles.tooltip} onPress={() => setTooltipVisible(false)}>
                    <Text style={styles.tooltipText} numberOfLines={2}>
                        {tooltipLabel}
                    </Text>
                </Pressable>
            )}
        </View>
    );
};

export default OfflineBanner;
