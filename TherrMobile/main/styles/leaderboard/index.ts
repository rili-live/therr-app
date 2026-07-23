import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../themes';

// Medal accents are branding-stable (same in every theme) like colors.branding*
const MEDAL_COLORS = ['#D6AF36', '#A7A7AD', '#A77044'];

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        tabsContainer: {
            flexDirection: 'row',
            paddingHorizontal: 14,
            paddingTop: 12,
            paddingBottom: 4,
        },
        tab: {
            flex: 1,
            paddingVertical: 8,
            marginHorizontal: 4,
            borderRadius: 20,
            backgroundColor: therrTheme.colors.backgroundNeutral,
            alignItems: 'center',
        },
        tabActive: {
            backgroundColor: therrTheme.colors.primary3,
        },
        tabText: {
            fontWeight: '600',
            fontSize: 13,
            color: therrTheme.colors.textWhite,
        },
        tabTextActive: {
            color: therrTheme.colors.brandingWhite,
        },
        resetCountdownText: {
            textAlign: 'center',
            fontSize: 12,
            paddingVertical: 6,
            color: therrTheme.colors.textGray,
        },
        rowContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
            paddingHorizontal: 14,
            marginHorizontal: 10,
            marginVertical: 3,
            borderRadius: 10,
            backgroundColor: therrTheme.colors.backgroundWhite,
        },
        rowContainerHighlighted: {
            backgroundColor: therrTheme.colors.brandingLightBlue,
        },
        rankContainer: {
            width: 38,
            alignItems: 'center',
            justifyContent: 'center',
        },
        rankText: {
            fontSize: 15,
            fontWeight: '700',
            color: therrTheme.colors.textGray,
        },
        userNameText: {
            flex: 1,
            marginLeft: 12,
            fontSize: 15,
            fontWeight: '600',
            color: therrTheme.colors.textWhite,
        },
        pointsText: {
            fontSize: 15,
            fontWeight: '700',
            color: therrTheme.colors.primary3,
        },
        currentUserBar: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderTopWidth: 1,
            borderTopColor: therrTheme.colors.accentDivider,
            backgroundColor: therrTheme.colors.backgroundWhite,
        },
        currentUserBarText: {
            flex: 1,
            fontSize: 14,
            fontWeight: '600',
            color: therrTheme.colors.textWhite,
        },
        emptyContainer: {
            padding: 24,
        },
        emptyText: {
            textAlign: 'center',
            color: therrTheme.colors.textGray,
        },
    });

    return ({
        ...therrTheme,
        styles,
    });
};

export {
    buildStyles,
    MEDAL_COLORS,
};
