import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import runDailyHabitsDigest from '../../src/handlers/habitsDigest';
import * as retentionEmailModule from '../../src/api/email/for-social/sendHabitRetentionEmail';
import { getTodayDateString } from '../../src/utilities/streakHelpers';
import { addDays } from '../../src/utilities/dailyStreak';

/**
 * Habits digest — retention messaging at the measured drop-off points.
 *
 * Production, 30 days to 2026-10-29, internal accounts excluded: 677 of 902 queued pushes went to
 * users already 3+ days without a check-in, with one open between them; 111 of 125 accounts older
 * than 35 days never completed a check-in; of those who did, 35 checked in on day 0 and 7 on
 * days 1–2. These tests pin the four responses: back off the lapsed, replace the noise
 * with a short comeback ladder, and make the first check-in and day 2 their own messages.
 */

const TODAY = getTodayDateString();
const USER = 'aaaaaaaa-0000-4000-8000-00000000000a';
const PARTNER = 'bbbbbbbb-0000-4000-8000-00000000000b';
const GOAL = 'goal-1';
const PACT_ID = 'pact-1';

interface IEnqueueCall {
    userId: string;
    type: string;
    dedupeKey: string;
    payload: Record<string, any>;
}

const habitRow = (overrides: Record<string, any> = {}) => ({
    userId: USER,
    habitGoalId: GOAL,
    goalName: 'Morning run',
    goalType: 'standard',
    frequencyType: 'daily',
    frequencyCount: 1,
    targetDaysOfWeek: null,
    currentStreak: 0,
    streakIsActive: false,
    gracePeriodDays: 0,
    graceDaysUsed: 0,
    lastCompletedDate: null,
    completedToday: false,
    completionsEarlierThisWeek: 0,
    activePactId: null,
    ...overrides,
});

const profile = (overrides: Record<string, any> = {}) => ({
    userId: USER,
    lastCheckinDate: null,
    firstCheckinDate: null,
    firstHabitStartedDate: null,
    email: 'user@example.com',
    firstName: 'Alex',
    userName: 'alex',
    isUnclaimed: false,
    settingsEmailReminders: true,
    settingsLocale: 'en-us',
    ...overrides,
});

interface IScenario {
    habits?: Record<string, any>[];
    profiles?: Record<string, any>[] | Error;
    /** Users with a Habits device token. Everyone by default. */
    withDevice?: string[];
    /** Ledger keys already claimed (an earlier run). */
    claimed?: string[];
    pact?: boolean;
}

const calls: IEnqueueCall[] = [];
const claims: { userId: string; key: string; channel: string }[] = [];
let emails: sinon.SinonStub;

