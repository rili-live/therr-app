import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { bottomSafeAreaInset } from '../../navigation/buttonMenu';
import { getTheme } from '../../themes';

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);
    const styles = StyleSheet.create({
        container: {
            marginTop: 0,
            flex: 1,
        },
        sendBtnContainer: {
            marginHorizontal: 4,
        },
        // --- Chat rows (routes/Groups/ForumMessage.tsx) ---
        messageRow: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 8,
            marginVertical: 4,
            paddingRight: 48,
        },
        messageRowOwn: {
            justifyContent: 'flex-end',
            paddingRight: 0,
            paddingLeft: 48,
        },
        senderAvatar: {
            width: 32,
            height: 32,
            borderRadius: 16,
        },
        bubble: {
            flexShrink: 1,
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: 6,
            borderRadius: 18,
        },
        bubbleOther: {
            backgroundColor: therrTheme.colors.surfaceAlt,
            borderBottomLeftRadius: 4,
        },
        bubbleOwn: {
            backgroundColor: therrTheme.colors.brand,
            borderBottomRightRadius: 4,
        },
        senderName: {
            fontSize: 13,
            fontWeight: '700',
            marginBottom: 2,
        },
        messageText: {
            color: therrTheme.colors.onSurface,
            fontSize: 15,
            lineHeight: 21,
        },
        messageTextOwn: {
            color: therrTheme.colors.onBrand,
        },
        messageTime: {
            alignSelf: 'flex-end',
            marginTop: 2,
            fontSize: 11,
            color: therrTheme.colors.onSurfaceMuted,
        },
        messageTimeOwn: {
            color: therrTheme.colors.onBrand,
            opacity: 0.8,
        },
        announcementRow: {
            alignItems: 'center',
            marginVertical: 6,
        },
        announcementText: {
            fontSize: 12,
            color: therrTheme.colors.onSurfaceMuted,
            textAlign: 'center',
        },
        footer: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 10,
            paddingTop: 8,
            paddingBottom: 8 + bottomSafeAreaInset,
            backgroundColor: therrTheme.colors.backgroundWhite,
            borderTopWidth: 1,
            borderTopColor: therrTheme.colors.accentDivider,
        },
    });

    return ({
        ...therrTheme,
        styles,
    });
};

export  {
    buildStyles,
};
