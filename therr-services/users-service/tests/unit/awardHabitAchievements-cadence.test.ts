import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import { scanMultiHabitConsistency } from '../../src/handlers/helpers/awardHabitAchievements';

/**
 * `consistency_1_2` — Two At Once / Triple Threat / All Things at Once — is the achievement for
 * keeping several habits going simultaneously.
 *
 * It used to require 7 completions in the trailing 7-day window per habit, which a habit on any
 * cadence below daily can never reach. So a user tracking three habits at "4x per week" and
 * keeping every one of them was permanently ineligible for the achievement about exactly that.
 * A habit is now judged against what its own cadence asked for over the window.
 */

const HEADERS = { 'x-userid': 'user-1', 'x-brand-variation': 'habits' } as any;
const USER_ID = 'user-1';
// A Sunday, so the trailing 7-day window is one whole Monday–Sunday week.
const AS_OF = '2026-09-20';

describe('scanMultiHabitConsistency — cadence', () => {
    let achievementCalls: any[];

    beforeEach(() => {
        achievementCalls = [];
        sinon.stub(Store.userAchievements, 'get').resolves([] as any);
        sinon.stub(Store.userAchievements, 'updateAndCreateConsecutive').callsFake((...args: any[]) => {
            achievementCalls.push(args);
            // The real shape: downstream reduces over both lists to value the XP award.
            return Promise.resolve({ created: [], updated: [] } as any);
        });
    });

    afterEach(() => sinon.restore());

    /** Two habits on the given cadence, each with `completions` completed days in the window. */
    const stubHabits = (goal: Record<string, any>, completions: number) => {
        sinon.stub(Store.habitGoals, 'getByUserId').resolves([
            { id: 'goal-1', ...goal },
            { id: 'goal-2', ...goal },
        ] as any);
        sinon.stub(Store.habitCheckins, 'getCompletedCountForPeriod').resolves(completions as any);
    };

    it('credits two habits kept perfectly on a 4x/week cadence', async () => {
        // Four of four, twice. Under the old fixed threshold of 7 this counted as zero perfect
        // habits and awarded nothing.
        stubHabits({ frequencyType: 'weekly', frequencyCount: 4 }, 4);

        await scanMultiHabitConsistency(HEADERS, USER_ID, AS_OF);

        expect(achievementCalls.length).to.be.greaterThan(0);
    });

    it('does not credit a 4x/week habit that fell short of its own target', async () => {
        stubHabits({ frequencyType: 'weekly', frequencyCount: 4 }, 3);

        await scanMultiHabitConsistency(HEADERS, USER_ID, AS_OF);

        expect(achievementCalls.length).to.equal(0);
    });

    it('still requires all seven days of a daily habit', async () => {
        // The regression that matters: a daily habit's bar is unchanged.
        stubHabits({ frequencyType: 'daily' }, 6);

        await scanMultiHabitConsistency(HEADERS, USER_ID, AS_OF);

        expect(achievementCalls.length).to.equal(0);
    });

    it('credits a daily habit that covered every day', async () => {
        stubHabits({ frequencyType: 'daily' }, 7);

        await scanMultiHabitConsistency(HEADERS, USER_ID, AS_OF);

        expect(achievementCalls.length).to.be.greaterThan(0);
    });

    it('holds a fixed weekday schedule to its scheduled days only', async () => {
        // Mon/Wed/Fri is three days in the window, not seven.
        stubHabits({ frequencyType: 'custom', targetDaysOfWeek: [1, 3, 5] }, 3);

        await scanMultiHabitConsistency(HEADERS, USER_ID, AS_OF);

        expect(achievementCalls.length).to.be.greaterThan(0);
    });

    it('awards nothing when the user tracks fewer than two habits', async () => {
        sinon.stub(Store.habitGoals, 'getByUserId').resolves([{ id: 'goal-1', frequencyType: 'daily' }] as any);

        await scanMultiHabitConsistency(HEADERS, USER_ID, AS_OF);

        expect(achievementCalls.length).to.equal(0);
    });
});
