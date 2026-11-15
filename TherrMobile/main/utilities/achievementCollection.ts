import { achievementsByClass, getAchievementsForBrand, IAchievement } from 'therr-js-utilities/config';
import { BrandVariations } from 'therr-js-utilities/constants';

/**
 * The achievement collection — what the Achievements screen, the profile's badge grid and
 * the badge detail screen all draw from.
 *
 * The backend only returns a row for an achievement the user has started, so on its own
 * `user.achievements` cannot show what is still ahead. The ladders themselves live in the
 * `therr-js-utilities` config, which the client already ships. This joins the two: every
 * badge a brand can earn, in ladder order, each stamped with where the user stands on it.
 *
 * Everything here is pure and derived at render time. Nothing is stored, so a ladder
 * re-tuned in the config re-draws for every user on the next render.
 */

export type AchievementBadgeState = 'claimable' | 'earned' | 'inProgress' | 'locked';

export interface IAchievementBadge {
    /** `${achievementClass}:${achievementId}` — stable across refetches, unlike a row id. */
    key: string;
    achievementClass: string;
    achievementId: string;
    config: IAchievement;
    /** The config's `tier` — one ladder within a class (`1_1`, `1_2`, …). */
    track: string;
    /** 1-based position on that ladder. */
    level: number;
    trackLength: number;
    /** The last rung of a ladder that has more than one. */
    isCapstone: boolean;
    state: AchievementBadgeState;
    /** Clamped to `countToComplete`, so an over-counted row never reads "34 of 30". */
    progressCount: number;
    /** 0..1. Always 1 once earned. */
    progressRatio: number;
    /** The backend row, when the user has one. Absent for a locked badge. */
    userAchievement?: any;
}

export interface IAchievementClassGroup {
    achievementClass: string;
    badges: IAchievementBadge[];
    earnedCount: number;
    totalCount: number;
}

export interface IAchievementCollection {
    /** Earned, reward not yet claimed. The one thing on the screen that pays out. */
    claimable: IAchievementBadge[];
    /** Started and not finished, closest to done first. */
    inProgress: IAchievementBadge[];
    classes: IAchievementClassGroup[];
    earnedCount: number;
    totalCount: number;
}

/**
 * The order ladders are shown in on Friends with Habits: the daily habit loop first, then
 * the pact and partner ladders, then the rest. A class missing from this list (one newly
 * allow-listed for the brand) is appended in config order rather than dropped.
 */
const HABITS_CLASS_ORDER = [
    'dailyStreak',
    'habitBuilder',
    'consistency',
    'cleanBreak',
    'resilience',
    'accountability',
    'pactPioneer',
    'socialEnergizer',
    'socialite',
    'treasureBuilder',
    'weeklyChampion',
];

const CLASS_ORDER_BY_BRAND: { [brand: string]: string[] } = {
    [BrandVariations.HABITS]: HABITS_CLASS_ORDER,
};

export const getAchievementBadgeKey = (achievementClass: string, achievementId: string) => `${achievementClass}:${achievementId}`;

interface ILadderEntry {
    achievementClass: string;
    achievementId: string;
    config: IAchievement;
    track: string;
    level: number;
    trackLength: number;
    isCapstone: boolean;
}

const ladderCache: { [achievementClass: string]: ILadderEntry[] } = {};

/**
 * A class's badges in ladder order: each track in the order the config declares it, each
 * rung in the order it is climbed. Returns an empty list for a class the installed config
 * does not know — the backend can be ahead of an old app build.
 */
