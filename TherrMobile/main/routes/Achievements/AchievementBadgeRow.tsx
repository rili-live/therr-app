import React from 'react';
import { Pressable, Text, View } from 'react-native';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import AchievementBadgeCell from './AchievementBadgeCell';
import { BADGE_ASPECT } from '../../components/Achievements/HabitsAchievementBadge';
import { IAchievementBadge } from '../../utilities/achievementCollection';

/**
 * A cell in the grid: a badge, or the control at the end of a ladder that shows the
 * locked badges it is holding back (`more`) or folds them away again (`less`).
 */
export type IBadgeGridCell =
    | { kind: 'badge'; key: string; badge: IAchievementBadge }
    | { kind: 'more'; key: string; count: number }
    | { kind: 'less'; key: string };

export const toBadgeCells = (badges: IAchievementBadge[]): IBadgeGridCell[] => badges
    .map((badge) => ({ kind: 'badge', key: badge.key, badge }));

interface IAchievementBadgeRowProps {
    cells: IBadgeGridCell[];
    columns: number;
    cardWidth: number;
    onPressBadge?: (badge: IAchievementBadge) => void;
    /** Pressed on a `more` or `less` cell. */
    onToggleExpanded?: () => void;
    themeAchievements: any;
    translate: (key: string, params?: any) => string;
}

/**
 * One row of the badge grid. The grid is drawn row by row so a virtualized list can
 * recycle it — ninety-odd SVG cards in a single wrapping view would all mount at once.
 * A short last row is padded with empty cells so its badges keep the column width.
 */
const AchievementBadgeRow = ({
    cells,
    columns,
    cardWidth,
    onPressBadge,
    onToggleExpanded,
    themeAchievements,
    translate,
}: IAchievementBadgeRowProps) => {
    const { styles, colors } = themeAchievements;
    const fillers = Math.max(0, columns - cells.length);

    return (
        <View style={styles.badgeRow}>
            {cells.map((cell) => {
                if (cell.kind === 'badge') {
                    const { badge } = cell;

                    return (
                        <AchievementBadgeCell
                            key={cell.key}
                            badge={badge}
                            cardWidth={cardWidth}
                            onPress={onPressBadge}
                            stateLabel={translate(`pages.achievements.states.${badge.state}`)}
                            progressLabel={`${badge.progressCount}/${badge.config.countToComplete}`}
                            claimLabel={translate('pages.achievements.info.claim')}
                            themeAchievements={themeAchievements}
                        />
                    );
                }

                const isMore = cell.kind === 'more';
                const label = isMore
                    ? translate('pages.achievements.buttons.showLocked')
                    : translate('pages.achievements.buttons.showLess');

                return (
                    <Pressable
                        key={cell.key}
                        accessibilityRole="button"
                        accessibilityLabel={isMore
                            ? translate('pages.achievements.info.moreLocked', { count: cell.count })
                            : label}
                        onPress={onToggleExpanded}
                        style={({ pressed }) => [styles.badgeCell, pressed && styles.badgeCellPressed]}
                        testID={`achievement-badge-${cell.kind}`}
                    >
                        <View style={[styles.badgeMoreCard, { width: cardWidth, height: cardWidth * BADGE_ASPECT }]}>
                            {isMore
                                ? <Text style={styles.badgeMoreCount}>{`+${cell.count}`}</Text>
                                : <FontAwesome5Icon name="chevron-up" size={16} color={colors.onSurfaceMuted} />}
                        </View>
                        <Text style={[styles.badgeCellTitle, styles.badgeMoreLabel]} numberOfLines={2}>{label}</Text>
                    </Pressable>
                );
            })}
            {Array.from({ length: fillers }, (_, index) => (
                <View key={`filler-${index}`} style={styles.badgeCell} />
            ))}
        </View>
    );
};

export default React.memo(AchievementBadgeRow);
