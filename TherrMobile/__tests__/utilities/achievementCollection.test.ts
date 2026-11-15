// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';
import { BrandVariations } from 'therr-js-utilities/constants';
import { achievementClassesByBrand, achievementsByClass } from 'therr-js-utilities/config';

import {
    buildAchievementCollection,
    buildAchievementShowcase,
    chunkBadges,
    condenseBadges,
    getAchievementClassName,
    getAchievementCopy,
    getBadgeTrack,
    getClassLadder,
    toAchievementBadge,
    toRomanNumeral,
} from '../../main/utilities/achievementCollection';
import { formatRewardAmount } from '../../main/utilities/achievements';
import translator from '../../main/utilities/translator';

/**
 * The achievement collection model: the join between the rows the backend returns (only
 * achievements a user has started) and the ladders in the shared config (every achievement
 * there is). The Achievements screen, the profile's badge grid and the badge detail screen
 * all draw from it, so these are the rules all three rely on.
 */
const HABITS = BrandVariations.HABITS;

let nextId = 1;
const row = (achievementClass: string, achievementId: string, overrides: any = {}) => {
    nextId += 1;
    return {
        id: `ua-${nextId}`,
        achievementClass,
        achievementId,
        progressCount: 0,
        completedAt: null,
        unclaimedRewardPts: 0,
        ...overrides,
    };
};
const done = (daysAgo = 1) => ({ completedAt: new Date(Date.UTC(2026, 10, 15) - daysAgo * 86400000).toISOString() });
const keysOf = (badges: { key: string }[]) => badges.map((badge) => badge.key);

describe('getClassLadder', () => {
    it('numbers each ladder of a class separately, in climbing order', () => {
        const ladder = getClassLadder('accountability');

        expect(ladder.map((entry) => [entry.achievementId, entry.track, entry.level, entry.trackLength])).toEqual([
            ['accountability_1_1', '1_1', 1, 4],
            ['accountability_1_1_1', '1_1', 2, 4],
            ['accountability_1_1_2', '1_1', 3, 4],
            ['accountability_1_1_3', '1_1', 4, 4],
            ['accountability_1_2', '1_2', 1, 3],
            ['accountability_1_2_1', '1_2', 2, 3],
            ['accountability_1_2_2', '1_2', 3, 3],
        ]);
    });

    it('marks only the top rung of a multi-rung ladder as its capstone', () => {
        const capstones = getClassLadder('dailyStreak').filter((entry) => entry.isCapstone).map((entry) => entry.achievementId);

        // The one-rung ladders (perfect month, right back at it, saved by a freeze) have no capstone.
        expect(capstones).toEqual(['dailyStreak_1_1_8', 'dailyStreak_1_2_1']);
    });

    it('returns nothing for a class this build has no config for', () => {
        expect(getClassLadder('notAClass')).toEqual([]);
    });
});

describe('toAchievementBadge', () => {
    it('reads state from the row', () => {
        expect(toAchievementBadge(row('habitBuilder', 'habitBuilder_1_1', { progressCount: 2 }))?.state).toBe('inProgress');
        expect(toAchievementBadge(row('habitBuilder', 'habitBuilder_1_1', done()))?.state).toBe('earned');
        expect(toAchievementBadge(row('habitBuilder', 'habitBuilder_1_1', { ...done(), unclaimedRewardPts: '0.25' }))?.state)
            .toBe('claimable');
    });

    it('clamps an over-counted row so it never reads past its target', () => {
        const badge = toAchievementBadge(row('habitBuilder', 'habitBuilder_1_1', { progressCount: 34 }))!;

        expect(badge.progressCount).toBe(3);
        expect(badge.progressRatio).toBe(1);
    });

    it('reports an earned badge as complete whatever its counter says', () => {
        const badge = toAchievementBadge(row('habitBuilder', 'habitBuilder_1_1_3', { ...done(), progressCount: 0 }))!;

        expect(badge.progressCount).toBe(30);
        expect(badge.progressRatio).toBe(1);
    });

    it('returns null for a row the installed config does not know', () => {
        // The backend can award an achievement that a not-yet-updated app has no config for.
        expect(toAchievementBadge(row('habitBuilder', 'habitBuilder_9_9'))).toBeNull();
        expect(toAchievementBadge(row('notAClass', 'notAClass_1_1'))).toBeNull();
        expect(toAchievementBadge(undefined)).toBeNull();
    });
});

