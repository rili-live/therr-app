import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../themes';

/**
 * Shared shell for the full-screen celebration and placement screens: app background, big hero,
 * one very large number, a line of body copy, and a single primary action pinned to the bottom.
 *
 * Every colour comes from the theme rather than a literal, so the same screens render correctly
 * under each brand's palette overrides — the placeholder blue/orange in the original design
 * would have been a Therr-coloured screen inside Friends with Habits.
 */
const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        root: {
            flex: 1,
            paddingHorizontal: 24,
            paddingTop: 48,
            paddingBottom: 32,
            backgroundColor: therrTheme.colors.backgroundGray,
        },
        hero: {
            alignItems: 'center',
            marginBottom: 24,
        },
        center: {
            alignItems: 'center',
            gap: 8,
        },
        bigNumber: {
            fontSize: 88,
            lineHeight: 96,
            fontWeight: '800',
            letterSpacing: -2,
            color: therrTheme.colors.textWhite,
        },
        label: {
            fontSize: 24,
            fontWeight: '700',
            marginBottom: 8,
            color: therrTheme.colors.textWhite,
        },
        copy: {
            fontSize: 16,
            textAlign: 'center',
            opacity: 0.85,
            marginTop: 16,
            lineHeight: 22,
            color: therrTheme.colors.textWhite,
        },
        copyStrong: {
            fontSize: 16,
            fontWeight: '700',
            textAlign: 'center',
            marginTop: 8,
            color: therrTheme.colors.textWhite,
        },
        actions: {
            marginTop: 'auto',
            gap: 12,
        },
        button: {
            height: 52,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
        },
        buttonPrimary: {
            backgroundColor: therrTheme.colors.brand,
        },
        buttonPrimaryText: {
            color: therrTheme.colors.brandingWhite,
            fontWeight: '800',
            letterSpacing: 1,
            fontSize: 16,
        },
        buttonSecondary: {
            borderWidth: 2,
            borderColor: therrTheme.colors.brand,
        },
        buttonSecondaryText: {
            color: therrTheme.colors.brand,
            fontWeight: '800',
            letterSpacing: 1,
            fontSize: 16,
        },
        // Inline placement card, shown at the top of the leaderboard for a finish outside the
        // top 3 — the same news, without a modal it did not earn.
        placementCard: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginHorizontal: 14,
            marginTop: 10,
            padding: 12,
            borderRadius: 12,
            backgroundColor: therrTheme.colors.backgroundNeutral,
        },
        placementCardTextContainer: {
            flex: 1,
        },
        placementCardTitle: {
            fontSize: 15,
            fontWeight: '700',
            color: therrTheme.colors.textWhite,
        },
        placementCardSubtitle: {
            fontSize: 12,
            opacity: 0.75,
            paddingTop: 2,
            color: therrTheme.colors.textWhite,
        },
        placementCardDismiss: {
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
        },
        // The 🔥 chip beside a leaderboard row's name.
        streakChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
        },
        streakChipText: {
            fontSize: 12,
            fontWeight: '700',
            color: therrTheme.colors.brandingOrange,
        },
    });

    return {
        colors: therrTheme.colors,
        styles,
    };
};

export { buildStyles };
