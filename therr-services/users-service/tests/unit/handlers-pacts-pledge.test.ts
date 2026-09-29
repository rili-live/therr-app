import { expect } from 'chai';
import sinon from 'sinon';
import { PushNotifications } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import { clearPactPledge, setPactPledge } from '../../src/handlers/pacts';
import { runPledgeVerdictPass } from '../../src/handlers/helpers/pledgeVerdictDigest';

/**
 * Charity pledges, Phase A (WORK_IN_PROGRESS § 2.8, #2990) — the endpoint and the digest pass.
 * The verdict rules themselves are pinned in pledgeVerdict.test.ts; these cover the code that
 * reads, gates and queues around them.
 */

const MEMBER = 'aaaaaaaa-0000-4000-8000-00000000000a';
const PACT_ID = 'pact-1';
const HABIT_GOAL_ID = 'habit-goal-1';

const buildRes = () => {
    const captured: { statusCode?: number; body?: any } = {};
    return {
        captured,
        res: {
            status: (statusCode: number) => {
                captured.statusCode = statusCode;
                return { send: (payload: any) => { captured.body = payload; return payload; } };
            },
        } as any,
    };
};

const call = async (handler: any, body: any = {}) => {
    const { captured, res } = buildRes();
    await handler({
        headers: { 'x-userid': MEMBER, 'x-localecode': 'en-us', 'x-brand-variation': 'habits' },
        params: { id: PACT_ID },
        body,
    } as any, res, (() => undefined) as any);
    return captured;
};

describe('PUT /habits/pacts/:id/pledge', () => {
    let setPledge: sinon.SinonStub;

    const stub = ({ pact = { id: PACT_ID, status: 'active' }, member = { status: 'active', pledge: null } }: any = {}) => {
        sinon.stub(Store.pacts, 'getById').resolves(pact);
        sinon.stub(Store.pactMembers, 'getByPactAndUser').resolves(member);
        setPledge = sinon.stub(Store.pactMembers, 'setPledge').callsFake(async (_p, _u, pledge) => ({ pledge }) as any);
    };

    afterEach(() => sinon.restore());

    it('stores the caller\'s own pledge, dated now', async () => {
        stub();
        const result = await call(setPactPledge, { amount: 5, charityKey: 'direct_relief' });

        expect(result.statusCode).to.equal(200);
        const [pactId, userId, pledge] = setPledge.firstCall.args;
        expect(pactId).to.equal(PACT_ID);
        expect(userId).to.equal(MEMBER);
        expect(pledge).to.include({ amount: 5, charityKey: 'direct_relief' });
        expect(new Date(pledge.pledgedAt).getTime()).to.be.closeTo(Date.now(), 5000);
    });

    it('keeps the original pledgedAt when the pledge is edited, so an edit does not postpone it', async () => {
        stub({ member: { status: 'active', pledge: { amount: 5, charityKey: 'wwf', pledgedAt: '2026-09-01T00:00:00.000Z' } } });
        await call(setPactPledge, { amount: 10, charityKey: 'unicef_usa' });

        expect(setPledge.firstCall.args[2]).to.deep.equal({
            amount: 10,
            charityKey: 'unicef_usa',
            pledgedAt: '2026-09-01T00:00:00.000Z',
        });
    });

    it('rejects a charity outside the curated list', async () => {
        stub();
        const result = await call(setPactPledge, { amount: 5, charityKey: 'my_cousin' });

        expect(result.statusCode).to.equal(400);
        expect(setPledge.called).to.equal(false);
    });

    it('rejects a fractional, zero or oversized amount', async () => {
        stub();
        const results = await Promise.all([2.5, 0, 501, 'lots'].map((amount) => call(setPactPledge, { amount, charityKey: 'wwf' })));

        results.forEach((result) => expect(result.statusCode).to.equal(400));
        expect(setPledge.called).to.equal(false);
    });

    it('refuses a caller who is not an active member — a pledge is only ever one\'s own', async () => {
        stub({ member: { status: 'pending', pledge: null } });
        const result = await call(setPactPledge, { amount: 5, charityKey: 'wwf' });

        expect(result.statusCode).to.equal(403);
        expect(setPledge.called).to.equal(false);
    });

    it('refuses a pact that has finished', async () => {
        stub({ pact: { id: PACT_ID, status: 'expired' } });
        const result = await call(setPactPledge, { amount: 5, charityKey: 'wwf' });

        expect(result.statusCode).to.equal(409);
        expect(setPledge.called).to.equal(false);
    });

    it('clears the pledge on DELETE', async () => {
        stub({ member: { status: 'active', pledge: { amount: 5, charityKey: 'wwf', pledgedAt: '2026-09-01T00:00:00.000Z' } } });
        const result = await call(clearPactPledge);

        expect(result.statusCode).to.equal(200);
        expect(setPledge.firstCall.args).to.deep.equal([PACT_ID, MEMBER, null]);
    });
});