export const getClassLadder = (achievementClass: string): ILadderEntry[] => {
    if (ladderCache[achievementClass]) {
        return ladderCache[achievementClass];
    }

    const classConfig = achievementsByClass[achievementClass];
    if (!classConfig) {
        return [];
    }

    const tracks: { [track: string]: string[] } = {};
    const trackOrder: string[] = [];
    Object.keys(classConfig).forEach((achievementId) => {
        const track = classConfig[achievementId].tier || '1_1';
        if (!tracks[track]) {
            tracks[track] = [];
            trackOrder.push(track);
        }
        tracks[track].push(achievementId);
    });

    const ladder: ILadderEntry[] = [];
    trackOrder.forEach((track) => {
        const ids = tracks[track];
        ids.forEach((achievementId, index) => {
            ladder.push({
                achievementClass,
                achievementId,
                config: classConfig[achievementId],
                track,
                level: index + 1,
                trackLength: ids.length,
                isCapstone: ids.length > 1 && index === ids.length - 1,
            });
        });
    });

    ladderCache[achievementClass] = ladder;
    return ladder;
};

const isCompleted = (row: any) => !!row?.completedAt;
const hasUnclaimedReward = (row: any) => isCompleted(row) && Number(row?.unclaimedRewardPts) > 0;

/**
 * Whether `row` is a backend row at all. A locked badge is opened by navigating with just
 * its class and id — a stand-in, not a row — and that must not read as "started, 0 so far".
 */
const isBackendRow = (row: any) => !!row
    && (row.id !== undefined || row.progressCount !== undefined || !!row.completedAt);

const stateOf = (row: any): AchievementBadgeState => {
    if (!isBackendRow(row)) return 'locked';
    if (hasUnclaimedReward(row)) return 'claimable';
    if (isCompleted(row)) return 'earned';
    return 'inProgress';
};

const STATE_RANK: { [state in AchievementBadgeState]: number } = {
    claimable: 3,
    earned: 2,
    inProgress: 1,
    locked: 0,
};

const toBadge = (entry: ILadderEntry, row?: any): IAchievementBadge => {
    const state = stateOf(row);
    const total = Math.max(1, Number(entry.config.countToComplete) || 1);
    const rawCount = Math.max(0, Number(row?.progressCount) || 0);
    const isDone = state === 'claimable' || state === 'earned';
    const progressCount = isDone ? total : Math.min(rawCount, total);

    return {
        ...entry,
        key: getAchievementBadgeKey(entry.achievementClass, entry.achievementId),
        state,
        progressCount,
        progressRatio: isDone ? 1 : progressCount / total,
        userAchievement: isBackendRow(row) ? row : undefined,
    };
};

/**
 * One row per badge. The API should never return two rows for the same achievement, but
 * the `user` slice is persisted and merged across fetches, so if it ever holds two the
 * further-along one wins rather than whichever happened to be iterated last.
 */
const indexRows = (userAchievements: any): { [key: string]: any } => {
    const rows: any[] = Array.isArray(userAchievements) ? userAchievements : Object.values(userAchievements || {});
    const byKey: { [key: string]: any } = {};

    rows.forEach((row) => {
        if (!row?.achievementClass || !row?.achievementId) {
            return;
        }
        const key = getAchievementBadgeKey(row.achievementClass, row.achievementId);
        const existing = byKey[key];
        if (!existing) {
            byKey[key] = row;
            return;
        }
        const rankDelta = STATE_RANK[stateOf(row)] - STATE_RANK[stateOf(existing)];
        if (rankDelta > 0 || (rankDelta === 0 && (Number(row.progressCount) || 0) > (Number(existing.progressCount) || 0))) {
            byKey[key] = row;
        }
    });

    return byKey;
};

/**
 * Resolves a single backend row to a badge, or `null` when the installed config has no
 * entry for it. Callers must handle the `null`: indexing the config directly is what used
 * to crash the list when the backend awarded an achievement the app build predated.
 */
export const toAchievementBadge = (userAchievement: any): IAchievementBadge | null => {
    if (!userAchievement?.achievementClass || !userAchievement?.achievementId) {
        return null;
    }
    const entry = getClassLadder(userAchievement.achievementClass)
        .find((candidate) => candidate.achievementId === userAchievement.achievementId);

    return entry ? toBadge(entry, userAchievement) : null;
};

/** Closest to done first; ties go to the one with the fewest left to do. */
const byClosestToDone = (a: IAchievementBadge, b: IAchievementBadge) => {
    if (b.progressRatio !== a.progressRatio) {
        return b.progressRatio - a.progressRatio;
    }
    const remainingA = a.config.countToComplete - a.progressCount;
    const remainingB = b.config.countToComplete - b.progressCount;
    return remainingA - remainingB;
};