describe('buildAchievementCollection', () => {
    it('lists every badge the brand can earn, locked ones included, for a user with no rows', () => {
        const collection = buildAchievementCollection({ userAchievements: {}, brandVariation: HABITS });
        const expectedTotal = Array.from(achievementClassesByBrand[HABITS])
            .reduce((sum, name) => sum + Object.keys(achievementsByClass[name]).length, 0);

        expect(collection.totalCount).toBe(expectedTotal);
        expect(collection.earnedCount).toBe(0);
        expect(collection.claimable).toEqual([]);
        expect(collection.inProgress).toEqual([]);
        expect(collection.classes.every((group) => group.badges.every((badge) => badge.state === 'locked'))).toBe(true);
    });

    it('covers each of the brand\'s classes once, the daily habit ladders first', () => {
        const collection = buildAchievementCollection({ userAchievements: {}, brandVariation: HABITS });
        const names = collection.classes.map((group) => group.achievementClass);

        expect([...names].sort()).toEqual(Array.from(achievementClassesByBrand[HABITS]).sort());
        expect(names.slice(0, 2)).toEqual(['dailyStreak', 'habitBuilder']);
    });

    it('offers no classes for a brand with no achievements', () => {
        expect(buildAchievementCollection({ userAchievements: {}, brandVariation: 'notABrand' }).classes).toEqual([]);
        expect(buildAchievementCollection({ userAchievements: {}, brandVariation: undefined }).totalCount).toBe(0);
    });

    it('places each row on its ladder and counts what has been earned', () => {
        const collection = buildAchievementCollection({
            brandVariation: HABITS,
            userAchievements: [
                row('habitBuilder', 'habitBuilder_1_1', done(9)),
                row('habitBuilder', 'habitBuilder_1_1_1', { ...done(2), unclaimedRewardPts: 0.5 }),
                row('habitBuilder', 'habitBuilder_1_1_2', { progressCount: 9 }),
            ],
        });
        const habitBuilder = collection.classes.find((group) => group.achievementClass === 'habitBuilder')!;

        expect(habitBuilder.badges.slice(0, 4).map((badge) => badge.state)).toEqual(['earned', 'claimable', 'inProgress', 'locked']);
        // A reward still waiting does not make the badge any less earned.
        expect(habitBuilder.earnedCount).toBe(2);
        expect(collection.earnedCount).toBe(2);
        expect(keysOf(collection.claimable)).toEqual(['habitBuilder:habitBuilder_1_1_1']);
    });

    it('accepts the store\'s id-keyed map as well as a list', () => {
        const rows = [row('habitBuilder', 'habitBuilder_1_1', done())];
        const asMap = Object.fromEntries(rows.map((item) => [item.id, item]));

        expect(buildAchievementCollection({ userAchievements: asMap, brandVariation: HABITS }).earnedCount).toBe(1);
        expect(buildAchievementCollection({ userAchievements: null, brandVariation: HABITS }).earnedCount).toBe(0);
    });

    it('orders what is in progress by how close it is to done', () => {
        const collection = buildAchievementCollection({
            brandVariation: HABITS,
            userAchievements: [
                row('socialite', 'socialite_1_1_3', { progressCount: 1 }), // 1 of 50
                row('habitBuilder', 'habitBuilder_1_1_3', { progressCount: 24 }), // 24 of 30
                row('accountability', 'accountability_1_1', { progressCount: 0 }), // 0 of 1
                row('socialite', 'socialite_1_1', { progressCount: 2 }), // 2 of 3
            ],
        });

        expect(keysOf(collection.inProgress)).toEqual([
            'habitBuilder:habitBuilder_1_1_3',
            'socialite:socialite_1_1',
            'socialite:socialite_1_1_3',
            'accountability:accountability_1_1',
        ]);
    });

    it('keeps the further-along row when the store holds two for one achievement', () => {
        const collection = buildAchievementCollection({
            brandVariation: HABITS,
            userAchievements: [
                row('habitBuilder', 'habitBuilder_1_1', { progressCount: 1 }),
                row('habitBuilder', 'habitBuilder_1_1', done()),
                row('habitBuilder', 'habitBuilder_1_1_1', { progressCount: 5 }),
                row('habitBuilder', 'habitBuilder_1_1_1', { progressCount: 2 }),
            ],
        });
        const [first, second] = collection.classes.find((group) => group.achievementClass === 'habitBuilder')!.badges;

        expect(first.state).toBe('earned');
        expect(second.progressCount).toBe(5);
    });

    it('still surfaces a reward owed on a class the brand no longer lists', () => {
        const collection = buildAchievementCollection({
            brandVariation: HABITS,
            userAchievements: [row('explorer', Object.keys(achievementsByClass.explorer)[0], { ...done(), unclaimedRewardPts: 1 })],
        });

        expect(collection.claimable).toHaveLength(1);
        // …without adding a Therr ladder to the Habits collection.
        expect(collection.classes.some((group) => group.achievementClass === 'explorer')).toBe(false);
    });

    it('skips a row the config does not know instead of throwing', () => {
        const build = () => buildAchievementCollection({
            brandVariation: HABITS,
            userAchievements: [row('habitBuilder', 'habitBuilder_9_9', done()), { id: 'broken' }, null],
        });

        expect(build).not.toThrow();
        expect(build().earnedCount).toBe(0);
    });
});

