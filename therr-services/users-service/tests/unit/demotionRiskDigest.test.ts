/**
 * Demotion-risk nudge: the late-week digest pass that tells users under their league's demotion
 * line, who have not checked in yet today, that they are about to drop a league.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import { resetClosedPeriodMemo } from '../../src/handlers/helpers/leaderboardPeriods';
import {
    getDemotionRiskCandidates,
    runDemotionRiskPass,
} from '../../src/handlers/helpers/demotionRiskDigest';
import { getDemotionRiskDedupeKey } from '../../src/utilities/leaderboardHelpers';
import { computeLeagueResults, ILeagueParticipant } from '../../src/utilities/leaderboardLeagues';

const HABITS = BrandVariations.HABITS;

// 2026-10-09 is a Friday; the period started Monday 2026-10-05 and resets 2026-10-12T00:00Z,
// 58 hours after the 14:00Z digest. Thursday's digest is 82 hours out.
const FRIDAY_DIGEST = new Date('2026-10-09T14:00:00Z');
const THURSDAY_DIGEST = new Date('2026-10-08T14:00:00Z');

// Ten people in sprout (second league): it promotes 2 and relegates 2 (a fifth, rounded down).
const sproutLeague = (): ILeagueParticipant[] => [100, 90, 80, 70, 60, 50, 40, 30, 20, 10].map((points, index) => ({
    userId: `u${index + 1}`,
    points,
    league: 'sprout',
    reachedAt: new Date(`2026-10-06T0${index % 10}:00:00Z`),
}));

describe('getDemotionRiskCandidates', () => {
    it('returns exactly the users the close would relegate, with their rank and gap to the lowest safe score', () => {
        const candidates = getDemotionRiskCandidates(HABITS, computeLeagueResults(HABITS, sproutLeague()));

        expect(candidates).to.deep.equal([
            { userId: 'u9', rank: 9, pointsBehind: 10 },
            { userId: 'u10', rank: 10, pointsBehind: 20 },
        ]);
    });

    it('never names anyone in the lowest league, which relegates nobody', () => {
        const seedlings = sproutLeague().map((participant) => ({ ...participant, league: null }));

        expect(getDemotionRiskCandidates(HABITS, computeLeagueResults(HABITS, seedlings))).to.deep.equal([]);
    });

    it('spares a tie straddling the line, so nobody is told they are under it while tied with someone above', () => {
        const tied = sproutLeague();
        tied[8].points = 30; // u9 ties u8 at the line

        const candidates = getDemotionRiskCandidates(HABITS, computeLeagueResults(HABITS, tied));

        expect(candidates.map((candidate) => candidate.userId)).to.deep.equal(['u10']);
    });
});

describe('runDemotionRiskPass', () => {
    const habits = { brandVariation: HABITS, whiteLabelOrigin: '' };
    const user = (id: string, overrides: any = {}) => ({
        id,
        settingsLocale: 'en-us',
        settingsTimezone: 'America/Chicago',
        settingsPushLeaderboardAlerts: true,
        ...overrides,
    });

    const activateLeagues = () => {
        process.env.LEADERBOARD_LEAGUES_BRANDS = 'habits';
        sinon.stub(Store.leaderboardPeriodResults, 'hasResultsForPeriod').resolves(true);
        sinon.stub(Store.leaderboardPeriodResults, 'applyLeagueMoves').resolves();
        sinon.stub(Store.leaderboardPeriodResults, 'wasClosedWithLeagues').resolves(true);
    };

    beforeEach(() => {
        resetClosedPeriodMemo();
    });

    afterEach(() => {
        sinon.restore();
        resetClosedPeriodMemo();
        delete process.env.LEADERBOARD_LEAGUES_BRANDS;
        delete process.env.LEADERBOARD_DEMOTION_NUDGES_ENABLED;
    });

    it('does nothing before the last three days of the week', async () => {
        activateLeagues();
        const participantsStub = sinon.stub(Store.userLeaderboardScores, 'getEligibleParticipantsForPeriod');

        const counters = await runDemotionRiskPass(habits, THURSDAY_DIGEST);

        expect(participantsStub.called).to.equal(false);
        expect(counters.demotionPassRan).to.equal(false);
    });

    it('does nothing while leagues are not running for the brand', async () => {
        const participantsStub = sinon.stub(Store.userLeaderboardScores, 'getEligibleParticipantsForPeriod');

        const counters = await runDemotionRiskPass(habits, FRIDAY_DIGEST);

        expect(participantsStub.called).to.equal(false);
        expect(counters.demotionPassRan).to.equal(false);
    });

    it('does nothing when the kill switch is off', async () => {
        activateLeagues();
        process.env.LEADERBOARD_DEMOTION_NUDGES_ENABLED = 'false';
        const participantsStub = sinon.stub(Store.userLeaderboardScores, 'getEligibleParticipantsForPeriod');

        await runDemotionRiskPass(habits, FRIDAY_DIGEST);

        expect(participantsStub.called).to.equal(false);
    });

    it('queues one nudge per user under the line with their rank, gap, hours left and own locale', async () => {
        activateLeagues();
        const participantsStub = sinon.stub(Store.userLeaderboardScores, 'getEligibleParticipantsForPeriod').resolves(sproutLeague() as any);
        sinon.stub(Store.users, 'findUsers').resolves([user('u9', { settingsLocale: 'es' }), user('u10', { settingsLocale: null })]);
        const checkinsStub = sinon.stub(Store.habitCheckins, 'getUsersCompletedOnLocalDates').resolves(new Set());
        const enqueueStub = sinon.stub(Store.notificationQueue, 'enqueue').resolves({ id: 'row' } as any);

        const counters = await runDemotionRiskPass(habits, FRIDAY_DIGEST);

        // This week's board, not the elapsed one.
        expect(participantsStub.firstCall.args[1]).to.equal('2026-10-05');
        // "Today" is each user's own local date: 09:00 in Chicago is still Friday the 9th.
        expect(checkinsStub.firstCall.args[0]).to.deep.include({ userId: 'u9', localDate: '2026-10-09' });
        expect(counters).to.include({ demotionPassRan: true, demotionCandidates: 2, demotionNudgesQueued: 2 });

        const rows = enqueueStub.getCalls().map((call) => (call.args as any[])[1]);
        const byUser = Object.fromEntries(rows.map((row) => [row.userId, row]));
        expect(byUser.u9).to.include({
            type: 'leaderboard-demotion-risk',
            dedupeKey: 'leaderboard-demotion-risk:2026-10-05:2026-10-09',
        });
        expect(byUser.u9.payload).to.include({
            locale: 'es', rank: 9, pointsBehind: 10, hoursLeft: 58,
        });
        expect(byUser.u10.payload).to.include({ locale: 'en-us', rank: 10, pointsBehind: 20 });
    });

    it('skips users who already checked in today, muted leaderboard alerts, or are in their quiet hours', async () => {
        activateLeagues();
        const league = sproutLeague();
        // Five under the line: a league of 25 relegates five.
        const big = [...league, ...league.map((participant) => ({ ...participant, userId: `${participant.userId}b`, points: participant.points - 5 })),
            ...league.slice(0, 5).map((participant) => ({ ...participant, userId: `${participant.userId}c`, points: participant.points + 1 }))];
        sinon.stub(Store.userLeaderboardScores, 'getEligibleParticipantsForPeriod').resolves(big as any);
        const candidates = getDemotionRiskCandidates(HABITS, computeLeagueResults(HABITS, big));
        expect(candidates.map((candidate) => candidate.userId)).to.deep.equal(['u8b', 'u9', 'u9b', 'u10', 'u10b']);

        sinon.stub(Store.users, 'findUsers').resolves([
            user('u8b'),
            user('u9', { settingsPushLeaderboardAlerts: false }),
            // 14:00Z is 23:00 in Tokyo — inside the default quiet window.
            user('u9b', { settingsTimezone: 'Asia/Tokyo' }),
            user('u10'),
            user('u10b', { settingsPushLeaderboardAlerts: null }),
        ]);
        sinon.stub(Store.habitCheckins, 'getUsersCompletedOnLocalDates').resolves(new Set(['u10']));
        const enqueueStub = sinon.stub(Store.notificationQueue, 'enqueue').resolves({ id: 'row' } as any);

        const counters = await runDemotionRiskPass(habits, FRIDAY_DIGEST);

        expect(enqueueStub.getCalls().map((call) => (call.args as any[])[1].userId).sort()).to.deep.equal(['u10b', 'u8b']);
        expect(counters).to.include({
            demotionCandidates: 5,
            demotionNudgesQueued: 2,
            demotionSkippedMuted: 1,
            demotionSkippedCheckedIn: 1,
            demotionSkippedQuietHours: 1,
        });
    });

    it('counts a second run of the same day as deduped, not as sent', async () => {
        activateLeagues();
        sinon.stub(Store.userLeaderboardScores, 'getEligibleParticipantsForPeriod').resolves(sproutLeague() as any);
        sinon.stub(Store.users, 'findUsers').resolves([user('u9'), user('u10')]);
        sinon.stub(Store.habitCheckins, 'getUsersCompletedOnLocalDates').resolves(new Set());
        sinon.stub(Store.notificationQueue, 'enqueue').resolves(null as any);

        const counters = await runDemotionRiskPass(habits, FRIDAY_DIGEST);

        expect(counters).to.include({ demotionNudgesQueued: 0, demotionNudgesDeduped: 2 });
    });

    it('keys the dedup on the period and the day, so it re-arms on the next late-week digest', () => {
        expect(getDemotionRiskDedupeKey('2026-10-05', FRIDAY_DIGEST)).to.equal('leaderboard-demotion-risk:2026-10-05:2026-10-09');
        expect(getDemotionRiskDedupeKey('2026-10-05', new Date('2026-10-10T14:00:00Z')))
            .to.equal('leaderboard-demotion-risk:2026-10-05:2026-10-10');
    });
});

describe('HabitCheckinsStore.getUsersCompletedOnLocalDates', () => {
    it('matches each user against their own local date in one query', async () => {
        const query = sinon.stub().resolves({ rows: [{ userId: 'a2b1c0d9-0000-4000-8000-000000000001' }] });
        // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
        const StoreClass = require('../../src/store/HabitCheckinsStore').default;
        const store = new StoreClass({ read: { query }, write: { query } });

        const result = await store.getUsersCompletedOnLocalDates([
            { userId: 'a2b1c0d9-0000-4000-8000-000000000001', localDate: '2026-10-09' },
            { userId: 'a2b1c0d9-0000-4000-8000-000000000002', localDate: '2026-10-10' },
        ]);

        const sql: string = query.firstCall.args[0];
        expect(query.calledOnce).to.equal(true);
        expect(sql).to.contain("'2026-10-09'::date").and.to.contain("'2026-10-10'::date");
        expect(sql).to.contain('c."localDate" = p."onDate"').and.to.contain("c.status = 'completed'");
        expect([...result]).to.deep.equal(['a2b1c0d9-0000-4000-8000-000000000001']);
    });

    it('skips the query for an empty batch', async () => {
        const query = sinon.stub();
        // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
        const StoreClass = require('../../src/store/HabitCheckinsStore').default;
        const store = new StoreClass({ read: { query }, write: { query } });

        expect((await store.getUsersCompletedOnLocalDates([])).size).to.equal(0);
        expect(query.called).to.equal(false);
    });
});
