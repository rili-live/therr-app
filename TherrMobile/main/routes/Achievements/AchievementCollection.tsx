import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, Text, useWindowDimensions, View } from 'react-native';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import AchievementTile from './AchievementTile';
import AchievementBadgeRow, { IBadgeGridCell, toBadgeCells } from './AchievementBadgeRow';
import { getBadgeGridCardWidth, getBadgeGridColumns } from './AchievementBadgeCell';
import { getBadgeTone } from '../../styles/achievements/badgePalette';
import { getClassArt } from '../../components/Achievements/HabitsAchievementBadge';
import {
    buildAchievementCollection,
    chunkBadges,
    condenseBadges,
    getAchievementClassName,
    getAchievementCopy,
    IAchievementBadge,
    IAchievementClassGroup,
} from '../../utilities/achievementCollection';

const keyOfItem = (item: { key: string }) => item.key;

/** How many in-progress achievements get a full row. The rest are still in the grid below. */
export const UP_NEXT_LIMIT = 3;

type ICollectionItem =
    | { kind: 'tile'; key: string; badge: IAchievementBadge }
    | { kind: 'row'; key: string; achievementClass: string; cells: IBadgeGridCell[]; isLast: boolean };

interface ICollectionSection {
    key: string;
    kind: 'claim' | 'upNext' | 'collection' | 'class';
    title: string;
    count?: number;
    group?: IAchievementClassGroup;
    isCollapsed?: boolean;
    data: ICollectionItem[];
}

export interface IAchievementCollectionProps {
    achievements: { [key: string]: any } | undefined | null;
    brandVariation: string;
    claimingIds: { [id: string]: boolean };
    onClaim: (badge: IAchievementBadge) => void;
    onPressBadge: (badge: IAchievementBadge) => void;
    ListHeaderComponent?: React.ReactElement | null;
    ListEmptyComponent?: React.ReactElement | null;
    refreshControl?: React.ReactElement<any>;
    /** List rows mounted before the first scroll. */
    initialNumToRender?: number;
    themeAchievements: any;
    translate: (key: string, params?: any) => string;
}

/**
 * The body of the Achievements screen.
 *
 * It used to be one long list of full-width rows: every achievement the user had
 * touched, each as tall as a card, with nothing shown for the ones still ahead. That
 * worked for a dozen achievements and stopped working at ninety.
 *
 * It is now two things, in the order a user needs them:
 *
 *  1. what to do — rewards waiting to be claimed, then the few achievements closest
 *     to done, as rows with room for a description and a real progress meter;
 *  2. the collection — every badge the brand offers as a grid, one panel per ladder,
 *     earned, in progress and locked alike, so the screen shows what is ahead as well
 *     as what is behind.
 */