const completedAtMs = (badge: IAchievementBadge) => {
    const ms = new Date(badge.userAchievement?.completedAt).getTime();
    return Number.isFinite(ms) ? ms : 0;
};

const orderedClassNames = (brandVariation?: string): string[] => {
    const allowed = Object.keys(getAchievementsForBrand(brandVariation));
    const preferred = (brandVariation && CLASS_ORDER_BY_BRAND[brandVariation]) || [];
    const ordered = preferred.filter((name) => allowed.includes(name));

    allowed.forEach((name) => {
        if (!ordered.includes(name)) {
            ordered.push(name);
        }
    });

    return ordered;
};

export const buildAchievementCollection = ({
    userAchievements,
    brandVariation,
}: {
    userAchievements: { [key: string]: any } | any[] | undefined | null;
    brandVariation?: string;
}): IAchievementCollection => {
    const rowsByKey = indexRows(userAchievements);
    const classNames = orderedClassNames(brandVariation);

    const classes: IAchievementClassGroup[] = classNames
        .map((achievementClass) => {
            const badges = getClassLadder(achievementClass).map((entry) => toBadge(
                entry,
                rowsByKey[getAchievementBadgeKey(entry.achievementClass, entry.achievementId)],
            ));

            return {
                achievementClass,
                badges,
                earnedCount: badges.filter((badge) => badge.state === 'earned' || badge.state === 'claimable').length,
                totalCount: badges.length,
            };
        })
        .filter((group) => group.totalCount > 0);

    // The action lists are built from the rows, not from the brand's ladders: a reward the
    // user is owed must stay claimable even if its class has since left the brand's list.
    const rowBadges = Object.values(rowsByKey)
        .map(toAchievementBadge)
        .filter((badge): badge is IAchievementBadge => !!badge);

    return {
        claimable: rowBadges
            .filter((badge) => badge.state === 'claimable')
            .sort((a, b) => completedAtMs(b) - completedAtMs(a)),
        inProgress: rowBadges
            .filter((badge) => badge.state === 'inProgress')
            .sort(byClosestToDone),
        classes,
        earnedCount: classes.reduce((sum, group) => sum + group.earnedCount, 0),
        totalCount: classes.reduce((sum, group) => sum + group.totalCount, 0),
    };
};

export interface IAchievementShowcase {
    /** Most recently earned first. */
    earned: IAchievementBadge[];
    /** Closest to done first. */
    inProgress: IAchievementBadge[];
}

/**
 * What a profile shows: the badges a person has, newest first, then what they are working
 * on. No locked badges — a profile is a trophy shelf, not a to-do list.
 */
export const buildAchievementShowcase = (
    userAchievements: { [key: string]: any } | any[] | undefined | null,
): IAchievementShowcase => {
    const badges = Object.values(indexRows(userAchievements))
        .map(toAchievementBadge)
        .filter((badge): badge is IAchievementBadge => !!badge);

    return {
        earned: badges
            .filter((badge) => badge.state === 'earned' || badge.state === 'claimable')
            .sort((a, b) => completedAtMs(b) - completedAtMs(a)),
        inProgress: badges
            .filter((badge) => badge.state === 'inProgress')
            .sort(byClosestToDone),
    };
};

/** The badges on the same ladder as `badge`, in the order they are climbed. */
export const getBadgeTrack = (
    badge: Pick<IAchievementBadge, 'achievementClass' | 'track'>,
    userAchievements: { [key: string]: any } | any[] | undefined | null,
): IAchievementBadge[] => {
    const rowsByKey = indexRows(userAchievements);

    return getClassLadder(badge.achievementClass)
        .filter((entry) => entry.track === badge.track)
        .map((entry) => toBadge(entry, rowsByKey[getAchievementBadgeKey(entry.achievementClass, entry.achievementId)]));
};

