/**
 * Leaderboard leagues (#3055): branded leagues with promotion and relegation at each weekly close.
 *
 * Covers the pure rules (utilities/leaderboardLeagues.ts), the close that applies them
 * (handlers/helpers/leaderboardPeriods.ts), the SQL the stores emit for them, and the board
 * endpoint's league scope.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import LeaderboardPeriodResultsStore from '../../src/store/LeaderboardPeriodResultsStore';
import UserLeaderboardScoresStore from '../../src/store/UserLeaderboardScoresStore';
import {
    areLeaguesActiveForBrand,
    closeElapsedLeaderboardPeriod,
    getActiveLeagueForUser,
    resetClosedPeriodMemo,
} from '../../src/handlers/helpers/leaderboardPeriods';
import { getLeaderboard } from '../../src/handlers/leaderboards';
import {
    areLeaguesEnabledForBrand,
    computeLeagueResults,
    DEFAULT_LEAGUE_ACTIVATION_MIN_PARTICIPANTS,
    getLeagueActivationThreshold,
    getLeagueEnabledBrands,
    getLeagueMovementCounts,
    ILeagueParticipant,
    LEAGUE_MIN_SIZE_FOR_MOVEMENT,
} from '../../src/utilities/leaderboardLeagues';

const HABITS = BrandVariations.HABITS;

const participants = (count: number, league: string | null, pointsFrom = 100): ILeagueParticipant[] => Array
    .from({ length: count }, (_, index) => ({ userId: `${league || 'none'}-${index}`, points: pointsFrom - index, league }));

const withLeagueEnv = (env: Record<string, string | undefined>) => {
    const previous: Record<string, string | undefined> = {};
    Object.keys(env).forEach((key) => {
        previous[key] = process.env[key];
        if (env[key] === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = env[key];
        }
    });
    return () => Object.keys(previous).forEach((key) => {
        if (previous[key] === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = previous[key];
        }
    });
};

describe('leaderboard leagues — rollout switch and threshold', () => {
    it('is off unless the brand is listed, and ignores brands without a ladder', () => {
        expect(getLeagueEnabledBrands({})).to.deep.equal([]);
        expect(areLeaguesEnabledForBrand(HABITS, {})).to.equal(false);

        const env = { LEADERBOARD_LEAGUES_BRANDS: ' Habits, teem ,therr' };
        expect(getLeagueEnabledBrands(env)).to.deep.equal(['habits', 'therr']);
        expect(areLeaguesEnabledForBrand(HABITS, env)).to.equal(true);
        expect(areLeaguesEnabledForBrand(BrandVariations.TEEM, env)).to.equal(false);
    });

    it('defaults the activation threshold and never lets it fall below 1', () => {
        expect(getLeagueActivationThreshold({})).to.equal(DEFAULT_LEAGUE_ACTIVATION_MIN_PARTICIPANTS);
        expect(getLeagueActivationThreshold({ LEADERBOARD_LEAGUES_MIN_PARTICIPANTS: '12' })).to.equal(12);
        expect(getLeagueActivationThreshold({ LEADERBOARD_LEAGUES_MIN_PARTICIPANTS: '0' }))
            .to.equal(DEFAULT_LEAGUE_ACTIVATION_MIN_PARTICIPANTS);
        expect(getLeagueActivationThreshold({ LEADERBOARD_LEAGUES_MIN_PARTICIPANTS: 'lots' }))
            .to.equal(DEFAULT_LEAGUE_ACTIVATION_MIN_PARTICIPANTS);
    });
});

describe('getLeagueMovementCounts', () => {
    it('moves a fifth of a league each way, at least one', () => {
        expect(getLeagueMovementCounts(30, 2, 6)).to.deep.equal({ promoteCount: 6, demoteCount: 6 });
        expect(getLeagueMovementCounts(5, 2, 6)).to.deep.equal({ promoteCount: 1, demoteCount: 1 });
    });

    it('never relegates from the lowest league or promotes from the top one', () => {
        expect(getLeagueMovementCounts(30, 0, 6)).to.deep.equal({ promoteCount: 6, demoteCount: 0 });
        expect(getLeagueMovementCounts(30, 5, 6)).to.deep.equal({ promoteCount: 0, demoteCount: 6 });
    });

    it('freezes a league too small for movement to mean anything', () => {
        expect(getLeagueMovementCounts(LEAGUE_MIN_SIZE_FOR_MOVEMENT - 1, 2, 6))
            .to.deep.equal({ promoteCount: 0, demoteCount: 0 });
    });
});

describe('computeLeagueResults', () => {
    it('starts everyone in the lowest league, so the first close demotes no one', () => {
        const results = computeLeagueResults(HABITS, participants(30, null));

        expect(results).to.have.length(30);
        expect(results.every((result) => result.leagueFrom === 'seedling')).to.equal(true);
        expect(results.filter((result) => result.leagueTo === 'sprout').map((result) => result.placement))
            .to.deep.equal([1, 2, 3, 4, 5, 6]);
        expect(results.filter((result) => result.leagueTo === 'seedling')).to.have.length(24);
        expect(results.every((result) => result.participants === 30)).to.equal(true);
    });

    it('ranks each league on its own and places out of the league, not the brand', () => {
        const results = computeLeagueResults(HABITS, [
            ...participants(10, 'sapling', 500),
            ...participants(5, 'oak', 50),
        ]);
        const oakWinner = results.find((result) => result.userId === 'oak-0');
        const saplingLast = results.find((result) => result.userId === 'sapling-9');

        // The oak league scored less than every sapling, yet its winner is #1 of 5 and moves up.
        expect(oakWinner).to.include({
            placement: 1, participants: 5, leagueFrom: 'oak', leagueTo: 'evergreen',
        });
        expect(saplingLast).to.include({
            placement: 10, participants: 10, leagueFrom: 'sapling', leagueTo: 'sprout',
        });
        expect(results.filter((result) => result.leagueFrom === 'sapling' && result.leagueTo === 'bloom')).to.have.length(2);
    });

    it('spares a tie that straddles the relegation line', () => {
        const results = computeLeagueResults(HABITS, [
            { userId: 'a', points: 90, league: 'sapling' },
            { userId: 'b', points: 80, league: 'sapling' },
            { userId: 'c', points: 80, league: 'sapling' },
            { userId: 'd', points: 70, league: 'sapling' },
            { userId: 'e', points: 10, league: 'sapling' },
            { userId: 'f', points: 10, league: 'sapling' },
        ]);
        const byUser = Object.fromEntries(results.map((result) => [result.userId, result]));

        // 6 people: 1 up, 1 down. Ties on the bottom line (e, f share #5) are both spared.
        expect(byUser.a.leagueTo).to.equal('bloom');
        expect(byUser.b.leagueTo).to.equal('sapling');
        expect(byUser.e).to.include({ placement: 5, leagueTo: 'sapling' });
        expect(byUser.f).to.include({ placement: 5, leagueTo: 'sapling' });
    });

    it('promotes whoever reached a tied score first when the tie straddles the promotion line', () => {
        const results = computeLeagueResults(HABITS, [
            {
                userId: 'a', points: 50, league: null, reachedAt: '2026-09-10T12:00:00.000Z',
            },
            {
                userId: 'b', points: 50, league: null, reachedAt: '2026-09-09T12:00:00.000Z',
            },
            ...participants(4, null, 20),
        ]);
        const byUser = Object.fromEntries(results.map((result) => [result.userId, result]));

        // 6 people promote 1. Both share #1; b got to 50 a day earlier.
        expect(byUser.b).to.include({ placement: 1, leagueTo: 'sprout' });
        expect(byUser.a).to.include({ placement: 1, leagueTo: 'seedling' });
    });

    it('promotes exactly a fifth of a league that tied all the way down, not all of it', () => {
        const results = computeLeagueResults(HABITS, Array.from({ length: 30 }, (_, index) => ({
            userId: `u-${String(index).padStart(2, '0')}`,
            points: 10,
            league: 'sapling',
            reachedAt: new Date(Date.UTC(2026, 8, 8, index)).toISOString(),
        })));
        const promoted = results.filter((result) => result.leagueTo === 'bloom').map((result) => result.userId);

        expect(promoted).to.deep.equal(['u-00', 'u-01', 'u-02', 'u-03', 'u-04', 'u-05']);
        // A tie spanning the relegation line spares everyone in it.
        expect(results.filter((result) => result.leagueTo === 'sprout')).to.have.length(0);
    });

    it('reads an unknown stored league as the lowest one', () => {
        const [result] = computeLeagueResults(HABITS, [{ userId: 'a', points: 5, league: 'retired-league' }]);

        expect(result).to.include({ leagueFrom: 'seedling', leagueTo: 'seedling' });
    });

    it('uses each brand\'s own ladder', () => {
        const [result] = computeLeagueResults(BrandVariations.THERR, participants(5, null));

        expect(result).to.include({ leagueFrom: 'wanderer', leagueTo: 'scout' });
        expect(computeLeagueResults(BrandVariations.TEEM, participants(5, null))).to.deep.equal([]);
    });
});

describe('closeElapsedLeaderboardPeriod — leagues', () => {
    const now = new Date('2026-09-16T12:00:00.000Z');
    let restoreEnv: () => void;
    let hasResults: sinon.SinonStub;
    let closePeriod: sinon.SinonStub;
    let insertLeagueResults: sinon.SinonStub;
    let applyLeagueMoves: sinon.SinonStub;
    let getParticipants: sinon.SinonStub;

    beforeEach(() => {
        resetClosedPeriodMemo();
        restoreEnv = withLeagueEnv({ LEADERBOARD_LEAGUES_BRANDS: 'habits', LEADERBOARD_LEAGUES_MIN_PARTICIPANTS: '10' });
        hasResults = sinon.stub(Store.leaderboardPeriodResults, 'hasResultsForPeriod').resolves(false);
        closePeriod = sinon.stub(Store.leaderboardPeriodResults, 'closePeriod').resolves(0);
        insertLeagueResults = sinon.stub(Store.leaderboardPeriodResults, 'insertLeagueResults').callsFake((_b, _p, rows) => Promise.resolve(rows.length));
        applyLeagueMoves = sinon.stub(Store.leaderboardPeriodResults, 'applyLeagueMoves').resolves(0);
        getParticipants = sinon.stub(Store.userLeaderboardScores, 'getEligibleParticipantsForPeriod');
    });

    afterEach(() => {
        sinon.restore();
        restoreEnv();
        resetClosedPeriodMemo();
    });

    it('closes brand-wide, as before leagues, when the brand is not switched on', async () => {
        await closeElapsedLeaderboardPeriod(BrandVariations.THERR, now);

        expect(closePeriod.calledOnceWith(BrandVariations.THERR, '2026-09-07')).to.equal(true);
        expect(getParticipants.called).to.equal(false);
        expect(applyLeagueMoves.called).to.equal(false);
    });

    it('closes brand-wide below the activation threshold and moves no one', async () => {
        getParticipants.resolves(participants(9, null));

        await closeElapsedLeaderboardPeriod(HABITS, now);

        expect(closePeriod.calledOnce).to.equal(true);
        expect(insertLeagueResults.called).to.equal(false);
    });

    it('writes league-relative results and applies the moves at or above the threshold', async () => {
        getParticipants.resolves(participants(10, null));

        const written = await closeElapsedLeaderboardPeriod(HABITS, now);

        expect(written).to.equal(10);
        expect(closePeriod.called).to.equal(false);
        const [, periodStart, rows] = insertLeagueResults.firstCall.args;
        expect(periodStart).to.equal('2026-09-07');
        expect(rows.filter((row: any) => row.leagueTo === 'sprout')).to.have.length(2);
        expect(applyLeagueMoves.calledOnceWith(HABITS, '2026-09-07')).to.equal(true);
        expect(applyLeagueMoves.calledAfter(insertLeagueResults)).to.equal(true);
    });

    it('still applies the frozen moves when the results were already written (crash between the writes)', async () => {
        hasResults.resolves(true);

        await closeElapsedLeaderboardPeriod(HABITS, now);

        expect(insertLeagueResults.called).to.equal(false);
        expect(applyLeagueMoves.calledOnce).to.equal(true);
    });

    it('decides league mode from how the elapsed period was closed', async () => {
        getParticipants.resolves(participants(10, null));
        const wasClosedWithLeagues = sinon.stub(Store.leaderboardPeriodResults, 'wasClosedWithLeagues').resolves(true);
        sinon.stub(Store.userLeaderboardLeagues, 'getLeagueForUser').resolves(null);

        expect(await areLeaguesActiveForBrand(HABITS, now)).to.equal(true);
        expect(await getActiveLeagueForUser(HABITS, 'user-1', now)).to.equal('seedling');
        // Memoised for the week: one lookup however many reads follow.
        expect(wasClosedWithLeagues.calledOnce).to.equal(true);
        expect(await areLeaguesActiveForBrand(BrandVariations.THERR, now)).to.equal(false);
    });

    it('reads a user\'s league once per week, not on every XP award', async () => {
        getParticipants.resolves(participants(10, null));
        sinon.stub(Store.leaderboardPeriodResults, 'wasClosedWithLeagues').resolves(true);
        const getLeagueForUser = sinon.stub(Store.userLeaderboardLeagues, 'getLeagueForUser').resolves('oak');

        expect(await getActiveLeagueForUser(HABITS, 'user-1', now)).to.equal('oak');
        expect(await getActiveLeagueForUser(HABITS, 'user-1', now)).to.equal('oak');
        expect(getLeagueForUser.calledOnce).to.equal(true);

        // The next week's close may have moved them: read again.
        getLeagueForUser.resolves('evergreen');
        expect(await getActiveLeagueForUser(HABITS, 'user-1', new Date('2026-09-23T12:00:00.000Z'))).to.equal('evergreen');
        expect(getLeagueForUser.calledTwice).to.equal(true);
    });

    it('falls back to the brand-wide board when the lookup fails', async () => {
        hasResults.rejects(new Error('db down'));

        expect(await areLeaguesActiveForBrand(HABITS, now)).to.equal(false);
        expect(await getActiveLeagueForUser(HABITS, 'user-1', now)).to.equal(undefined);
    });
});

describe('leaderboard league SQL', () => {
    const buildStores = () => {
        const read = sinon.stub().resolves({ rows: [{ count: '0' }] });
        const write = sinon.stub().resolves({ rows: [], rowCount: 3 });
        const connection = { read: { query: read }, write: { query: write } } as any;
        return {
            read,
            write,
            scores: new UserLeaderboardScoresStore(connection),
            results: new LeaderboardPeriodResultsStore(connection),
        };
    };

    it('puts users with no stored league, or a retired one, in the lowest league', async () => {
        const { read, scores } = buildStores();

        await scores.getTopScores(HABITS, { periodStart: '2026-09-14', league: 'seedling' });

        const sql: string = read.firstCall.args[0];
        expect(sql).to.contain('left join "main"."userLeaderboardLeagues"');
        expect(sql).to.contain('"main"."userLeaderboardLeagues"."league" is null');
        expect(sql).to.contain('"main"."userLeaderboardLeagues"."league" not in (\'sprout\'');
        expect(sql).to.contain('"main"."userLeaderboardLeagues"."brandVariation" = "main"."userLeaderboardScores"."brandVariation"');
    });

    it('orders weekly ties by who reached the score first, the order the close promotes in', async () => {
        const { read, scores } = buildStores();

        await scores.getTopScores(HABITS, { periodStart: '2026-09-14', league: 'seedling' });
        await scores.getEligibleParticipantsForPeriod(HABITS, '2026-09-07');

        expect(read.firstCall.args[0]).to.contain(
            'order by "main"."userLeaderboardScores"."points" desc, "main"."userLeaderboardScores"."updatedAt" asc',
        );
        expect(read.secondCall.args[0]).to.contain('"main"."userLeaderboardScores"."updatedAt" as "reachedAt"');
    });

    it('matches a higher league exactly', async () => {
        const { read, scores } = buildStores();

        await scores.getRankForScore(HABITS, 40, { periodStart: '2026-09-14', league: 'oak' });

        expect(read.firstCall.args[0]).to.contain('"main"."userLeaderboardLeagues"."league" = \'oak\'');
    });

    it('leaves the brand-wide board unfiltered', async () => {
        const { read, scores } = buildStores();

        await scores.getRankForScore(HABITS, 40, { periodStart: '2026-09-14' });

        expect(read.firstCall.args[0]).to.not.contain('userLeaderboardLeagues');
    });

    it('applies moves from the frozen results, quoted, and only forward in time', async () => {
        const { write, results } = buildStores();

        const moved = await results.applyLeagueMoves(HABITS, '2026-09-07');

        const sql: string = write.firstCall.args[0];
        expect(moved).to.equal(3);
        expect(sql).to.contain('INSERT INTO main."userLeaderboardLeagues" AS l');
        expect(sql).to.contain('FROM main."leaderboardPeriodResults" r');
        expect(sql).to.contain('r."leagueTo" IS NOT NULL');
        expect(sql).to.contain('l."lastPeriodStart" < excluded."lastPeriodStart"');
        expect(sql).to.not.match(/main\.userLeaderboardLeagues\b/);
    });

    const buildTransactionalStore = (failOnInsert?: number) => {
        let inserts = 0;
        const clientQuery = sinon.stub().callsFake((sql: string) => {
            if (sql.startsWith('insert')) {
                inserts += 1;
                if (inserts === failOnInsert) {
                    return Promise.reject(new Error('chunk failed'));
                }
                return Promise.resolve({ rows: [], rowCount: 500 });
            }
            return Promise.resolve({ rows: [] });
        });
        const release = sinon.stub();
        const connection = {
            read: { query: sinon.stub() },
            write: { query: sinon.stub(), connect: sinon.stub().resolves({ query: clientQuery, release }) },
        } as any;
        return { clientQuery, release, results: new LeaderboardPeriodResultsStore(connection) };
    };
    const leagueRows = (count: number) => Array.from({ length: count }, (_, index) => ({
        userId: `u-${index}`, placement: index + 1, score: 1, participants: count, leagueFrom: 'seedling', leagueTo: 'seedling',
    }));

    it('writes league results first-writer-wins, in chunks, in one transaction', async () => {
        const { clientQuery, release, results } = buildTransactionalStore();

        await results.insertLeagueResults(HABITS, '2026-09-07', leagueRows(501));

        const statements: string[] = clientQuery.getCalls().map((call) => call.args[0]);
        expect(statements[0]).to.equal('BEGIN');
        expect(statements.filter((sql) => sql.startsWith('insert'))).to.have.length(2);
        expect(statements[statements.length - 1]).to.equal('COMMIT');
        expect(statements[1]).to.contain('on conflict ("brandVariation", "periodStart", "userId") do nothing');
        expect(statements[1]).to.contain('\'habits\'');
        expect(release.calledOnce).to.equal(true);
    });

    it('leaves no partial close behind when a later chunk fails', async () => {
        const { clientQuery, release, results } = buildTransactionalStore(2);

        let thrown: Error | undefined;
        await results.insertLeagueResults(HABITS, '2026-09-07', leagueRows(501)).catch((err) => { thrown = err; });

        const statements: string[] = clientQuery.getCalls().map((call) => call.args[0]);
        expect(thrown?.message).to.equal('chunk failed');
        expect(statements).to.include('ROLLBACK');
        expect(statements).to.not.include('COMMIT');
        expect(release.calledOnce).to.equal(true);
    });
});

describe('GET /users/leaderboards — league scope', () => {
    let restoreEnv: () => void;

    const buildRes = () => {
        const res: any = {};
        res.status = sinon.stub().returns(res);
        res.send = sinon.stub().returns(res);
        return res;
    };
    const request = (scope: string) => ({
        headers: { 'x-userid': 'user-1', 'x-brand-variation': HABITS },
        query: { scope, period: 'allTime' },
    });

    beforeEach(() => {
        resetClosedPeriodMemo();
        restoreEnv = withLeagueEnv({ LEADERBOARD_LEAGUES_BRANDS: 'habits' });
        sinon.stub(Store.leaderboardPeriodResults, 'hasResultsForPeriod').resolves(true);
        sinon.stub(Store.leaderboardPeriodResults, 'applyLeagueMoves').resolves(0);
        sinon.stub(Store.userLeaderboardScores, 'getTopScores').resolves([
            {
                userId: 'user-2', points: 40, userName: 'two', league: 'oak',
            },
        ]);
        sinon.stub(Store.userLeaderboardScores, 'getUserScore').resolves(20);
        sinon.stub(Store.userLeaderboardScores, 'getRankForScore').resolves(2);
        sinon.stub(Store.userLeaderboardScores, 'countParticipants').resolves(10);
        sinon.stub(Store.userDailyStreaks, 'getCurrentStreaksForUsers').resolves({});
        sinon.stub(Store.userLeaderboardLeagues, 'getLeagueForUser').resolves('oak');
    });

    afterEach(() => {
        sinon.restore();
        restoreEnv();
        resetClosedPeriodMemo();
    });

    it('ranks the requester\'s league, weekly, and describes it', async () => {
        sinon.stub(Store.leaderboardPeriodResults, 'wasClosedWithLeagues').resolves(true);
        const res = buildRes();

        await getLeaderboard(request('league') as any, res, () => null);

        const body = res.send.firstCall.args[0];
        expect(body.scope).to.equal('league');
        expect(body.period).to.equal('week');
        expect((Store.userLeaderboardScores.getTopScores as sinon.SinonStub).firstCall.args[1].league).to.equal('oak');
        expect((Store.userLeaderboardScores.getRankForScore as sinon.SinonStub).firstCall.args[2].league).to.equal('oak');
        expect(body.league).to.deep.equal({
            id: 'oak', leagueIndex: 4, leagueCount: 6, size: 10, promoteCount: 2, demoteCount: 2,
        });
        expect(body.entries[0].league).to.equal('oak');
    });

    it('serves the global board, and no league, while leagues are not active', async () => {
        sinon.stub(Store.leaderboardPeriodResults, 'wasClosedWithLeagues').resolves(false);
        const res = buildRes();

        await getLeaderboard(request('league') as any, res, () => null);

        const body = res.send.firstCall.args[0];
        expect(body.scope).to.equal('global');
        expect(body.period).to.equal('allTime');
        expect(body.league).to.equal(null);
        expect((Store.userLeaderboardScores.getTopScores as sinon.SinonStub).firstCall.args[1].league).to.equal(undefined);
    });
});
