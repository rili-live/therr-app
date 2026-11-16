import React from 'react';
import { Pressable, Text, View } from 'react-native';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import AchievementBadgeRow, { toBadgeCells } from './AchievementBadgeRow';
import {
    buildAchievementShowcase,
    chunkBadges,
    IAchievementBadge,
} from '../../utilities/achievementCollection';

/**
 * A profile's achievements as a trophy shelf: the badges a person has earned, newest
 * first, then what they are working toward.
 *
 * The profile tab used to stack the same full-width rows as the Achievements screen,
 * earned and unearned mixed in whatever order the API returned them — a visitor saw
 * two badges per screen and had to scroll to find out how many there were. A grid
 * shows a dozen at a glance, which is the point of showing them off.
 *
 * The tab's list is owned by the profile screen (it has to be the collapsible header's
 * scroll component), so this exports the list's data and row renderer rather than a
 * list of its own.
 */

const SHOWCASE_IN_PROGRESS_ROWS = 2;

export type IShowcaseItem =
    | { kind: 'header'; key: string; title: string; count: number; isFirst: boolean; hasLink: boolean }
    | { kind: 'row'; key: string; badges: IAchievementBadge[] };

export const buildShowcaseItems = ({
    userAchievements,
    columns,
    translate,
    showCollectionLink,
}: {
    userAchievements: { [key: string]: any } | any[] | undefined | null;
    columns: number;
    translate: (key: string, params?: any) => string;
    /** Own profile only: a link from the shelf to the full collection. */
    showCollectionLink: boolean;
}): IShowcaseItem[] => {
    const showcase = buildAchievementShowcase(userAchievements);
    const items: IShowcaseItem[] = [];
    const groups: { key: string; title: string; badges: IAchievementBadge[] }[] = [
        { key: 'earned', title: translate('pages.achievements.sections.earned'), badges: showcase.earned },
        // Two rows of what is closest to done. A profile is a shelf, not a to-do list — the
        // rest is on the Achievements screen.
        {
            key: 'inProgress',
            title: translate('pages.achievements.sections.inProgress'),
            badges: showcase.inProgress.slice(0, columns * SHOWCASE_IN_PROGRESS_ROWS),
        },
    ];

    groups.filter((group) => group.badges.length > 0).forEach((group) => {
        items.push({
            kind: 'header',
            key: `header:${group.key}`,
            title: group.title,
            count: group.badges.length,
            isFirst: items.length === 0,
            hasLink: showCollectionLink && items.length === 0,
        });
        chunkBadges(group.badges, columns).forEach((badges, index) => {
            items.push({ kind: 'row', key: `${group.key}:${index}`, badges });
        });
    });

    return items;
};

interface IAchievementShowcaseItemProps {
    item: IShowcaseItem;
    columns: number;
    cardWidth: number;
    onPressBadge: (badge: IAchievementBadge) => void;
    onPressCollection?: () => void;
    themeAchievements: any;
    translate: (key: string, params?: any) => string;
}

const AchievementShowcaseItem = ({
    item,
    columns,
    cardWidth,
    onPressBadge,
    onPressCollection,
    themeAchievements,
    translate,
}: IAchievementShowcaseItemProps) => {
    const { styles, textColors } = themeAchievements;

    if (item.kind === 'header') {
        return (
            <View style={[styles.showcaseHeader, item.isFirst && styles.showcaseHeaderFirst]}>
                <View style={styles.collectionHeaderRow}>
                    <Text style={styles.sectionHeaderTitle}>{item.title}</Text>
                    <Text style={styles.sectionHeaderCount}>{item.count}</Text>
                </View>
                {item.hasLink && !!onPressCollection && (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={translate('pages.achievements.buttons.viewCollection')}
                        onPress={onPressCollection}
                        hitSlop={8}
                        style={({ pressed }) => [styles.showcaseLink, pressed && styles.sectionHeaderPressed]}
                    >
                        <Text style={styles.showcaseLinkText}>
                            {translate('pages.achievements.buttons.viewCollection')}
                        </Text>
                        <FontAwesome5Icon name="chevron-right" size={10} color={textColors.brand} />
                    </Pressable>
                )}
            </View>
        );
    }

    return (
        <View style={styles.showcaseRow}>
            <AchievementBadgeRow
                cells={toBadgeCells(item.badges)}
                columns={columns}
                cardWidth={cardWidth}
                onPressBadge={onPressBadge}
                themeAchievements={themeAchievements}
                translate={translate}
            />
        </View>
    );
};

export default AchievementShowcaseItem;
