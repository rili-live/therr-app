import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import { pauseUserHabit, resumeUserHabit } from '../../src/handlers/userHabits';
import evaluateCheckinNudgeFreshness from '../../src/utilities/checkinNudgeFreshness';
import { UNCAPPABLE_TYPES } from '../../src/utilities/notificationQueueWorker';

/**
 * The pause / resume endpoints and the send-time gate that cancels the resume reminders.
 *
 * The user is told, before they pause, that we will remind them at 7, 14 and 30 days and then
 * stop — and that coming back cancels the rest. The handler owns the first half (queue exactly
 * three, keyed on the pause), the freshness gate owns the second.
 */

const USER = 'aaaaaaaa-0000-4000-8000-000000000001';
const GOAL = 'bbbbbbbb-0000-4000-8000-000000000002';
const USER_HABIT = 'dddddddd-0000-4000-8000-000000000004';
const PAUSE = 'eeeeeeee-0000-4000-8000-000000000005';

const headers = {
    'x-userid': USER,
    'x-localecode': 'en-us',
    'x-brand-variation': BrandVariations.HABITS,
};

const callHandler = async (handler: any, body: Record<string, any> = {}) => {
    const captured: { statusCode?: number; body?: any } = {};
    const res: any = {
        status(code: number) {
            captured.statusCode = code;
            return this;
        },
        send(payload: any) {
            captured.body = payload;
            return this;
        },
    };
    await handler({
        headers, params: { id: USER_HABIT }, body, query: {},
    }, res);
    return captured;
};

const buildQueueRow = (overrides: Record<string, any> = {}): any => ({
    id: 'cccccccc-0000-4000-8000-000000000003',
    userId: USER,
    brandVariation: BrandVariations.HABITS,
    type: 'habit-pause-reminder',
    dedupeKey: `habit-pause-reminder:${PAUSE}:7`,
    payload: { pauseId: PAUSE, habitGoalId: GOAL, dayCount: 7 },
    status: 'failed',
    scheduledFor: new Date(),
    attempts: 1,
    lastError: null,
    sentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});