describe('condenseBadges', () => {
    const ladderWith = (states: { [achievementId: string]: any }) => buildAchievementCollection({
        brandVariation: HABITS,
        userAchievements: Object.entries(states).map(([achievementId, overrides]) => row('habitBuilder', achievementId, overrides)),
    }).classes.find((group) => group.achievementClass === 'habitBuilder')!.badges;

    it('shows everything when nothing is locked', () => {
        const badges = getBadgeTrack({ achievementClass: 'resilience', track: '1_2' }, [
            row('resilience', 'resilience_1_2', done()),
            row('resilience', 'resilience_1_2_1', { progressCount: 1 }),
        ]);

        expect(condenseBadges(badges, 3)).toEqual({ visible: badges, hiddenCount: 0 });
    });

    it('fills the row the open badges end on with the nearest locked ones, holding one cell back', () => {
        // Four open badges: one full row of three, then one — two cells left, the last of them for "+N".
        const badges = ladderWith({
            habitBuilder_1_1: done(),
            habitBuilder_1_1_1: done(),
            habitBuilder_1_1_2: done(),
            habitBuilder_1_1_3: { progressCount: 24 },
        });
        const { visible, hiddenCount } = condenseBadges(badges, 3);

        expect(visible.map((badge) => badge.achievementId)).toEqual([
            'habitBuilder_1_1', 'habitBuilder_1_1_1', 'habitBuilder_1_1_2', 'habitBuilder_1_1_3', 'habitBuilder_1_1_4',
        ]);
        expect(hiddenCount).toBe(3);
        // What is shown plus the "+N" cell is a whole number of rows.
        expect((visible.length + 1) % 3).toBe(0);
    });

    it('shows a first row of teasers for a ladder the user has not started', () => {
        const { visible, hiddenCount } = condenseBadges(ladderWith({}), 3);

        expect(visible.map((badge) => badge.achievementId)).toEqual(['habitBuilder_1_1', 'habitBuilder_1_1_1']);
        expect(hiddenCount).toBe(6);
    });

    it('shows the locked badges themselves when they all fit in the row', () => {
        const badges = getBadgeTrack({ achievementClass: 'resilience', track: '1_1' }, [row('resilience', 'resilience_1_1', done())]);
        const { visible, hiddenCount } = condenseBadges(badges, 3);

        expect(visible).toHaveLength(3);
        expect(hiddenCount).toBe(0);
    });

    it('teases the next rung of every ladder before the far end of one', () => {
        const badges = buildAchievementCollection({
            brandVariation: HABITS,
            userAchievements: [row('dailyStreak', 'dailyStreak_1_1', done())],
        }).classes.find((group) => group.achievementClass === 'dailyStreak')!.badges;
        const { visible } = condenseBadges(badges, 4);

        // One open badge and room for two teasers: the next streak rung and the first of another ladder.
        expect(visible.map((badge) => badge.achievementId)).toEqual(['dailyStreak_1_1', 'dailyStreak_1_1_1', 'dailyStreak_1_2']);
    });
});

describe('buildAchievementShowcase', () => {
    it('shows earned badges newest first, then what is in progress, and nothing locked', () => {
        const showcase = buildAchievementShowcase([
            row('habitBuilder', 'habitBuilder_1_1', done(30)),
            row('accountability', 'accountability_1_1', done(2)),
            row('habitBuilder', 'habitBuilder_1_1_1', { ...done(10), unclaimedRewardPts: 1 }),
            row('habitBuilder', 'habitBuilder_1_1_2', { progressCount: 3 }),
            row('socialite', 'socialite_1_1', { progressCount: 2 }),
        ]);

        expect(keysOf(showcase.earned)).toEqual([
            'accountability:accountability_1_1',
            'habitBuilder:habitBuilder_1_1_1',
            'habitBuilder:habitBuilder_1_1',
        ]);
        expect(keysOf(showcase.inProgress)).toEqual(['socialite:socialite_1_1', 'habitBuilder:habitBuilder_1_1_2']);
    });

    it('is empty for a user with nothing', () => {
        expect(buildAchievementShowcase(undefined)).toEqual({ earned: [], inProgress: [] });
    });
});

describe('getBadgeTrack', () => {
    it('returns the one ladder the badge is on, with the user\'s standing on each rung', () => {
        const track = getBadgeTrack({ achievementClass: 'accountability', track: '1_2' }, [
            row('accountability', 'accountability_1_2', done()),
            row('accountability', 'accountability_1_1', done()),
        ]);

        expect(track.map((badge) => [badge.achievementId, badge.state])).toEqual([
            ['accountability_1_2', 'earned'],
            ['accountability_1_2_1', 'locked'],
            ['accountability_1_2_2', 'locked'],
        ]);
    });
});