const stubDigest = (scenario: IScenario = {}) => {
    process.env.HABIT_LAST_CHANCE_REMINDERS_ENABLED = 'false';
    process.env.HABIT_WEEKLY_RECAPS_ENABLED = 'false';
    process.env.HABIT_ONBOARDING_NURTURE_ENABLED = 'false';

    const {
        habits = [habitRow()],
        profiles = [profile()],
        withDevice = [USER, PARTNER],
        claimed = [],
        pact = false,
    } = scenario;

    const inserted = new Set<string>();
    sinon.stub(Store.notificationQueue, 'enqueue').callsFake((brand: any, args: any) => {
        calls.push({
            userId: args.userId, type: args.type, dedupeKey: args.dedupeKey, payload: args.payload || {},
        });
        const key = `${brand}|${args.userId}|${args.dedupeKey}`;
        if (inserted.has(key)) return Promise.resolve(undefined);
        inserted.add(key);
        return Promise.resolve({ id: `row-${inserted.size}` } as any);
    });

    sinon.stub(Store.pacts, 'getExpiredPacts').resolves([] as any);
    sinon.stub(Store.pacts, 'expire').resolves({} as any);
    sinon.stub(Store.pacts, 'get').resolves((pact
        ? [{
            id: PACT_ID, habitGoalId: GOAL, status: 'active', endDate: null,
        }]
        : []) as any);
    sinon.stub(Store.pactMembers, 'getByPactId').resolves((pact
        ? [USER, PARTNER].map((userId) => ({ userId, status: 'active', joinedAt: '2026-01-01T00:00:00.000Z' }))
        : []) as any);
    sinon.stub(Store.habitGoals, 'getById').resolves({ name: 'Morning run' } as any);
    sinon.stub(Store.users, 'findUser').callsFake((conditions: any) => Promise.resolve([
        { firstName: conditions?.id === PARTNER ? 'Dana' : 'Alex' },
    ] as any));
    sinon.stub(Store.users, 'getHabitReminderPreferences').resolves({} as any);
    sinon.stub(Store.habitCheckins, 'getByUserAndDate').resolves([] as any);
    sinon.stub(Store.streaks, 'getByUserAndHabit').resolves(null as any);
    sinon.stub(Store.userHabits, 'getActiveForReminders').resolves(habits as any);
    sinon.stub(Store.userHabits, 'getNotificationPreferencesForPairs').resolves({} as any);

    const profileStub = sinon.stub(Store.onboardingMessages, 'getRetentionProfiles');
    if (profiles instanceof Error) {
        profileStub.rejects(profiles);
    } else {
        profileStub.resolves(profiles as any);
    }
    const already = new Set(claimed.map((key) => `${USER}|${key}`));
    sinon.stub(Store.onboardingMessages, 'claim').callsFake((userId: string, key: string, channel: any) => {
        claims.push({ userId, key, channel });
        if (already.has(`${userId}|${key}`)) return Promise.resolve(false);
        already.add(`${userId}|${key}`);
        return Promise.resolve(true);
    });
    sinon.stub(Store.userDeviceTokens, 'getTokensForUsers').callsFake((_brand: any, userIds: string[]) => Promise.resolve(
        userIds.filter((id) => withDevice.includes(id)).map((userId) => ({ userId })) as any,
    ));
    emails = sinon.stub(retentionEmailModule, 'default').resolves({} as any);
};

const runDigest = async () => {
    let body: any;
    const res: any = { status: () => ({ send: (payload: any) => { body = payload; return payload; } }) };
    await runDailyHabitsDigest(
        { headers: { 'x-brand-variation': 'habits', 'x-localecode': 'en-us' } } as any,
        res,
        (() => undefined) as any,
    );
    return body;
};

const nudges = () => calls.filter((call) => call.dedupeKey === `checkin-nudge:${TODAY}`);

