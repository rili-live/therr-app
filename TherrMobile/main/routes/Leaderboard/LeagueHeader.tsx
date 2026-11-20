import React from 'react';
import { Text, View } from 'react-native';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import { getLeaderboardLeagues } from 'therr-js-utilities/config';
import { LEAGUE_ZONE_COLORS } from '../../styles/leaderboard';
import {
    ILeaderboardLeagueStatus,
    getLeagueNameKey,
    getNeighbourLeague,
} from './leagues';

interface ILeagueHeaderProps {
    brand: string;
    league: ILeaderboardLeagueStatus;
    themeLeaderboard: { styles: any };
    translate: (key: string, params?: any) => string;
}

/**
 * The requester's league above the league board: their branded league, where it sits on the
 * brand's ladder, and the two lines that decide next week — how many move up, how many drop.
 * Renders nothing for a league this build does not know (a newer server's ladder), rather than a
 * blank card.
 */
const LeagueHeader = ({
    brand,
    league,
    themeLeaderboard,
    translate,
}: ILeagueHeaderProps) => {
    const ladder = getLeaderboardLeagues(brand);
    // Looked up by exact id, not `resolveLeague`, which reads an unknown id as the lowest league:
    // that would draw the lowest league's emoji against a newer server's position on its ladder.
    const leagueIndex = ladder.findIndex((ladderLeague) => ladderLeague.id === league.id);
    const current = ladder[leagueIndex];
    if (!current) {
        return null;
    }
    const leagueName = translate(getLeagueNameKey(brand, current.id));
    const nextLeague = getNeighbourLeague(brand, leagueIndex, 1);
    const previousLeague = getNeighbourLeague(brand, leagueIndex, -1);
    const isFrozen = league.promoteCount === 0 && league.demoteCount === 0 && (!!nextLeague || !!previousLeague);
    const { styles } = themeLeaderboard;

    return (
        <View
            style={[styles.leagueHeader, { borderLeftColor: current.color }]}
            accessibilityLabel={translate('pages.leaderboard.leagues.title', { league: leagueName })}
        >
            <View style={styles.leagueHeaderTitleRow}>
                <Text style={styles.leagueHeaderEmoji}>{current.emoji}</Text>
                <View style={styles.leagueHeaderTitleContainer}>
                    <Text style={[styles.leagueHeaderTitle, { color: current.color }]}>
                        {translate('pages.leaderboard.leagues.title', { league: leagueName })}
                    </Text>
                    <Text style={styles.leagueHeaderSubtitle}>
                        {translate('pages.leaderboard.leagues.positionOf', {
                            position: leagueIndex + 1,
                            count: ladder.length,
                        })}
                    </Text>
                </View>
            </View>
            <View style={styles.leagueLadder} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {ladder.map((ladderLeague, index) => (
                    <View
                        key={ladderLeague.id}
                        style={[
                            styles.leagueLadderStep,
                            index < leagueIndex ? styles.leagueLadderStepPassed : null,
                            index === leagueIndex ? styles.leagueLadderStepCurrent : null,
                        ]}
                    >
                        <Text style={styles.leagueLadderEmoji}>{ladderLeague.emoji}</Text>
                    </View>
                ))}
            </View>
            {
                league.promoteCount > 0 && nextLeague
                && <View style={styles.leagueZoneLine}>
                    <FontAwesome5Icon name="arrow-up" size={12} color={LEAGUE_ZONE_COLORS.promote} />
                    <Text style={styles.leagueZoneText}>
                        {translate('pages.leaderboard.leagues.promotionZone', {
                            count: league.promoteCount,
                            league: `${nextLeague.emoji} ${translate(getLeagueNameKey(brand, nextLeague.id))}`,
                        })}
                    </Text>
                </View>
            }
            {
                league.demoteCount > 0 && previousLeague
                && <View style={styles.leagueZoneLine}>
                    <FontAwesome5Icon name="arrow-down" size={12} color={LEAGUE_ZONE_COLORS.demote} />
                    <Text style={styles.leagueZoneText}>
                        {translate('pages.leaderboard.leagues.demotionZone', {
                            count: league.demoteCount,
                            league: `${previousLeague.emoji} ${translate(getLeagueNameKey(brand, previousLeague.id))}`,
                        })}
                    </Text>
                </View>
            }
            {
                !nextLeague
                && <View style={styles.leagueZoneLine}>
                    <FontAwesome5Icon name="crown" size={12} color={current.color} />
                    <Text style={styles.leagueZoneText}>{translate('pages.leaderboard.leagues.topLeague')}</Text>
                </View>
            }
            {
                isFrozen
                && <View style={styles.leagueZoneLine}>
                    <FontAwesome5Icon name="hourglass-half" size={12} color={current.color} />
                    <Text style={styles.leagueZoneText}>{translate('pages.leaderboard.leagues.tooSmall')}</Text>
                </View>
            }
        </View>
    );
};

export default LeagueHeader;
