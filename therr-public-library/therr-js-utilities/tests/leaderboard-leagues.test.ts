import { expect } from 'chai';
import { BrandVariations } from '../src/constants/enums/Branding';
import {
    LEADERBOARD_LEAGUES_BY_BRAND,
    getLeaderboardLeagueIndex,
    getLeaderboardLeagues,
    getLowestLeaderboardLeague,
    resolveLeaderboardLeague,
} from '../src/config/leaderboardLeagues';

describe('leaderboard leagues', () => {
    it('gives Friends with Habits and Therr their own branded ladders', () => {
        expect(getLeaderboardLeagues(BrandVariations.HABITS).map((league) => league.id))
            .to.deep.equal(['seedling', 'sprout', 'sapling', 'bloom', 'oak', 'evergreen']);
        expect(getLeaderboardLeagues(BrandVariations.THERR).map((league) => league.id))
            .to.deep.equal(['wanderer', 'scout', 'pathfinder', 'trailblazer', 'cartographer', 'legend']);
    });

    it('has no leagues for a brand without a leaderboard', () => {
        expect(getLeaderboardLeagues(BrandVariations.TEEM)).to.deep.equal([]);
        expect(getLeaderboardLeagues(undefined)).to.deep.equal([]);
        expect(getLowestLeaderboardLeague(BrandVariations.TEEM)).to.equal(undefined);
        expect(getLeaderboardLeagueIndex(BrandVariations.TEEM, 'seedling')).to.equal(-1);
    });

    it('keeps every persisted id unique within its brand and inside the 50-char column', () => {
        Object.values(LEADERBOARD_LEAGUES_BY_BRAND).forEach((leagues) => {
            const ids = leagues.map((league) => league.id);
            expect(new Set(ids).size).to.equal(ids.length);
            ids.forEach((id) => expect(id.length).to.be.at.most(50));
            expect(leagues.length).to.be.at.least(2);
        });
    });

    it('reads a null, unknown or other-brand id as the lowest league, never as -1', () => {
        expect(getLeaderboardLeagueIndex(BrandVariations.HABITS, null)).to.equal(0);
        expect(getLeaderboardLeagueIndex(BrandVariations.HABITS, 'no-such-league')).to.equal(0);
        expect(getLeaderboardLeagueIndex(BrandVariations.HABITS, 'legend')).to.equal(0);
        expect(getLeaderboardLeagueIndex(BrandVariations.HABITS, 'oak')).to.equal(4);
        expect(resolveLeaderboardLeague(BrandVariations.THERR, undefined)?.id).to.equal('wanderer');
        expect(resolveLeaderboardLeague(BrandVariations.THERR, 'legend')?.id).to.equal('legend');
    });
});