describe('Habits digest — retention messaging', () => {
    beforeEach(() => {
        calls.length = 0;
        claims.length = 0;
        delete process.env.HABIT_PHASE_ENGINE_ENABLED;
    });

    afterEach(() => {
        sinon.restore();
        [
            'HABIT_LAPSE_BACKOFF_ENABLED',
            'HABIT_RETENTION_MESSAGES_ENABLED',
            'HABIT_LAPSE_BACKOFF_DAYS',
            'HABIT_COMEBACK_LADDER_DAYS',
            'HABIT_ONBOARDING_NURTURE_ENABLED',
            'HABIT_DAILY_BONUS_ENABLED',
        ].forEach((key) => { delete process.env[key]; });
    });

    describe('back-off for lapsed users', () => {
        it('keeps the ordinary nudge for someone who checked in two days ago', async () => {
            stubDigest({ profiles: [profile({ lastCheckinDate: addDays(TODAY, -2), firstCheckinDate: addDays(TODAY, -9) })] });

            const counters = await runDigest();

            expect(nudges()).to.have.length(1);
            expect(nudges()[0].payload.messageVariant).to.equal(undefined);
            expect(counters.retention.nudgesBackedOff).to.equal(0);
        });

        it('replaces the daily nudge with the day-3 comeback, once, naming the habit', async () => {
            const lastCheckin = addDays(TODAY, -3);
            stubDigest({ profiles: [profile({ lastCheckinDate: lastCheckin, firstCheckinDate: addDays(TODAY, -20) })] });

            const counters = await runDigest();

            expect(nudges()).to.have.length(0);
            expect(counters.retention.nudgesBackedOff).to.equal(1);
            const comeback = calls.filter((call) => call.dedupeKey.startsWith('retention:comeback:'));
            expect(comeback).to.have.length(1);
            expect(comeback[0].dedupeKey).to.equal(`retention:comeback:${lastCheckin}:d3`);
            expect(comeback[0].type).to.equal('daily-habit-reminder');
            expect(comeback[0].payload).to.include({
                messageVariant: 'comeback', habitName: 'Morning run', habitGoalId: GOAL, comebackRung: 3,
            });
            // The freshness gate's inputs, so a user who checks in before it lands is not told to come back.
            expect(comeback[0].payload.habitGoalIds).to.deep.equal([GOAL]);
            expect(comeback[0].payload.checkinDate).to.match(/^\d{4}-\d{2}-\d{2}$/);
            expect(counters.retention.comeback.queued).to.equal(1);
        });

        it('drops the bonus promise when the daily bonus is switched off', async () => {
            process.env.HABIT_DAILY_BONUS_ENABLED = 'false';
            stubDigest({ profiles: [profile({ lastCheckinDate: addDays(TODAY, -7), firstCheckinDate: addDays(TODAY, -20) })] });

            await runDigest();

            const comeback = calls.filter((call) => call.dedupeKey.startsWith('retention:comeback:'));
            expect(comeback[0].payload.messageVariant).to.equal('comeback-no-bonus');
            expect(comeback[0].dedupeKey).to.match(/:d7$/);
        });

        it('sends nothing at all once the ladder is exhausted', async () => {
            stubDigest({ profiles: [profile({ lastCheckinDate: addDays(TODAY, -40), firstCheckinDate: addDays(TODAY, -60) })] });

            const counters = await runDigest();

            expect(calls).to.have.length(0);
            expect(counters.retention.ladderExhausted).to.equal(1);
        });

        it('sends no second comeback for the same rung on a re-run', async () => {
            const lastCheckin = addDays(TODAY, -4);
            stubDigest({
                profiles: [profile({ lastCheckinDate: lastCheckin, firstCheckinDate: addDays(TODAY, -20) })],
                claimed: [`retention:comeback:${lastCheckin}:d3`],
            });

            const counters = await runDigest();

            expect(calls).to.have.length(0);
            expect(counters.retention.comeback.deduped).to.equal(1);
        });

        it('emails the comeback to a lapsed user with no device', async () => {
            stubDigest({
                profiles: [profile({ lastCheckinDate: addDays(TODAY, -3), firstCheckinDate: addDays(TODAY, -20) })],
                withDevice: [],
            });

            const counters = await runDigest();

            expect(calls).to.have.length(0);
            expect(emails.calledOnce).to.equal(true);
            expect(emails.firstCall.args[0]).to.equal('comeback');
            expect(emails.firstCall.args[2]).to.include({ habitName: 'Morning run' });
            expect(counters.retention.comeback.emailed).to.equal(1);
            expect(claims[0].channel).to.equal('email');
        });

        it('offers a fresh start, not a comeback, to someone who never checked in', async () => {
            stubDigest({ profiles: [profile({ firstHabitStartedDate: addDays(TODAY, -5) })] });

            await runDigest();

            expect(nudges()).to.have.length(0);
            const fresh = calls.filter((call) => call.dedupeKey.startsWith('retention:comeback:'));
            expect(fresh).to.have.length(1);
            expect(fresh[0].payload.messageVariant).to.equal('fresh-start');
        });

        it('stops telling a partner about a member who has been gone for days', async () => {
            stubDigest({
                pact: true,
                habits: [],
                profiles: [
                    profile({ lastCheckinDate: addDays(TODAY, -6), firstCheckinDate: addDays(TODAY, -30) }),
                    profile({ userId: PARTNER, lastCheckinDate: TODAY, firstCheckinDate: addDays(TODAY, -30) }),
                ],
            });

            const counters = await runDigest();

            const partnerMissed = calls.filter((call) => call.type === 'partner-missed-day');
            // The active partner hears nothing about the lapsed member; the lapsed member is not
            // told about the partner either (they are lapsed themselves).
            expect(partnerMissed.filter((call) => call.userId === PARTNER)).to.have.length(0);
            expect(counters.retention.partnerMissedBackedOff).to.be.greaterThan(0);
        });

        it('falls back to the old behaviour when the history read fails', async () => {
            stubDigest({ profiles: new Error('relation does not exist') });

            const counters = await runDigest();

            expect(nudges()).to.have.length(1);
            expect(counters.retention.profileReadFailed).to.equal(true);
            expect(counters.retention.nudgesBackedOff).to.equal(0);
        });

        it('can be switched off without a deploy', async () => {
            process.env.HABIT_LAPSE_BACKOFF_ENABLED = 'false';
            stubDigest({ profiles: [profile({ lastCheckinDate: addDays(TODAY, -5), firstCheckinDate: addDays(TODAY, -20) })] });

            await runDigest();

            expect(nudges()).to.have.length(1);
            expect(calls.filter((call) => call.dedupeKey.startsWith('retention:'))).to.have.length(0);
        });

        it('takes N and the ladder from the environment', async () => {
            process.env.HABIT_LAPSE_BACKOFF_DAYS = '5';
            process.env.HABIT_COMEBACK_LADDER_DAYS = '5,10';
            stubDigest({ profiles: [profile({ lastCheckinDate: addDays(TODAY, -4), firstCheckinDate: addDays(TODAY, -20) })] });

            await runDigest();

            // Day 4 is inside a 5-day window: still nudged, no comeback.
            expect(nudges()).to.have.length(1);
            expect(calls.filter((call) => call.dedupeKey.startsWith('retention:'))).to.have.length(0);
        });
    });

    describe('the first check-in and day 2', () => {
        it('turns the day-2 nudge into "Day 2 of <habit>", naming the partner', async () => {
            const yesterday = addDays(TODAY, -1);
            stubDigest({
                pact: true,
                habits: [habitRow({ activePactId: PACT_ID, currentStreak: 1, streakIsActive: true })],
                profiles: [
                    profile({ lastCheckinDate: yesterday, firstCheckinDate: yesterday }),
                    profile({ userId: PARTNER, lastCheckinDate: TODAY, firstCheckinDate: addDays(TODAY, -30) }),
                ],
            });

            const counters = await runDigest();

            const mine = nudges().filter((call) => call.userId === USER);
            expect(mine).to.have.length(1);
            expect(mine[0].type).to.equal('daily-habit-reminder');
            expect(mine[0].payload.messageVariant).to.equal('day-two');
            expect(mine[0].payload.partnerName).to.equal('Dana');
            expect(mine[0].payload.habitGoalId).to.equal(GOAL);
            expect(counters.retention.dayTwo.queued).to.equal(1);
            expect(claims.find((claim) => claim.userId === USER)?.key).to.equal('retention:day-two');
        });

        it('sends the day-2 message only once ever, falling back to the ordinary nudge', async () => {
            const yesterday = addDays(TODAY, -1);
            stubDigest({
                profiles: [profile({ lastCheckinDate: yesterday, firstCheckinDate: yesterday })],
                claimed: ['retention:day-two'],
            });

            const counters = await runDigest();

            expect(nudges()).to.have.length(1);
            expect(nudges()[0].payload.messageVariant).to.equal(undefined);
            expect(counters.retention.dayTwo.deduped).to.equal(1);
        });

        it('offers the one-tap first check-in for the habit they picked', async () => {
            stubDigest({ profiles: [profile({ firstHabitStartedDate: TODAY })] });

            const counters = await runDigest();

            expect(nudges()).to.have.length(1);
            expect(nudges()[0].payload).to.include({ messageVariant: 'first-checkin', habitGoalId: GOAL });
            expect(claims[0]).to.include({ key: 'onboarding:first-checkin', channel: 'push' });
            expect(counters.retention.firstCheckin.queued).to.equal(1);
        });

        it('emails the first check-in to someone with no device, and pushes nothing', async () => {
            stubDigest({ profiles: [profile({ firstHabitStartedDate: TODAY })], withDevice: [] });

            const counters = await runDigest();

            expect(nudges()).to.have.length(0);
            expect(emails.firstCall.args[0]).to.equal('first-checkin');
            expect(emails.firstCall.args[1].toAddresses).to.deep.equal(['user@example.com']);
            expect(counters.retention.firstCheckin.emailed).to.equal(1);
        });

        it('leaves the ordinary nudge alone when there is no device and no usable email', async () => {
            stubDigest({
                profiles: [profile({ firstHabitStartedDate: TODAY, settingsEmailReminders: false })],
                withDevice: [],
            });

            const counters = await runDigest();

            expect(nudges()).to.have.length(1);
            expect(claims).to.have.length(0);
            expect(counters.retention.firstCheckin.noChannel).to.equal(1);
        });
    });
});
