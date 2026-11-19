import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../../themes';


// Group list row geometry. The divider starts at the text column (gutter + avatar + gap) so the
// avatars read as one column, rather than running the full width under them.
export const GROUP_ROW_GUTTER = 16;
export const GROUP_AVATAR_SIZE = 52;
const GROUP_ROW_GAP = 12;

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);
    const styles = StyleSheet.create({
        // --- Group list row (routes/Groups/GroupTile.tsx) ---
        row: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: GROUP_ROW_GAP,
            paddingHorizontal: GROUP_ROW_GUTTER,
            paddingVertical: 14,
            backgroundColor: therrTheme.colors.surface,
        },
        rowPressed: {
            backgroundColor: therrTheme.colors.surfaceAlt,
        },
        rowDivider: {
            position: 'absolute',
            bottom: 0,
            left: GROUP_ROW_GUTTER + GROUP_AVATAR_SIZE + GROUP_ROW_GAP,
            right: 0,
            height: StyleSheet.hairlineWidth,
            backgroundColor: therrTheme.colors.accentDivider,
        },
        avatarFallback: {
            width: GROUP_AVATAR_SIZE,
            height: GROUP_AVATAR_SIZE,
            borderRadius: GROUP_AVATAR_SIZE / 2,
            alignItems: 'center',
            justifyContent: 'center',
        },
        avatarFallbackText: {
            fontSize: 22,
            fontWeight: '700',
            color: therrTheme.colors.onBrand,
        },
        rowContent: {
            flex: 1,
            minWidth: 0,
        },
        rowTitle: {
            fontSize: 16,
            lineHeight: 21,
            fontWeight: '600',
            color: therrTheme.colors.onSurface,
        },
        rowMeta: {
            marginTop: 2,
            fontSize: 13,
            lineHeight: 18,
            color: therrTheme.colors.onSurfaceMuted,
        },
        rowDescription: {
            marginTop: 6,
            fontSize: 14,
            lineHeight: 20,
            color: therrTheme.colors.onSurface,
            opacity: 0.85,
        },
        chipsRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
            marginTop: 10,
        },
        chip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: therrTheme.colors.surfaceAlt,
        },
        chipText: {
            fontSize: 12,
            lineHeight: 16,
            color: therrTheme.colors.onSurfaceMuted,
        },
        rowAction: {
            alignSelf: 'flex-start',
            marginTop: 2,
        },
        joinedBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            paddingTop: 6,
        },
        joinedText: {
            fontSize: 13,
            fontWeight: '600',
            color: therrTheme.colors.brand,
        },
    });

    return ({
        ...therrTheme,
        styles,
    });
};

export {
    buildStyles,
};