describe('helpers', () => {
    it('chunks into rows', () => {
        expect(chunkBadges([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
        expect(chunkBadges([], 3)).toEqual([]);
        // A nonsense column count degrades to one per row rather than looping forever.
        expect(chunkBadges([1, 2], 0)).toEqual([[1], [2]]);
    });

    it('writes ladder levels as Roman numerals', () => {
        expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14].map(toRomanNumeral)).toEqual([
            'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XIV',
        ]);
    });

    it('formats reward amounts without trailing zeros, and as nothing when there is no reward', () => {
        expect(formatRewardAmount('2.00')).toBe('2');
        expect(formatRewardAmount(0.5)).toBe('0.5');
        expect(formatRewardAmount('0.25')).toBe('0.25');
        expect(formatRewardAmount(0)).toBe('');
        expect(formatRewardAmount(undefined)).toBe('');
        expect(formatRewardAmount('not a number')).toBe('');
    });

    it.each(['en-us', 'es', 'fr-ca'])('names every Habits class in %s', (locale) => {
        const translate = (key: string, params?: any) => translator(locale, key, params);

        Array.from(achievementClassesByBrand[HABITS]).forEach((achievementClass) => {
            const name = getAchievementClassName(achievementClass, translate);

            expect(name).not.toContain('pages.achievements');
            expect(name.length).toBeGreaterThan(0);
        });
    });

    it('splits a class id into words when the dictionary has no name for it', () => {
        expect(getAchievementClassName('localPatron', (key) => key)).toBe('Local Patron');
    });
});

describe('a badge opened without a backend row', () => {
    it('is locked, not "started with nothing done"', () => {
        // How the grid opens a locked badge: class and id, no row behind them.
        const badge = toAchievementBadge({ achievementClass: 'dailyStreak', achievementId: 'dailyStreak_1_1_5' })!;

        expect(badge.state).toBe('locked');
        expect(badge.userAchievement).toBeUndefined();
    });
});

describe('getAchievementCopy', () => {
    const translateIn = (locale: string) => (key: string, params?: any) => translator(locale, key, params);
    const habitsBadges = buildAchievementCollection({ userAchievements: {}, brandVariation: HABITS })
        .classes.flatMap((group) => group.badges);

    it.each(['en-us', 'es', 'fr-ca'])('has a title and description in %s for every badge the Habits brand can earn', (locale) => {
        const translate = translateIn(locale);

        habitsBadges.forEach((badge) => {
            // Read straight from the dictionary: the helper's fallback would hide a gap.
            const titleKey = `user.achievements.${badge.achievementId}.title`;
            const descriptionKey = `user.achievements.${badge.achievementId}.description`;

            expect({ id: badge.achievementId, hasTitle: translate(titleKey) !== titleKey })
                .toEqual({ id: badge.achievementId, hasTitle: true });
            expect({ id: badge.achievementId, hasDescription: translate(descriptionKey) !== descriptionKey })
                .toEqual({ id: badge.achievementId, hasDescription: true });
        });
    });

    it('gives the badge in the user\'s language, not the config\'s English', () => {
        const badge = toAchievementBadge(row('habitBuilder', 'habitBuilder_1_1_3'))!;

        expect(getAchievementCopy(badge, translateIn('en-us'))).toEqual({
            title: 'Habit Formed',
            description: 'Reach a 30-day streak on a habit',
        });
        expect(getAchievementCopy(badge, translateIn('es')).title).toBe('Hábito formado');
        expect(getAchievementCopy(badge, translateIn('fr-ca')).title).not.toBe('Habit Formed');
    });

    it('keeps the number in every translated milestone description', () => {
        // A streak badge whose translation dropped or mistyped its target would be a lie.
        ['es', 'fr-ca'].forEach((locale) => {
            const translate = translateIn(locale);

            habitsBadges.forEach((badge) => {
                const numbersIn = (text: string) => (text.match(/\d+/g) || []).join(',');
                const english = getAchievementCopy(badge, translateIn('en-us')).description;

                expect({ id: badge.achievementId, numbers: numbersIn(getAchievementCopy(badge, translate).description) })
                    .toEqual({ id: badge.achievementId, numbers: numbersIn(english) });
            });
        });
    });

    it('falls back to the config for an achievement the dictionary has not caught up with', () => {
        const badge = toAchievementBadge(row('habitBuilder', 'habitBuilder_1_1'))!;

        expect(getAchievementCopy(badge, (key) => key)).toEqual({
            title: badge.config.title,
            description: badge.config.description,
        });
    });
});
