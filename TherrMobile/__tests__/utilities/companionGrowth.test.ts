// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { BrandVariations } from 'therr-js-utilities/constants';

import {
    COMPANION_STAGES,
    countCompletedAchievements,
    getAccountAgeDays,
    getCompanionGrowth,
} from '../../main/utilities/companionGrowth';
import {
    BRANCH_ROWS,
    buildSpritePaths,
    COMPANION_SKIN_COUNT,
    COMPANION_SPRITES,
    getCompanionPalette,
    getCompanionSkins,
    getCreatureRows,
    SPRITE_SIZE,
} from '../../main/components/HabitCompanion/sprites';
import { getTheme } from '../../main/styles/themes';

/**
 * Habit companion (growing pixel chameleon) tests.
 *
 * The stage is derived on every render from completed achievements + account age, so the
 * ladder can be re-tuned without a migration — these tests pin the rules that must hold
 * whatever the numbers become: stages climb in order, BOTH gates are required, the egg
 * hatches on the first win with no age floor, and another brand's achievements never count.
 */

const NOW = Date.parse('2026-11-07T12:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

const completed = (count: number, achievementClass = 'habitBuilder') => Array.from({ length: count })
    .reduce((acc: { [key: string]: any }, _, i) => {
        acc[`a${i}`] = { id: `a${i}`, achievementClass, completedAt: daysAgo(1) };
        return acc;
    }, {}) as { [key: string]: any };

const growthFor = (achievementCount: number, ageDays: number) => getCompanionGrowth({
    achievements: completed(achievementCount),
    accountCreatedAt: daysAgo(ageDays),
    brandVariation: BrandVariations.HABITS,
    now: NOW,
});

describe('companion stage ladder', () => {
    it('keeps both thresholds non-decreasing so stages can only be climbed in order', () => {
        for (let i = 1; i < COMPANION_STAGES.length; i += 1) {
            expect(COMPANION_STAGES[i].minAchievements).toBeGreaterThanOrEqual(COMPANION_STAGES[i - 1].minAchievements);
            expect(COMPANION_STAGES[i].minAccountAgeDays).toBeGreaterThanOrEqual(COMPANION_STAGES[i - 1].minAccountAgeDays);
        }
        expect(COMPANION_STAGES[0]).toMatchObject({ id: 'egg', minAchievements: 0, minAccountAgeDays: 0 });
    });

    it('has a sprite and a name/caption in every locale for every stage', () => {
        const locales = ['en-us', 'es', 'fr-ca'];
        locales.forEach((locale) => {
            const dictionary = JSON.parse(fs.readFileSync(
                path.join(__dirname, '..', '..', 'main', 'locales', locale, 'dictionary.json'),
                'utf8',
            ));
            COMPANION_STAGES.forEach(({ id }) => {
                expect(COMPANION_SPRITES[id]).toBeDefined();
                expect(dictionary.components.habitCompanion.stages[id].name).toEqual(expect.any(String));
                expect(dictionary.components.habitCompanion.stages[id].caption).toEqual(expect.any(String));
            });
        });
    });
});

describe('getCompanionGrowth', () => {
    it('starts a brand-new account as an egg', () => {
        const growth = growthFor(0, 0);
        expect(growth.stage.id).toBe('egg');
        expect(growth.stageIndex).toBe(0);
        expect(growth.nextStage?.id).toBe('hatchling');
        expect(growth.progressToNext).toBe(0);
    });

    it('hatches on the first completed achievement with no account-age floor', () => {
        expect(growthFor(1, 0).stage.id).toBe('hatchling');
    });

    it('does not grow on account age alone', () => {
        expect(growthFor(0, 365).stage.id).toBe('egg');
    });

    it('requires BOTH the achievement count and the account age for later stages', () => {
        // Plenty of achievements, but a 2-day-old account: held at hatchling.
        const rushed = growthFor(50, 2);
        expect(rushed.stage.id).toBe('hatchling');
        expect(rushed.nextAchievements?.isMet).toBe(true);
        expect(rushed.nextAccountAge?.isMet).toBe(false);

        // Old account, too few achievements: also held.
        expect(growthFor(3, 365).stage.id).toBe('hatchling');
    });

    it('reaches each stage exactly at its thresholds', () => {
        COMPANION_STAGES.forEach((stage, index) => {
            const growth = growthFor(stage.minAchievements, stage.minAccountAgeDays);
            expect(growth.stage.id).toBe(stage.id);
            expect(growth.stageIndex).toBe(index);
        });
    });

    it('reports progress as the slower of the two requirements', () => {
        const juvenile = COMPANION_STAGES.find((s) => s.id === 'juvenile')!;
        const adult = COMPANION_STAGES.find((s) => s.id === 'adult')!;
        // All the achievements for adult, but only halfway through the age window.
        const halfwayAge = juvenile.minAccountAgeDays + Math.floor((adult.minAccountAgeDays - juvenile.minAccountAgeDays) / 2);
        const growth = growthFor(adult.minAchievements, halfwayAge);
        expect(growth.stage.id).toBe('juvenile');
        const expected = (halfwayAge - juvenile.minAccountAgeDays) / (adult.minAccountAgeDays - juvenile.minAccountAgeDays);
        expect(growth.progressToNext).toBeCloseTo(expected);
    });

    it('marks the final stage as fully grown', () => {
        const final = COMPANION_STAGES[COMPANION_STAGES.length - 1];
        const growth = growthFor(final.minAchievements + 100, final.minAccountAgeDays + 100);
        expect(growth.stage.id).toBe(final.id);
        expect(growth.nextStage).toBeNull();
        expect(growth.nextAchievements).toBeUndefined();
        expect(growth.progressToNext).toBe(1);
    });

    it('tolerates missing achievements and account details (user not loaded yet)', () => {
        const growth = getCompanionGrowth({
            achievements: undefined,
            accountCreatedAt: undefined,
            brandVariation: BrandVariations.HABITS,
            now: NOW,
        });
        expect(growth.stage.id).toBe('egg');
        expect(growth.accountAgeDays).toBe(0);
    });
});

describe('countCompletedAchievements', () => {
    it('counts only completed achievements', () => {
        const achievements = {
            ...completed(2),
            pending: { id: 'pending', achievementClass: 'habitBuilder', completedAt: null },
        };
        expect(countCompletedAchievements(achievements, BrandVariations.HABITS)).toBe(2);
    });

    it("ignores classes the brand cannot earn (e.g. a cached Therr 'explorer' row)", () => {
        const achievements = {
            ...completed(1, 'habitBuilder'),
            ...Object.fromEntries(Object.entries(completed(3, 'explorer')).map(([k, v]) => [`x${k}`, v])),
        };
        expect(countCompletedAchievements(achievements, BrandVariations.HABITS)).toBe(1);
    });
});

describe('getAccountAgeDays', () => {
    it('counts whole days and never goes negative', () => {
        expect(getAccountAgeDays(daysAgo(10), NOW)).toBe(10);
        expect(getAccountAgeDays(new Date(NOW + 60_000).toISOString(), NOW)).toBe(0);
    });

    it('treats an unknown or unparseable date as a new account', () => {
        expect(getAccountAgeDays(null, NOW)).toBe(0);
        expect(getAccountAgeDays('not a date', NOW)).toBe(0);
    });
});

describe('companion sprites', () => {
    const { colors } = getTheme();
    const palette = getCompanionPalette(colors);

    it(`are all ${SPRITE_SIZE}x${SPRITE_SIZE} and use only palette keys`, () => {
        Object.entries(COMPANION_SPRITES).forEach(([id, rows]) => {
            expect({ id, height: rows.length }).toEqual({ id, height: SPRITE_SIZE });
            rows.forEach((row, y) => {
                expect({ id, y, width: row.length }).toEqual({ id, y, width: SPRITE_SIZE });
                [...row].forEach((ch) => {
                    expect({ id, ch, known: ch === '.' || !!palette[ch] }).toEqual({ id, ch, known: true });
                });
            });
        });
    });

    it('splits the branch out of the creature layer so only the chameleon animates', () => {
        Object.values(COMPANION_SPRITES).forEach((rows) => {
            getCreatureRows(rows).forEach((row) => expect(row).not.toMatch(/[Bb]/));
        });
        expect(BRANCH_ROWS).toHaveLength(SPRITE_SIZE);
    });

    it('walks the same brand → teal → lime → gold skins as the daily-bonus chameleon', () => {
        expect(getCompanionSkins(colors)).toEqual([colors.brand, colors.accentTeal, colors.accentLime, colors.accent]);
        expect(COMPANION_SKIN_COUNT).toBe(getCompanionSkins(colors).length);
        getCompanionSkins(colors).forEach((skin, index) => {
            expect(getCompanionPalette(colors, index).G).toBe(skin);
        });
        // Wraps rather than reading past the end.
        expect(getCompanionPalette(colors, COMPANION_SKIN_COUNT).G).toBe(colors.brand);
    });

    it('lightens the gold stripe once the skin itself turns gold', () => {
        expect(getCompanionPalette(colors, 0).Y).toBe(colors.accent);
        expect(getCompanionPalette(colors, 3).Y).not.toBe(colors.accent);
    });

    it('merges pixels into one path per color, one rectangle per horizontal run', () => {
        const paths = buildSpritePaths(['GGK', 'K.G'], palette);
        expect(paths).toEqual([
            { color: palette.G, d: 'M0 0h2v1h-2zM2 1h1v1h-1z' },
            { color: palette.K, d: 'M2 0h1v1h-1zM0 1h1v1h-1z' },
        ]);
    });
});
