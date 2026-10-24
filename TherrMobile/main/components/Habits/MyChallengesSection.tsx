import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { HabitsChallengesService } from 'therr-react/services';
import getDeviceTimeZone from '../../utilities/deviceTimeZone';
import {
    IChallenge,
    formatChallengeScore,
    formatChallengeTimeLeft,
} from '../../routes/Challenges/challengeFormat';

interface IMyChallengesSectionProps {
    navigation: any;
    themeHabits: any;
    translate: (key: string, params?: any) => string;
    /** Bumped by the parent's pull-to-refresh, so the list refetches with the rest of the screen. */
    refreshKey?: number;
}

/**
 * "Your challenges" on My Habits: every running or finished challenge the user is in, with
 * their place on the board. Renders nothing until there is at least one — a heading over an
 * empty list asks the user for something they never set out to do.
 *
 * Fetched here rather than through redux: My Habits is the only screen that lists them.
 */
const MyChallengesSection: React.FC<IMyChallengesSectionProps> = ({
    navigation,
    themeHabits,
    translate,
    refreshKey = 0,
}) => {
    const [challenges, setChallenges] = useState<IChallenge[]>([]);
    const isMounted = useRef(true);
    const { styles } = themeHabits;

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const load = useCallback(() => {
        HabitsChallengesService.getMine(getDeviceTimeZone() || undefined)
            .then((response: any) => {
                const list = response?.data?.challenges;
                // A transient failure arrives as `{ data: {} }`; keep what is on screen.
                if (isMounted.current && Array.isArray(list)) {
                    setChallenges(list);
                }
            })
            .catch(() => undefined);
    }, []);

    useEffect(() => {
        load();
    }, [load, refreshKey]);

    // Back from a challenge (joined, left or ended there) should show the change.
    useEffect(() => {
        const unsubscribe = navigation?.addListener?.('focus', load);
        return () => unsubscribe?.();
    }, [navigation, load]);

    if (!challenges.length) {
        return null;
    }

    return (
        <View style={styles.challengeCard}>
            <Text style={styles.challengeSectionTitle}>{translate('pages.challenges.myChallengesTitle')}</Text>
            {challenges.map((challenge) => {
                const viewerRow = challenge.viewer?.rank
                    ? challenge.standings.find((row) => row.rank === challenge.viewer?.rank)
                    : undefined;
                const placeLine = challenge.viewer?.rank
                    ? translate('pages.challenges.myPlace', {
                        rank: challenge.viewer.rank,
                        count: challenge.memberCount,
                        score: viewerRow ? formatChallengeScore(viewerRow, challenge, translate) : '',
                    })
                    : translate('pages.challenges.memberCount', { count: challenge.memberCount });

                return (
                    <Pressable
                        key={challenge.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${challenge.title}. ${placeLine}. ${formatChallengeTimeLeft(challenge, translate)}`}
                        onPress={() => navigation.navigate('ChallengeDetail', { joinToken: challenge.joinToken })}
                        style={({ pressed }) => [styles.challengeStandingRow, pressed && styles.pressedOpacity]}
                    >
                        <Text style={styles.myHabitsEmoji}>{challenge.goal.emoji || '🏁'}</Text>
                        <View style={styles.challengeFlex}>
                            <Text style={styles.challengeName} numberOfLines={1}>{challenge.title}</Text>
                            <Text style={styles.challengeHint} numberOfLines={1}>{placeLine}</Text>
                        </View>
                        <Text style={styles.challengeHint}>{formatChallengeTimeLeft(challenge, translate)}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
};

export default MyChallengesSection;
