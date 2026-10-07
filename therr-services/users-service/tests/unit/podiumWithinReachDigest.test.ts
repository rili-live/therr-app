/**
 * Podium-within-reach nudge: the Sunday digest pass that tells users a short XP gap from #3
 * how close they are before the Monday (UTC) reset.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import { runPodiumWithinReachPass } from '../../src/handlers/helpers/podiumWithinReachDigest';
import {
    getHoursUntilReset,
    getPodiumWithinReachDedupeKey,
    isLastDigestBeforeReset,
} from '../../src/utilities/leaderboardHelpers';

// 2026-10-11 is a Sunday. 14:00 UTC is when the 9am-Chicago digest fires (CDT); the period
// started Monday 2026-10-05 and resets at 2026-10-12T00:00Z, 10 hours later.
const SUNDAY_DIGEST = new Date('2026-10-11T14:00:00Z');
const SATURDAY_DIGEST = new Date('2026-10-10T14:00:00Z');

const podium = [
    { userId: 'a', points: 200, userName: 'a' },
    { userId: 'b', points: 150, userName: 'b' },
    { userId: 'c', points: 100, userName: 'c' },
];

describe('leaderboardHelpers — podium nudge timing', () => {
    it('treats only the UTC Sunday digest as the last before the reset', () => {
        expect(isLastDigestBeforeReset(SUNDAY_DIGEST)).to.equal(true);
        expect(isLastDigestBeforeReset(SATURDAY_DIGEST)).to.equal(false);
        expect(isLastDigestBeforeReset(new Date('2026-10-12T14:00:00Z'))).to.equal(false);
    });

    it('counts whole hours to the Monday 00:00 UTC reset', () => {
        expect(getHoursUntilReset(SUNDAY_DIGEST)).to.equal(10);
        expect(getHoursUntilReset(new Date('2026-10-11T23:30:00Z'))).to.equal(0);
    });

    it('keys the dedup on the period alone', () => {
        expect(getPodiumWithinReachDedupeKey('2026-10-05')).to.equal('leaderboard-podium-within-reach:2026-10-05');
    });
});

describe('runPodiumWithinReachPass', () => {
    const habits = { brandVariation: BrandVariations.HABITS, whiteLabelOrigin: '' };

    afterEach(() => {
        sinon.restore();
        delete process.env.LEADERBOARD_PODIUM_NUDGES_ENABLED;
    });

    it('does nothing on any day but Sunday', async () => {
        const topStub = sinon.stub(Store.userLeaderboardScores, 'getTopScores');

        const counters = await runPodiumWithinReachPass(habits, SATURDAY_DIGEST);

        expect(topStub.called).to.equal(false);
        expect(counters.podiumPassRan).to.equal(false);
    });

    it('does nothing when the kill switch is off', async () => {
        process.env.LEADERBOARD_PODIUM_NUDGES_ENABLED = 'false';
        const topStub = sinon.stub(Store.userLeaderboardScores, 'getTopScores');

        await runPodiumWithinReachPass(habits, SUNDAY_DIGEST);

        expect(topStub.called).to.equal(false);
    });

    it('does nothing when fewer than three people are on the board', async () => {
        sinon.stub(Store.userLeaderboardScores, 'getTopScores').resolves(podium.slice(0, 2));
        const chasersStub = sinon.stub(Store.userLeaderboardScores, 'getUsersWithinReachOfScore');

        await runPodiumWithinReachPass(habits, SUNDAY_DIGEST);

        expect(chasersStub.called).to.equal(false);
    });

    it('queues one nudge per chaser with the gap to #3, the board rank, hours left and their own locale', async () => {
        const topStub = sinon.stub(Store.userLeaderboardScores, 'getTopScores').resolves(podium);
        const chasersStub = sinon.stub(Store.userLeaderboardScores, 'getUsersWithinReachOfScore').resolves([
            {
                userId: 'd', points: 80, settingsLocale: 'es', settingsTimezone: 'America/Chicago',
            },
            {
                userId: 'e', points: 60, settingsLocale: null, settingsTimezone: 'America/New_York',
            },
        ]);
        sinon.stub(Store.userLeaderboardScores, 'getRankForScore')
            .withArgs(BrandVariations.HABITS, 80).resolves(4)
            // A muted user sits at 70, so e is #6 even though it is the second chaser.
            .withArgs(BrandVariations.HABITS, 60)
            .resolves(6);
        const enqueueStub = sinon.stub(Store.notificationQueue, 'enqueue').resolves({ id: 'row' } as any);

        const counters = await runPodiumWithinReachPass(habits, SUNDAY_DIGEST);

        expect(topStub.firstCall.args[1]).to.include({ periodStart: '2026-10-05', limit: 3 });
        expect(chasersStub.firstCall.args[1]).to.include({ periodStart: '2026-10-05', targetPoints: 100, maxGap: 50 });
        expect(counters).to.include({ podiumPassRan: true, podiumCandidates: 2, podiumNudgesQueued: 2 });

        const rows = enqueueStub.getCalls().map((call) => (call.args as any[])[1]);
        const byUser = Object.fromEntries(rows.map((row) => [row.userId, row]));
        expect(byUser.d).to.include({ type: 'leaderboard-podium-within-reach', dedupeKey: 'leaderboard-podium-within-reach:2026-10-05' });
        expect(byUser.d.payload).to.include({
            locale: 'es', rank: 4, pointsBehind: 20, hoursLeft: 10,
        });
        expect(byUser.e.payload).to.include({ locale: 'en-us', rank: 6, pointsBehind: 40 });
    });

    it('skips a chaser who is in their quiet hours at send time rather than waking them', async () => {
        sinon.stub(Store.userLeaderboardScores, 'getTopScores').resolves(podium);
        sinon.stub(Store.userLeaderboardScores, 'getUsersWithinReachOfScore').resolves([
            // 14:00Z is 23:00 in Tokyo — inside the default 21:30–08:00 quiet window.
            { userId: 'tokyo', points: 90, settingsTimezone: 'Asia/Tokyo' },
            // A user's own quiet hours win over the default: 09:00 Chicago is quiet for this one.
            {
                userId: 'late-riser',
                points: 90,
                settingsTimezone: 'America/Chicago',
                settingsQuietHoursStart: '22:00:00',
                settingsQuietHoursEnd: '10:00:00',
            },
        ]);
        sinon.stub(Store.userLeaderboardScores, 'getRankForScore').resolves(4);
        const enqueueStub = sinon.stub(Store.notificationQueue, 'enqueue');

        const counters = await runPodiumWithinReachPass(habits, SUNDAY_DIGEST);

        expect(enqueueStub.called).to.equal(false);
        expect(counters.podiumNudgesSkippedQuietHours).to.equal(2);
    });

    it('skips a chaser whose rank has since reached the podium', async () => {
        sinon.stub(Store.userLeaderboardScores, 'getTopScores').resolves(podium);
        sinon.stub(Store.userLeaderboardScores, 'getUsersWithinReachOfScore').resolves([
            { userId: 'd', points: 90, settingsTimezone: 'America/Chicago' },
        ]);
        sinon.stub(Store.userLeaderboardScores, 'getRankForScore').resolves(3);
        const enqueueStub = sinon.stub(Store.notificationQueue, 'enqueue');

        await runPodiumWithinReachPass(habits, SUNDAY_DIGEST);

        expect(enqueueStub.called).to.equal(false);
    });

    it('counts a second Sunday run as deduped, not as sent', async () => {
        sinon.stub(Store.userLeaderboardScores, 'getTopScores').resolves(podium);
        sinon.stub(Store.userLeaderboardScores, 'getUsersWithinReachOfScore').resolves([
            { userId: 'd', points: 90, settingsTimezone: 'America/Chicago' },
        ]);
        sinon.stub(Store.userLeaderboardScores, 'getRankForScore').resolves(4);
        sinon.stub(Store.notificationQueue, 'enqueue').resolves(null as any);

        const counters = await runPodiumWithinReachPass(habits, SUNDAY_DIGEST);

        expect(counters).to.include({ podiumNudgesQueued: 0, podiumNudgesDeduped: 1 });
    });
});

describe('UserLeaderboardScoresStore.getUsersWithinReachOfScore', () => {
    const buildStore = () => {
        const query = sinon.stub().resolves({ rows: [{ userId: 'd', points: '80' }] });
        // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
        const StoreClass = require('../../src/store/UserLeaderboardScoresStore').default;
        return { query, store: new StoreClass({ read: { query }, write: { query } }) };
    };

    it('selects eligible, unmuted users strictly below the target and within the gap', async () => {
        const { query, store } = buildStore();

        const rows = await store.getUsersWithinReachOfScore(BrandVariations.HABITS, {
            periodStart: '2026-10-05',
            targetPoints: 100,
            maxGap: 50,
        });

        const sql: string = query.firstCall.args[0];
        expect(sql).to.contain('"main"."userLeaderboardScores"."points" < 100');
        expect(sql).to.contain('"main"."userLeaderboardScores"."points" >= 50');
        expect(sql).to.contain('"users"."settingsPushLeaderboardAlerts" IS DISTINCT FROM false');
        expect(sql).to.contain('"settingsIsLeaderboardEnabled" = true');
        expect(sql).to.contain('"brandVariation" = \'habits\'');
        expect(rows).to.deep.equal([{ userId: 'd', points: 80 }]);
    });

    it('never reaches down to users with no points this week', async () => {
        const { query, store } = buildStore();

        await store.getUsersWithinReachOfScore(BrandVariations.HABITS, { periodStart: '2026-10-05', targetPoints: 30, maxGap: 50 });

        expect(query.firstCall.args[0]).to.contain('"main"."userLeaderboardScores"."points" >= 1');
    });
});
