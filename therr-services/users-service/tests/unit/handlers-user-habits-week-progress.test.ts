import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import { getUserHabits } from '../../src/handlers/userHabits';

/**
 * `weekProgress` on the habits list — the number the mobile card renders as "2 of 4 this week".
 *
 * It is derived here rather than on the client on purpose. Deciding what a cadence asks for on
 * a given day is a rule `utilities/habitCadence.ts` owns outright; a client that recomputed it
 * would be the second implementation, which is the exact failure that module exists to delete.
 *
 * The clock is pinned because every assertion depends on which weekday "today" is and on how
 * much of the Monday–Sunday week has elapsed.
 */

// A Thursday. Monday of this week is 2026-09-14, so three days have already closed.
const RUN_AT = new Date('2026-09-17T14:00:00.000Z');

const runHandler = async (query: Record<string, any> = {}) => {
    let body: any;
    const res: any = {
        status: () => ({ send: (payload: any) => { body = payload; return payload; } }),
    };
    await getUserHabits({ headers: { 'x-userid': 'user-1' }, query } as any, res, (() => undefined) as any);
    return body;
};

const stubHabit = (overrides: Record<string, any>) => [{
    id: 'uh-1',
    userId: 'user-1',
    habitGoalId: 'goal-1',
    status: 'active',
    goalName: 'Morning run',
    frequencyType: 'daily',
    frequencyCount: 1,
    targetDaysOfWeek: null,
    cadenceEffectiveFrom: null,
    completionsEarlierThisWeek: 0,
    ...overrides,
}];

describe('getUserHabits — weekProgress', () => {
    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
        clock = sinon.useFakeTimers({ now: RUN_AT.getTime(), toFake: ['Date'] });
        sinon.stub(Store.users, 'getUserById').resolves([{ id: 'user-1', settingsTimezone: 'UTC' }] as any);
    });

    afterEach(() => {
        clock.restore();
        sinon.restore();
    });

    it('reports a 4x/week habit two days in as still owing two', async () => {
        sinon.stub(Store.userHabits, 'getDetailByUser').resolves(stubHabit({
            frequencyType: 'weekly',
            frequencyCount: 4,
            completionsEarlierThisWeek: 2,
        }) as any);

        const body = await runHandler();

        expect(body.userHabits[0].weekProgress).to.deep.equal({
            done: 2,
            target: 4,
            // Thursday through Sunday, inclusive of today.
            daysLeft: 4,
            // 4 days left against 2 owed — still free to skip today.
            isRequiredToday: false,
            isMet: false,
        });
    });

    it('marks the day required once skipping it would put the target out of reach', async () => {
        sinon.stub(Store.userHabits, 'getDetailByUser').resolves(stubHabit({
            frequencyType: 'weekly',
            frequencyCount: 4,
            completionsEarlierThisWeek: 0,
        }) as any);

        const body = await runHandler();

        // Thursday: 4 days remain and 4 are owed, so every one of them is now required.
        expect(body.userHabits[0].weekProgress.isRequiredToday).to.equal(true);
    });

    it('reports a daily habit as target 7, unchanged for existing users', async () => {
        sinon.stub(Store.userHabits, 'getDetailByUser').resolves(stubHabit({
            completionsEarlierThisWeek: 3,
        }) as any);

        const body = await runHandler();

        expect(body.userHabits[0].weekProgress.target).to.equal(7);
        expect(body.userHabits[0].weekProgress.isRequiredToday).to.equal(true);
    });

    it('follows a fixed weekday schedule rather than a count', async () => {
        sinon.stub(Store.userHabits, 'getDetailByUser').resolves(stubHabit({
            // Mon/Wed/Fri. Today is Thursday, so nothing is owed today.
            frequencyType: 'custom',
            targetDaysOfWeek: [1, 3, 5],
            completionsEarlierThisWeek: 2,
        }) as any);

        const body = await runHandler();

        expect(body.userHabits[0].weekProgress.target).to.equal(3);
        expect(body.userHabits[0].weekProgress.isRequiredToday).to.equal(false);
    });

    it('omits weekProgress entirely when the tally is unknown', async () => {
        // A NULL tally means no resolvable week. Reporting "0 of 4" to someone who trained
        // four times is worse than reporting nothing, so the field is dropped and the client
        // reads its absence as "hide the indicator".
        sinon.stub(Store.userHabits, 'getDetailByUser').resolves(stubHabit({
            frequencyType: 'weekly',
            frequencyCount: 4,
            completionsEarlierThisWeek: null,
        }) as any);

        const body = await runHandler();

        expect(body.userHabits[0]).to.not.have.property('weekProgress');
        expect(body.userHabits[0].goalName).to.equal('Morning run');
    });

    it('asks the store for the user\'s own Monday, not the server\'s', async () => {
        const stub = sinon.stub(Store.userHabits, 'getDetailByUser').resolves([] as any);

        await runHandler({ status: 'active' });

        expect(stub.firstCall.args[2]).to.deep.equal({
            weekStart: '2026-09-14',
            today: '2026-09-17',
        });
    });

    it('honours the device zone the client reports when the account has none saved', async () => {
        (Store.users.getUserById as any).restore();
        sinon.stub(Store.users, 'getUserById').resolves([{ id: 'user-1', settingsTimezone: null }] as any);
        const stub = sinon.stub(Store.userHabits, 'getDetailByUser').resolves([] as any);

        // 14:00 UTC on Thursday is already Friday in Kiritimati (UTC+14).
        await runHandler({ timeZone: 'Pacific/Kiritimati' });

        expect(stub.firstCall.args[2]).to.deep.equal({
            weekStart: '2026-09-14',
            today: '2026-09-18',
        });
    });

    it('still returns the habits list when the user read fails', async () => {
        (Store.users.getUserById as any).restore();
        sinon.stub(Store.users, 'getUserById').rejects(new Error('db down'));
        sinon.stub(Store.userHabits, 'getDetailByUser').resolves(stubHabit({
            completionsEarlierThisWeek: 1,
        }) as any);

        const body = await runHandler();

        // Fails soft to the service fallback zone rather than failing the request.
        expect(body.userHabits).to.have.length(1);
    });
});