describe('runPledgeVerdictPass', () => {
    // Monday 2026-09-28, 15:00 UTC — Monday morning in Chicago. The closed week is 09-21 → 09-27.
    const MONDAY = new Date('2026-09-28T15:00:00.000Z');
    const TUESDAY = new Date('2026-09-29T15:00:00.000Z');

    const pledgedMember = {
        pactMemberId: 'pm-1',
        pactId: PACT_ID,
        userId: MEMBER,
        habitGoalId: HABIT_GOAL_ID,
        pledge: { amount: 5, charityKey: 'direct_relief', pledgedAt: '2026-09-01T00:00:00.000Z' },
        pactStartDate: '2026-09-01',
        settingsTimezone: 'America/Chicago',
    };

    const checkin = (day: number) => ({ status: 'completed', scheduledDate: `2026-09-${20 + day}` });

    const stub = ({
        checkins = [1, 2, 3, 4, 5, 6, 7].map(checkin),
        streak = {
            id: 'streak-1', currentStreak: 10, gracePeriodDays: 0, graceDaysUsed: 0,
        },
        preferences = {},
    }: any = {}) => {
        sinon.stub(Store.pactMembers, 'getPledgedMembersForVerdict').resolves([pledgedMember] as any);
        sinon.stub(Store.habitGoals, 'getByIds').resolves([{ id: HABIT_GOAL_ID, name: 'Morning run', frequencyType: 'daily' }] as any);
        sinon.stub(Store.users, 'getHabitReminderPreferences')
            .resolves({ [MEMBER]: { id: MEMBER, settingsTimezone: 'America/Chicago', ...preferences } } as any);
        sinon.stub(Store.habitCheckins, 'getByUserAndDateRange').resolves(checkins);
        sinon.stub(Store.pactStreakDays, 'getCreditedDatesForPacts').resolves(new Set<string>());
        sinon.stub(Store.streaks, 'getByUserAndHabit').resolves(streak as any);
        sinon.stub(Store.streaks, 'getHistoryByStreakId').resolves([]);
    };

    afterEach(() => sinon.restore());

    it('queues one pledgeMissed on the member\'s Monday for an uncovered miss', async () => {
        stub({ checkins: [1, 2, 3, 4, 5].map(checkin) });
        const queue = sinon.stub().resolves('queued');

        const counters = await runPledgeVerdictPass(queue, MONDAY);

        expect(counters.pledgeMissesQueued).to.equal(1);
        expect(queue.calledOnce).to.equal(true);
        const [toUserId, type, dedupeKey, extras] = queue.firstCall.args;
        expect(toUserId).to.equal(MEMBER);
        expect(type).to.equal(PushNotifications.Types.pledgeMissed);
        expect(dedupeKey).to.equal('pledge-missed:pact-1:2026-09-21');
        expect(extras).to.include({
            pactId: PACT_ID,
            habitName: 'Morning run',
            weekStartDate: '2026-09-21',
            pledgeAmount: 5,
            charityKey: 'direct_relief',
        });
    });

    it('stays silent for a week the streak freeze covers', async () => {
        stub({
            checkins: [1, 2, 3, 4, 5, 6].map(checkin),
            streak: {
                id: 'streak-1', currentStreak: 10, gracePeriodDays: 1, graceDaysUsed: 0,
            },
        });
        const queue = sinon.stub().resolves('queued');

        const counters = await runPledgeVerdictPass(queue, MONDAY);

        expect(counters.pledgeVerdictsCovered).to.equal(1);
        expect(queue.called).to.equal(false);
    });

    it('stays silent for a kept week', async () => {
        stub();
        const queue = sinon.stub().resolves('queued');

        const counters = await runPledgeVerdictPass(queue, MONDAY);

        expect(counters.pledgeVerdictsKept).to.equal(1);
        expect(queue.called).to.equal(false);
    });

    it('reads nothing further on a day that is not the member\'s Monday', async () => {
        stub({ checkins: [] });
        const queue = sinon.stub().resolves('queued');

        const counters = await runPledgeVerdictPass(queue, TUESDAY);

        expect(counters.pledgeMembersEvaluated).to.equal(1);
        expect(counters.pledgeMembersOnVerdictDay).to.equal(0);
        expect((Store.habitCheckins.getByUserAndDateRange as sinon.SinonStub).called).to.equal(false);
        expect(queue.called).to.equal(false);
    });

    it('honours the account-wide habits push switch', async () => {
        stub({ checkins: [], preferences: { settingsPushHabitReminders: false } });
        const queue = sinon.stub().resolves('queued');

        const counters = await runPledgeVerdictPass(queue, MONDAY);

        expect(counters.pledgeMissesMutedByPreference).to.equal(1);
        expect(queue.called).to.equal(false);
    });

    it('counts a duplicate as a dedupe and a failed enqueue as an error, never the other way round', async () => {
        stub({ checkins: [] });
        const duplicate = await runPledgeVerdictPass(sinon.stub().resolves('duplicate'), MONDAY);
        sinon.restore();
        stub({ checkins: [] });
        const failed = await runPledgeVerdictPass(sinon.stub().resolves('failed'), MONDAY);

        expect(duplicate.pledgeMissesDeduped).to.equal(1);
        expect(duplicate.pledgeErrors).to.equal(0);
        expect(failed.pledgeErrors).to.equal(1);
        expect(failed.pledgeMissesDeduped).to.equal(0);
    });

    it('does nothing when the kill switch is off', async () => {
        const previous = process.env.HABIT_PLEDGE_VERDICTS_ENABLED;
        process.env.HABIT_PLEDGE_VERDICTS_ENABLED = 'false';
        const read = sinon.stub(Store.pactMembers, 'getPledgedMembersForVerdict').resolves([]);
        try {
            await runPledgeVerdictPass(sinon.stub(), MONDAY);
            expect(read.called).to.equal(false);
        } finally {
            if (previous === undefined) {
                delete process.env.HABIT_PLEDGE_VERDICTS_ENABLED;
            } else {
                process.env.HABIT_PLEDGE_VERDICTS_ENABLED = previous;
            }
        }
    });
});