describe('Habit pause handlers', () => {
    let enqueue: sinon.SinonStub;

    beforeEach(() => {
        sinon.stub(Store.userHabits, 'getById').resolves({
            id: USER_HABIT, userId: USER, habitGoalId: GOAL, status: 'active',
        } as any);
        sinon.stub(Store.userHabits, 'getDetailByUser').resolves([]);
        sinon.stub(Store.users, 'getUserById').resolves([{ id: USER, settingsTimezone: 'America/Chicago' }] as any);
        sinon.stub(Store.streaks, 'getByUserAndHabit').resolves({ currentStreak: 12 } as any);
        sinon.stub(Store.habitGoals, 'getById').resolves({ id: GOAL, name: 'Running' } as any);
        enqueue = sinon.stub(Store.notificationQueue, 'enqueue').resolves({ id: 'q' } as any);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('pause', () => {
        it('opens a pause holding the current streak and queues the 7, 14 and 30-day reminders', async () => {
            sinon.stub(Store.habitPauses, 'getOpen').resolves(undefined);
            sinon.stub(Store.habitPauses, 'getLastClosed').resolves(undefined);
            const create = sinon.stub(Store.habitPauses, 'create').resolves({
                id: PAUSE, userId: USER, habitGoalId: GOAL, pausedOn: '2026-11-07', resumedOn: null, pausedAt: new Date(), resumedAt: null, streakAtPause: 12,
            });

            const captured = await callHandler(pauseUserHabit);

            expect(captured.statusCode).to.equal(200);
            expect(create.firstCall.args[0].streakAtPause).to.equal(12);
            expect(captured.body.reminders.map((r: any) => r.dayCount)).to.deep.equal([7, 14, 30]);

            expect(enqueue.callCount).to.equal(3);
            const keys = enqueue.getCalls().map((call) => call.args[1].dedupeKey);
            expect(keys).to.deep.equal([7, 14, 30].map((day) => `habit-pause-reminder:${PAUSE}:${day}`));
            enqueue.getCalls().forEach((call) => {
                // The brand selects the device token, not just the copy.
                expect(call.args[0]).to.equal(BrandVariations.HABITS);
                expect(call.args[1].type).to.equal('habit-pause-reminder');
                expect(call.args[1].payload).to.include({ pauseId: PAUSE, habitGoalId: GOAL, streakCount: 12 });
            });
        });

        it('refuses a habit that is already paused', async () => {
            sinon.stub(Store.habitPauses, 'getOpen').resolves({ id: PAUSE } as any);
            sinon.stub(Store.habitPauses, 'getLastClosed').resolves(undefined);
            const create = sinon.stub(Store.habitPauses, 'create');

            const captured = await callHandler(pauseUserHabit);

            expect(captured.statusCode).to.equal(409);
            expect(captured.body.error).to.equal('habit-already-paused');
            expect(create.called).to.equal(false);
            expect(enqueue.called).to.equal(false);
        });

        it('refuses a re-pause inside the cooldown and says when it opens', async () => {
            sinon.stub(Store.habitPauses, 'getOpen').resolves(undefined);
            // Resumed far enough in the future that "today" is always inside the cooldown.
            sinon.stub(Store.habitPauses, 'getLastClosed').resolves({ resumedOn: '2999-01-01' } as any);

            const captured = await callHandler(pauseUserHabit);

            expect(captured.statusCode).to.equal(409);
            expect(captured.body.error).to.equal('habit-pause-cooldown');
            expect(captured.body.pauseAvailableOn).to.equal('2999-01-08');
            // The sentence carries a readable date, never the raw 'YYYY-MM-DD'.
            expect(captured.body.message).to.include('January 8, 2999');
            expect(captured.body.message).to.not.include('2999-01-08');
        });

        it('queues nothing when a concurrent tap already opened the pause', async () => {
            sinon.stub(Store.habitPauses, 'getOpen').resolves(undefined);
            sinon.stub(Store.habitPauses, 'getLastClosed').resolves(undefined);
            sinon.stub(Store.habitPauses, 'create').resolves(undefined);

            const captured = await callHandler(pauseUserHabit);

            expect(captured.statusCode).to.equal(200);
            expect(enqueue.called).to.equal(false);
        });
    });

    describe('resume', () => {
        it('closes the open pause and reports whether it was an undo', async () => {
            const close = sinon.stub(Store.habitPauses, 'close').resolves({ action: 'undone', pause: {} as any });

            const captured = await callHandler(resumeUserHabit);

            expect(captured.statusCode).to.equal(200);
            expect(close.firstCall.args[0]).to.equal(USER);
            expect(close.firstCall.args[1]).to.equal(GOAL);
            expect(captured.body.resumeResult).to.equal('undone');
        });

        it('is a no-op for a habit that is not paused', async () => {
            sinon.stub(Store.habitPauses, 'close').resolves(undefined);

            const captured = await callHandler(resumeUserHabit);

            expect(captured.statusCode).to.equal(200);
            expect(captured.body.resumeResult).to.equal(null);
        });
    });

    describe('send-time cancel (freshness)', () => {
        it('sends while the habit is still paused', async () => {
            sinon.stub(Store.habitPauses, 'getById').resolves({ id: PAUSE, habitGoalId: GOAL, resumedOn: null } as any);
            sinon.stub(Store.userHabits, 'getByUserAndHabit').resolves({ status: 'active' } as any);

            expect((await evaluateCheckinNudgeFreshness(buildQueueRow())).shouldSend).to.equal(true);
        });

        it('skips once the pause has ended', async () => {
            sinon.stub(Store.habitPauses, 'getById').resolves({ id: PAUSE, habitGoalId: GOAL, resumedOn: '2026-11-10' } as any);

            const decision = await evaluateCheckinNudgeFreshness(buildQueueRow());
            expect(decision.shouldSend).to.equal(false);
            expect(decision.reason).to.contain('pause-ended');
        });

        it('skips a pause that was undone (its row is gone)', async () => {
            sinon.stub(Store.habitPauses, 'getById').resolves(undefined);

            expect((await evaluateCheckinNudgeFreshness(buildQueueRow())).reason).to.equal('pause-undone');
        });

        it('skips when the habit was archived while paused', async () => {
            sinon.stub(Store.habitPauses, 'getById').resolves({ id: PAUSE, habitGoalId: GOAL, resumedOn: null } as any);
            sinon.stub(Store.userHabits, 'getByUserAndHabit').resolves({ status: 'archived' } as any);

            expect((await evaluateCheckinNudgeFreshness(buildQueueRow())).reason).to.equal('habit-not-active');
        });

        it('fails open when the pause cannot be read', async () => {
            sinon.stub(Store.habitPauses, 'getById').rejects(new Error('read pool down'));

            expect((await evaluateCheckinNudgeFreshness(buildQueueRow())).shouldSend).to.equal(true);
        });

        it('is never dropped by the daily cap — the user was promised it', () => {
            expect(UNCAPPABLE_TYPES.has('habit-pause-reminder')).to.equal(true);
        });
    });
});
