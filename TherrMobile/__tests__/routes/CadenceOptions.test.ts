import {
    cacheKey,
    canEditCadence,
    clampWeeklyCount,
    fromGoal,
    isComplete,
    isSameCadence,
    sanitizeWeekdays,
    toGoalFields,
    toggleWeekday,
    CadenceChoice,
    DEFAULT_WEEKLY_COUNT,
} from '../../main/routes/Pacts/cadenceOptions';

/**
 * The cadence a habit is created with.
 *
 * Two of these cases are regressions against bugs that existed on this branch: the precedence
 * `HabitCard`'s label got wrong, and the goal-cache key that would have reused a goal built on
 * the previous cadence.
 */
describe('cadenceOptions', () => {
    describe('sanitizeWeekdays', () => {
        it('discards junk, de-duplicates and orders', () => {
            expect(sanitizeWeekdays([3, 1, 3, 9, -1, 5])).toEqual([1, 3, 5]);
        });

        it('treats a non-array as no schedule', () => {
            expect(sanitizeWeekdays(null)).toEqual([]);
            expect(sanitizeWeekdays(undefined)).toEqual([]);
            expect(sanitizeWeekdays('mon' as any)).toEqual([]);
        });
    });

    describe('clampWeeklyCount', () => {
        it('keeps a sane count and clamps the rest into 1..7', () => {
            expect(clampWeeklyCount(4)).toEqual(4);
            expect(clampWeeklyCount(0)).toEqual(1);
            expect(clampWeeklyCount(-3)).toEqual(1);
            expect(clampWeeklyCount(99)).toEqual(7);
        });

        it('falls back to the default rather than producing NaN', () => {
            expect(clampWeeklyCount('four')).toEqual(DEFAULT_WEEKLY_COUNT);
            expect(clampWeeklyCount(undefined)).toEqual(DEFAULT_WEEKLY_COUNT);
        });
    });

    describe('fromGoal — the precedence the card label used to get wrong', () => {
        it('lets a weekday schedule win over frequencyType, in both directions', () => {
            // Both of these rendered wrongly before: `custom` fell through to "3x per custom",
            // and `daily` rendered "Every day" while the server scheduled the weekdays.
            expect(fromGoal({ frequencyType: 'custom', targetDaysOfWeek: [1, 3, 5] }))
                .toEqual({ kind: 'weekdays', days: [1, 3, 5] });
            expect(fromGoal({ frequencyType: 'daily', targetDaysOfWeek: [1, 3, 5] }))
                .toEqual({ kind: 'weekdays', days: [1, 3, 5] });
        });

        it('reads a bare count as N per week', () => {
            expect(fromGoal({ frequencyType: 'weekly', frequencyCount: 4 }))
                .toEqual({ kind: 'weeklyCount', count: 4 });
            expect(fromGoal({ frequencyType: 'custom', frequencyCount: 2 }))
                .toEqual({ kind: 'weeklyCount', count: 2 });
        });

        it('defaults to daily, including for a goal that carries no cadence at all', () => {
            expect(fromGoal({ frequencyType: 'daily' })).toEqual({ kind: 'daily' });
            expect(fromGoal({})).toEqual({ kind: 'daily' });
            expect(fromGoal(null)).toEqual({ kind: 'daily' });
        });

        it('ignores an empty or junk weekday array rather than treating it as a schedule', () => {
            expect(fromGoal({ frequencyType: 'daily', targetDaysOfWeek: [] })).toEqual({ kind: 'daily' });
            expect(fromGoal({ frequencyType: 'daily', targetDaysOfWeek: [9, -1] as any }))
                .toEqual({ kind: 'daily' });
        });
    });

    describe('toGoalFields', () => {
        it('clears a weekday schedule with an empty array, never undefined', () => {
            // The bug this prevents is silent. Knex's .update() skips `undefined` keys, so a
            // user switching from Mon/Wed/Fri to "4x per week" would keep the old array — and
            // a populated targetDaysOfWeek outranks frequencyType, so the habit would stay on
            // the old schedule while the app showed the new one.
            expect(toGoalFields({ kind: 'weeklyCount', count: 4 })).toEqual({
                frequencyType: 'weekly',
                frequencyCount: 4,
                targetDaysOfWeek: [],
            });
            expect(toGoalFields({ kind: 'daily' })).toEqual({
                frequencyType: 'daily',
                frequencyCount: 1,
                targetDaysOfWeek: [],
            });
        });

        it('keeps frequencyCount in step with a weekday schedule', () => {
            expect(toGoalFields({ kind: 'weekdays', days: [1, 3, 5] })).toEqual({
                frequencyType: 'weekly',
                frequencyCount: 3,
                targetDaysOfWeek: [1, 3, 5],
            });
        });

        it('sanitizes on the way out as well as on the way in', () => {
            expect(toGoalFields({ kind: 'weekdays', days: [5, 1, 5, 42] as any })).toEqual({
                frequencyType: 'weekly',
                frequencyCount: 2,
                targetDaysOfWeek: [1, 5],
            });
            expect(toGoalFields({ kind: 'weeklyCount', count: 99 }).frequencyCount).toEqual(7);
        });

        it('round-trips through fromGoal', () => {
            const choices: CadenceChoice[] = [
                { kind: 'daily' },
                { kind: 'weeklyCount', count: 4 },
                { kind: 'weekdays', days: [0, 2, 4, 6] },
            ];

            choices.forEach((choice) => {
                expect(fromGoal(toGoalFields(choice))).toEqual(choice);
            });
        });
    });

    describe('isComplete', () => {
        it('refuses a weekday schedule with no days chosen', () => {
            // The server would read an empty schedule as a once-a-week habit rather than
            // refusing it, so the client has to be the one to stop it.
            expect(isComplete({ kind: 'weekdays', days: [] })).toEqual(false);
            expect(isComplete({ kind: 'weekdays', days: [2] })).toEqual(true);
        });

        it('always accepts the two shapes that cannot be incomplete', () => {
            expect(isComplete({ kind: 'daily' })).toEqual(true);
            expect(isComplete({ kind: 'weeklyCount', count: 1 })).toEqual(true);
        });
    });

    describe('toggleWeekday', () => {
        it('adds and removes without disturbing the others', () => {
            const start: CadenceChoice = { kind: 'weekdays', days: [1, 3] };
            expect(toggleWeekday(start, 5)).toEqual({ kind: 'weekdays', days: [1, 3, 5] });
            expect(toggleWeekday(start, 3)).toEqual({ kind: 'weekdays', days: [1] });
        });

        it('converts another shape into a weekday schedule with just that day', () => {
            expect(toggleWeekday({ kind: 'daily' }, 4)).toEqual({ kind: 'weekdays', days: [4] });
            expect(toggleWeekday({ kind: 'weeklyCount', count: 3 }, 0))
                .toEqual({ kind: 'weekdays', days: [0] });
        });
    });

    describe('cacheKey', () => {
        it('differs when only the cadence differs', () => {
            // The wizard caches the goal it created under the step-1 selection so a retry does
            // not create a second goal. Without cadence in that key, changing the cadence and
            // resubmitting would silently reuse the goal built with the old one.
            expect(cacheKey({ kind: 'daily' })).not.toEqual(cacheKey({ kind: 'weeklyCount', count: 7 }));
            expect(cacheKey({ kind: 'weeklyCount', count: 3 }))
                .not.toEqual(cacheKey({ kind: 'weeklyCount', count: 4 }));
            expect(cacheKey({ kind: 'weekdays', days: [1, 3] }))
                .not.toEqual(cacheKey({ kind: 'weekdays', days: [1, 4] }));
        });

        it('is stable across equivalent spellings of the same cadence', () => {
            expect(cacheKey({ kind: 'weekdays', days: [5, 1] }))
                .toEqual(cacheKey({ kind: 'weekdays', days: [1, 5] }));
            expect(isSameCadence({ kind: 'weeklyCount', count: 4 }, { kind: 'weeklyCount', count: 4 }))
                .toEqual(true);
            expect(isSameCadence({ kind: 'daily' }, { kind: 'weeklyCount', count: 7 })).toEqual(false);
        });
    });
});

describe('canEditCadence', () => {
    it('hides the edit from a pact partner tracking a goal someone else created', () => {
        // The server 403s this edit; showing the control only produced a generic error toast.
        expect(canEditCadence({ createdByUserId: 'inviter', isTemplate: false }, 'partner')).toEqual(false);
    });

    it('hides the edit on a template', () => {
        expect(canEditCadence({ createdByUserId: 'me', isTemplate: true }, 'me')).toEqual(false);
    });

    it('offers the edit to the goal\'s creator', () => {
        expect(canEditCadence({ createdByUserId: 'me', isTemplate: false }, 'me')).toEqual(true);
    });

    it('offers nothing before the user or goal has loaded', () => {
        expect(canEditCadence(undefined, 'me')).toEqual(false);
        expect(canEditCadence({ createdByUserId: 'me', isTemplate: false }, undefined)).toEqual(false);
    });
});
