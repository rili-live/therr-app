// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, beforeEach } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BrandVariations } from 'therr-js-utilities/constants';

import {
    checkCompanionStageUp,
    getOwedStageUp,
    loadSeenStageIndex,
    markStageSeen,
} from '../../main/utilities/companionCelebration';
import { COMPANION_STAGES } from '../../main/utilities/companionGrowth';

/**
 * Stage-up celebration decisions for the habit companion.
 *
 * The rules that matter: nothing is celebrated the first time a device sees a user (that is a
 * baseline, not growth), a jump of several stages is one celebration of where the chameleon is
 * now, and a stage once seen is never celebrated again on this device.
 */

const NOW = Date.parse('2026-11-07T12:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();
const completed = (count: number) => Object.fromEntries(Array.from({ length: count }, (_, i) => [
    `a${i}`,
    { id: `a${i}`, achievementClass: 'habitBuilder', completedAt: daysAgo(1) },
]));
const check = (userId: string, achievementCount: number, ageDays: number) => checkCompanionStageUp({
    userId,
    achievements: completed(achievementCount),
    accountCreatedAt: daysAgo(ageDays),
    brandVariation: BrandVariations.HABITS,
    now: NOW,
});

beforeEach(async () => {
    await AsyncStorage.clear();
});

describe('getOwedStageUp', () => {
    it('owes nothing when this device has never recorded a stage', () => {
        expect(getOwedStageUp(null, 3)).toBeNull();
    });

    it('owes nothing when the stage has not moved up', () => {
        expect(getOwedStageUp(2, 2)).toBeNull();
        expect(getOwedStageUp(3, 1)).toBeNull();
    });

    it('celebrates the stage reached, remembering where it grew from', () => {
        expect(getOwedStageUp(0, 1)).toEqual({
            stageId: 'hatchling', stageIndex: 1, fromStageId: 'egg', fromStageIndex: 0,
        });
        // A multi-stage jump after a long absence is one celebration of the latest stage.
        expect(getOwedStageUp(1, 4)).toMatchObject({ stageId: 'champion', fromStageId: 'hatchling' });
    });
});

describe('checkCompanionStageUp', () => {
    it('records a baseline without celebrating on first sight, then celebrates growth from it', async () => {
        expect(await check('u1', 0, 0)).toBeNull();
        expect(await loadSeenStageIndex('u1')).toBe(0);

        expect(await check('u1', 1, 0)).toMatchObject({ stageId: 'hatchling', fromStageId: 'egg' });
    });

    it('does not congratulate an existing user on growth they never watched', async () => {
        const adult = COMPANION_STAGES.find((s) => s.id === 'adult')!;
        expect(await check('u2', adult.minAchievements, adult.minAccountAgeDays)).toBeNull();
        expect(await loadSeenStageIndex('u2')).toBe(COMPANION_STAGES.indexOf(adult));
    });

    it('stops owing a stage once it is marked seen', async () => {
        await check('u3', 0, 0);
        const owed = await check('u3', 1, 0);
        expect(owed?.stageId).toBe('hatchling');
        await markStageSeen('u3', owed!.stageIndex);
        expect(await check('u3', 1, 0)).toBeNull();
    });

    it('keeps users apart on a shared device', async () => {
        await check('a', 0, 0);
        await markStageSeen('b', 3);
        expect(await loadSeenStageIndex('a')).toBe(0);
        expect(await loadSeenStageIndex('b')).toBe(3);
    });

    it('owes nothing without a user id', async () => {
        expect(await checkCompanionStageUp({
            userId: undefined,
            achievements: completed(5),
            accountCreatedAt: daysAgo(10),
            brandVariation: BrandVariations.HABITS,
            now: NOW,
        })).toBeNull();
    });
});

describe('markStageSeen', () => {
    it('never lowers the recorded stage', async () => {
        await markStageSeen('u4', 3);
        await markStageSeen('u4', 1);
        expect(await loadSeenStageIndex('u4')).toBe(3);
    });
});