export interface ICondensedBadges {
    visible: IAchievementBadge[];
    /** Locked badges left out. Zero when the whole ladder is showing. */
    hiddenCount: number;
}

/**
 * The badges a ladder shows before it is expanded.
 *
 * A brand has ninety-odd badges and a new user has earned none of them; drawn in full, the
 * grid is a wall of padlocks that is longer than the list it replaced. Condensed, a ladder
 * shows everything the user has earned or started, then only as many locked badges as it
 * takes to finish that row of the grid — the nearest ones first, since those are the ones
 * worth knowing about. The caller leaves the row's last cell for a "+N" that opens the rest,
 * so one slot is always held back when anything is hidden.
 */
export const condenseBadges = (badges: IAchievementBadge[], columns: number): ICondensedBadges => {
    const size = Math.max(1, Math.floor(columns));
    const open = badges.filter((badge) => badge.state !== 'locked');
    const locked = badges.filter((badge) => badge.state === 'locked');

    if (locked.length === 0) {
        return { visible: badges, hiddenCount: 0 };
    }

    // How far each locked badge is past the last rung the user has reached on its ladder.
    const reachedByTrack: { [track: string]: number } = {};
    open.forEach((badge) => {
        reachedByTrack[badge.track] = Math.max(reachedByTrack[badge.track] || 0, badge.level);
    });
    const nearestFirst = locked
        .map((badge, index) => ({ badge, index, distance: badge.level - (reachedByTrack[badge.track] || 0) }))
        .sort((a, b) => (a.distance - b.distance) || (a.index - b.index))
        .map((entry) => entry.badge);

    // Cells left in the row the open badges end on; a full row starts a new one.
    const slots = size - (open.length % size);
    if (locked.length <= slots) {
        return { visible: [...open, ...nearestFirst], hiddenCount: 0 };
    }

    const teasers = nearestFirst.slice(0, slots - 1);
    return { visible: [...open, ...teasers], hiddenCount: locked.length - teasers.length };
};

/** Splits a list into rows of `columns`, for a grid drawn by a virtualized list. */
export const chunkBadges = <T>(items: T[], columns: number): T[][] => {
    const size = Math.max(1, Math.floor(columns));
    const rows: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        rows.push(items.slice(i, i + size));
    }
    return rows;
};

const ROMAN_NUMERALS: [number, string][] = [
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

/** Ladder level as a Roman numeral — every ladder is well under 40 rungs. */
export const toRomanNumeral = (value: number): string => {
    let remaining = Math.max(0, Math.floor(value));
    let numeral = '';
    ROMAN_NUMERALS.forEach(([amount, glyph]) => {
        while (remaining >= amount) {
            numeral += glyph;
            remaining -= amount;
        }
    });
    return numeral;
};

/**
 * An achievement's title and description in the user's language.
 *
 * The dictionaries have carried these under `user.achievements.<id>` for a long time, and
 * nothing read them: every screen took the English strings straight from the shared config,
 * so a Spanish or French user saw translated chrome around English badges. The config's
 * copy is the fallback, for an achievement the dictionary has not caught up with.
 */
export const getAchievementCopy = (
    badge: Pick<IAchievementBadge, 'achievementId' | 'config'>,
    translate: (key: string, params?: any) => string,
): { title: string; description: string } => {
    const lookup = (field: 'title' | 'description') => {
        const key = `user.achievements.${badge.achievementId}.${field}`;
        const translated = translate(key);
        return translated && translated !== key ? translated : badge.config[field];
    };

    return { title: lookup('title'), description: lookup('description') };
};

/**
 * Class name for display. Class ids are camelCase config keys; a class the dictionary has
 * no name for yet is split into words rather than shown raw.
 */
export const getAchievementClassName = (
    achievementClass: string,
    translate: (key: string, params?: any) => string,
): string => {
    const key = `pages.achievements.classes.${achievementClass}`;
    const translated = translate(key);
    if (translated && translated !== key) {
        return translated;
    }
    const spaced = achievementClass.replace(/([A-Z])/g, ' $1').trim();
    return `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;
};