const AchievementCollection = ({
    achievements,
    brandVariation,
    claimingIds,
    onClaim,
    onPressBadge,
    ListHeaderComponent,
    ListEmptyComponent,
    refreshControl,
    initialNumToRender = 8,
    themeAchievements,
    translate,
}: IAchievementCollectionProps) => {
    const { styles, colors } = themeAchievements;
    const { width: windowWidth } = useWindowDimensions();
    const columns = getBadgeGridColumns(windowWidth);
    const cardWidth = getBadgeGridCardWidth(windowWidth, columns);
    const [collapsedClasses, setCollapsedClasses] = useState<{ [achievementClass: string]: boolean }>({});
    // Ladders showing every locked badge rather than the condensed view.
    const [expandedClasses, setExpandedClasses] = useState<{ [achievementClass: string]: boolean }>({});

    const collection = useMemo(
        () => buildAchievementCollection({ userAchievements: achievements, brandVariation }),
        [achievements, brandVariation],
    );

    const toggleClass = useCallback((achievementClass: string) => {
        setCollapsedClasses((prev) => ({ ...prev, [achievementClass]: !prev[achievementClass] }));
    }, []);

    const toggleExpanded = useCallback((achievementClass: string) => {
        setExpandedClasses((prev) => ({ ...prev, [achievementClass]: !prev[achievementClass] }));
    }, []);

    const sections = useMemo(() => {
        const result: ICollectionSection[] = [];

        if (collection.claimable.length > 0) {
            result.push({
                key: 'claim',
                kind: 'claim',
                title: translate('pages.achievements.sections.unclaimed'),
                count: collection.claimable.length,
                data: collection.claimable.map((badge) => ({ kind: 'tile', key: `claim:${badge.key}`, badge })),
            });
        }

        const upNext = collection.inProgress.slice(0, UP_NEXT_LIMIT);
        if (upNext.length > 0) {
            result.push({
                key: 'upNext',
                kind: 'upNext',
                title: translate('pages.achievements.sections.upNext'),
                data: upNext.map((badge) => ({ kind: 'tile', key: `next:${badge.key}`, badge })),
            });
        }

        if (collection.classes.length > 0) {
            result.push({
                key: 'collection',
                kind: 'collection',
                title: translate('pages.achievements.sections.collection'),
                data: [],
            });
        }

        collection.classes.forEach((group) => {
            const isCollapsed = !!collapsedClasses[group.achievementClass];
            const isExpanded = !!expandedClasses[group.achievementClass];
            const condensed = condenseBadges(group.badges, columns);
            let cells: IBadgeGridCell[];
            if (condensed.hiddenCount === 0) {
                cells = toBadgeCells(group.badges);
            } else if (isExpanded) {
                cells = [...toBadgeCells(group.badges), { kind: 'less', key: `${group.achievementClass}:less` }];
            } else {
                cells = [
                    ...toBadgeCells(condensed.visible),
                    { kind: 'more', key: `${group.achievementClass}:more`, count: condensed.hiddenCount },
                ];
            }
            const rows = chunkBadges(cells, columns);

            result.push({
                key: `class:${group.achievementClass}`,
                kind: 'class',
                title: getAchievementClassName(group.achievementClass, translate),
                group,
                isCollapsed,
                data: isCollapsed ? [] : rows.map((rowCells, index) => ({
                    kind: 'row',
                    key: `${group.achievementClass}:${index}`,
                    achievementClass: group.achievementClass,
                    cells: rowCells,
                    isLast: index === rows.length - 1,
                })),
            });
        });

        return result;
    }, [collection, collapsedClasses, expandedClasses, columns, translate]);

    const renderSectionHeader = useCallback(({ section }: { section: ICollectionSection }) => {
        if (section.kind === 'collection') {
            const ratio = collection.totalCount > 0 ? collection.earnedCount / collection.totalCount : 0;

            return (
                <View style={styles.collectionHeader}>
                    <View style={styles.collectionHeaderRow}>
                        <Text style={styles.sectionHeaderTitle}>{section.title}</Text>
                        <Text style={styles.collectionHeaderCount}>
                            {translate('pages.achievements.info.earnedOfTotal', {
                                count: collection.earnedCount,
                                total: collection.totalCount,
                            })}
                        </Text>
                    </View>
                    <View style={styles.collectionProgressTrack}>
                        <View style={[styles.collectionProgressFill, { width: `${ratio * 100}%` }]} />
                    </View>
                </View>
            );
        }

        if (section.kind === 'class' && section.group) {
            const { group } = section;
            const tone = getBadgeTone(group.achievementClass, colors);
            const isAllEarned = group.earnedCount >= group.totalCount;

            return (
                <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: !section.isCollapsed }}
                    accessibilityLabel={`${section.title}. ${translate('pages.achievements.info.earnedOfTotal', {
                        count: group.earnedCount,
                        total: group.totalCount,
                    })}`}
                    onPress={() => toggleClass(group.achievementClass)}
                    style={({ pressed }) => [
                        styles.classHeader,
                        section.isCollapsed && styles.classHeaderCollapsed,
                        pressed && styles.sectionHeaderPressed,
                    ]}
                    testID={`achievement-class-header-${group.achievementClass}`}
                >
                    <View style={[styles.classHeaderIcon, { backgroundColor: tone.from }]}>
                        <FontAwesome5Icon
                            name={getClassArt(group.achievementClass).icon}
                            size={12}
                            color={colors.brandingWhite}
                            solid
                        />
                    </View>
                    <Text style={styles.classHeaderTitle} numberOfLines={1}>{section.title}</Text>
                    <View style={[styles.classHeaderCount, isAllEarned && styles.classHeaderCountComplete]}>
                        {isAllEarned && (
                            <FontAwesome5Icon name="check" size={9} color={colors.alertSuccess} solid />
                        )}
                        <Text style={[styles.classHeaderCountText, isAllEarned && styles.classHeaderCountTextComplete]}>
                            {`${group.earnedCount}/${group.totalCount}`}
                        </Text>
                    </View>
                    <FontAwesome5Icon
                        name={section.isCollapsed ? 'chevron-down' : 'chevron-up'}
                        size={11}
                        color={colors.onSurfaceMuted}
                    />
                </Pressable>
            );
        }

        return (
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderTitle}>{section.title}</Text>
                {!!section.count && (
                    <Text style={[styles.sectionHeaderCount, section.kind === 'claim' && styles.sectionHeaderCountAccent]}>
                        {section.count}
                    </Text>
                )}
            </View>
        );
    }, [collection.earnedCount, collection.totalCount, colors, styles, toggleClass, translate]);

    const renderItem = useCallback(({ item }: { item: ICollectionItem }) => {
        if (item.kind === 'tile') {
            const { badge } = item;
            const rowId = badge.userAchievement?.id;
            const copy = getAchievementCopy(badge, translate);

            return (
                <AchievementTile
                    badge={badge}
                    classLabel={getAchievementClassName(badge.achievementClass, translate)}
                    title={copy.title}
                    description={copy.description}
                    claimText={translate('pages.achievements.info.claim')}
                    completedText={translate('pages.achievements.info.completed')}
                    handleClaim={() => onClaim(badge)}
                    isClaiming={!!rowId && !!claimingIds[rowId]}
                    onPressAchievement={() => onPressBadge(badge)}
                    progressText={(params) => translate('pages.achievements.info.progressOf', params)}
                    themeAchievements={themeAchievements}
                />
            );
        }

        return (
            <View style={[styles.classPanelRow, item.isLast && styles.classPanelRowLast]}>
                <AchievementBadgeRow
                    cells={item.cells}
                    columns={columns}
                    cardWidth={cardWidth}
                    onPressBadge={onPressBadge}
                    onToggleExpanded={() => toggleExpanded(item.achievementClass)}
                    themeAchievements={themeAchievements}
                    translate={translate}
                />
            </View>
        );
    }, [cardWidth, claimingIds, columns, onClaim, onPressBadge, styles, themeAchievements, toggleExpanded, translate]);

    return (
        <SectionList
            sections={sections}
            keyExtractor={keyOfItem}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader as any}
            ListHeaderComponent={ListHeaderComponent}
            ListEmptyComponent={ListEmptyComponent}
            contentContainerStyle={styles.listContentContainer}
            refreshControl={refreshControl}
            stickySectionHeadersEnabled={false}
            // Rows are SVG-heavy; a slightly larger first batch avoids a visible fill-in
            // under the two action lists, without mounting the whole collection up front.
            initialNumToRender={initialNumToRender}
            windowSize={7}
        />
    );
};

export default AchievementCollection;
