import React from 'react';
import { Text, View } from 'react-native';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import { getLeaderboardTiers } from 'therr-js-utilities/config';
import { LEAGUE_ZONE_COLORS } from '../../styles/leaderboard';
import {
    ILeaderboardLeague,
    getNeighbourTier,
    getTier,
    getTierNameKey,
} from './leagues';

interface ILeagueHeaderProps {
    brand: string;
    league: ILeaderboardLeague;
    themeLeaderboard: { styles: any };
    translate: (key: string, params?: any) => string;
}

/**
 * The requester's league above the league board: their branded tier, where it sits on the brand's
 * ladder, and the two lines that decide next week — how many move up, how many drop. Renders
 * nothing for a tier this build does not know (a newer server's ladder), rather than a blank card.
 */
const LeagueHeader = ({
    brand,
    league,
    themeLeaderboard,
    translate,
}: ILeagueHeaderProps) => {
    const tier = getTier(brand, league.id);
    const tiers = getLeaderboardTiers(brand);
    if (!tier || !tiers.length) {
        return null;
    }
    const tierName = translate(getTierNameKey(brand, tier.id));
    const nextTier = getNeighbourTier(brand, league.tierIndex, 1);
    const previousTier = getNeighbourTier(brand, league.tierIndex, -1);
    const isFrozen = league.promoteCount === 0 && league.demoteCount === 0 && (!!nextTier || !!previousTier);
    const { styles } = themeLeaderboard;

    return (
        <View
            style={[styles.leagueHeader, { borderLeftColor: tier.color }]}
            accessibilityLabel={translate('pages.leaderboard.leagues.title', { tier: tierName })}
        >
            <View style={styles.leagueHeaderTitleRow}>
                <Text style={styles.leagueHeaderEmoji}>{tier.emoji}</Text>
                <View style={styles.leagueHeaderTitleContainer}>
                    <Text style={[styles.leagueHeaderTitle, { color: tier.color }]}>
                        {translate('pages.leaderboard.leagues.title', { tier: tierName })}
                    </Text>
                    <Text style={styles.leagueHeaderSubtitle}>
                        {translate('pages.leaderboard.leagues.tierOf', {
                            tier: league.tierIndex + 1,
                            count: league.tierCount,
                        })}
                    </Text>
                </View>
            </View>
            <View style={styles.leagueLadder} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {tiers.map((ladderTier, index) => (
                    <View
                        key={ladderTier.id}
                        style={[
                            styles.leagueLadderStep,
                            index < league.tierIndex ? styles.leagueLadderStepPassed : null,
                            index === league.tierIndex ? styles.leagueLadderStepCurrent : null,
                        ]}
                    >
                        <Text style={styles.leagueLadderEmoji}>{ladderTier.emoji}</Text>
                    </View>
                ))}
            </View>
            {
                league.promoteCount > 0 && nextTier
                && <View style={styles.leagueZoneLine}>
                    <FontAwesome5Icon name="arrow-up" size={12} color={LEAGUE_ZONE_COLORS.promote} />
                    <Text style={styles.leagueZoneText}>
                        {translate('pages.leaderboard.leagues.promotionZone', {
                            count: league.promoteCount,
                            tier: `${nextTier.emoji} ${translate(getTierNameKey(brand, nextTier.id))}`,
                        })}
                    </Text>
                </View>
            }
            {
                league.demoteCount > 0 && previousTier
                && <View style={styles.leagueZoneLine}>
                    <FontAwesome5Icon name="arrow-down" size={12} color={LEAGUE_ZONE_COLORS.demote} />
                    <Text style={styles.leagueZoneText}>
                        {translate('pages.leaderboard.leagues.demotionZone', {
                            count: league.demoteCount,
                            tier: `${previousTier.emoji} ${translate(getTierNameKey(brand, previousTier.id))}`,
                        })}
                    </Text>
                </View>
            }
            {
                !nextTier
                && <View style={styles.leagueZoneLine}>
                    <FontAwesome5Icon name="crown" size={12} color={tier.color} />
                    <Text style={styles.leagueZoneText}>{translate('pages.leaderboard.leagues.topTier')}</Text>
                </View>
            }
            {
                isFrozen
                && <View style={styles.leagueZoneLine}>
                    <FontAwesome5Icon name="hourglass-half" size={12} color={tier.color} />
                    <Text style={styles.leagueZoneText}>{translate('pages.leaderboard.leagues.tooSmall')}</Text>
                </View>
            }
        </View>
    );
};

export default LeagueHeader;
