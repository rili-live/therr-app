import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../themes';
import { buttonMenuHeight } from '../navigation/buttonMenu';

// Medal accents are branding-stable (same in every theme) like colors.branding*
const MEDAL_COLORS = ['#D6AF36', '#A7A7AD', '#A77044'];

// League move-zone accents (promotion up, relegation down), branding-stable like the medals.
const LEAGUE_ZONE_COLORS = {
    promote: '#2E7D32',
    demote: '#C62828',
};

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        body: {
            flex: 1,
        },
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
        // Accounts that never chose a username. Muted and italic so the placeholder reads as
        // deliberate rather than as a name that failed to load.
        userNameTextAnonymous: {
            fontStyle: 'italic',
            fontWeight: '400',
            color: therrTheme.colors.textGray,
        },
        // The streak chip sits directly before the XP total. Without a gap, a 1-day streak
        // beside "55 XP" reads as "155 XP" and the board looks mis-sorted.
        streakChipSpacing: {
            marginLeft: 8,
            marginRight: 12,
        },
        pointsText: {
            fontSize: 15,
            fontWeight: '700',
            color: therrTheme.colors.primary3,
        },
        // The floating bottom nav overlaps the bottom of the screen; whichever of the list or
        // the rank bar sits lowest has to clear it, or the last row is cut off.
        listContentContainer: {
            paddingBottom: buttonMenuHeight + 12,
        },
        currentUserBar: {
            marginBottom: buttonMenuHeight,
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderTopWidth: 1,
            borderTopColor: therrTheme.colors.accentDivider,
            backgroundColor: therrTheme.colors.backgroundWhite,
        },
        currentUserBarTextContainer: {
            flex: 1,
            marginRight: 8,
        },
        currentUserBarText: {
            fontSize: 14,
            fontWeight: '600',
            color: therrTheme.colors.textWhite,
        },
        currentUserBarZoneText: {
            fontSize: 12,
            fontWeight: '600',
            marginTop: 2,
        },
        // The promotion and demotion lines across the league board: a rule either side of a short
        // label, coloured per line (LEAGUE_ZONE_COLORS) inline.
        leagueLine: {
            flexDirection: 'row',
            alignItems: 'center',
            marginHorizontal: 14,
            marginVertical: 6,
        },
        leagueLineRule: {
            flex: 1,
            height: 2,
            borderRadius: 1,
        },
        leagueLineIcon: {
            marginLeft: 8,
        },
        leagueLineLabel: {
            marginLeft: 4,
            marginRight: 8,
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
        },
        // Leagues: the requester's league, its ladder and the move lines. The accent colour is
        // per league (therr-js-utilities/config LEADERBOARD_LEAGUES_BY_BRAND), so it is applied
        // inline on top of these.
        leagueHeader: {
            marginHorizontal: 10,
            marginTop: 10,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 12,
            borderLeftWidth: 4,
            backgroundColor: therrTheme.colors.backgroundWhite,
        },
        leagueHeaderTitleRow: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        leagueHeaderEmoji: {
            fontSize: 28,
            marginRight: 10,
        },
        leagueHeaderTitleContainer: {
            flex: 1,
        },
        leagueHeaderTitle: {
            fontSize: 17,
            fontWeight: '700',
            color: therrTheme.colors.textWhite,
        },
        leagueHeaderSubtitle: {
            fontSize: 12,
            marginTop: 2,
            color: therrTheme.colors.textGray,
        },
        leagueLadder: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 10,
        },
        leagueLadderStep: {
            flex: 1,
            alignItems: 'center',
            paddingVertical: 4,
            marginHorizontal: 2,
            borderRadius: 8,
            opacity: 0.45,
        },
        leagueLadderStepCurrent: {
            opacity: 1,
            backgroundColor: therrTheme.colors.backgroundNeutral,
        },
        leagueLadderStepPassed: {
            opacity: 0.8,
        },
        leagueLadderEmoji: {
            fontSize: 18,
        },
        leagueZoneLine: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 8,
        },
        leagueZoneText: {
            flex: 1,
            marginLeft: 8,
            fontSize: 12,
            color: therrTheme.colors.textWhite,
        },
        leagueZoneIndicator: {
            width: 18,
            alignItems: 'center',
            marginLeft: 8,
        },
        leagueBadge: {
            fontSize: 14,
            marginLeft: 8,
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
    LEAGUE_ZONE_COLORS,
    MEDAL_COLORS,
};
