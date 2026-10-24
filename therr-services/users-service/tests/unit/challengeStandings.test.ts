import { expect } from 'chai';
import { randomBytes } from 'crypto';
import {
    JOIN_TOKEN_RE,
    describeChallengeTiming,
    generateJoinToken,
    getChallengeEndDate,
    rankChallengeStandings,
} from '../../src/utilities/challengeStandings';

const tally = (userName: string, checkinDays: number, totalAmount = 0, joinedAt = '2026-10-01T00:00:00Z') => ({
    userId: `id-${userName}`,
    userName,
    firstName: null,
    joinedAt,
    checkinDays,
    totalAmount,
    lastCheckinDate: null,
});

describe('challengeStandings', () => {
    describe('rankChallengeStandings', () => {
        it('ranks a yes/no habit by days checked in', () => {
            const ranked = rankChallengeStandings([tally('a', 2), tally('b', 5), tally('c', 3)], false);
            expect(ranked.map((row) => [row.userName, row.rank])).to.deep.equal([['b', 1], ['c', 2], ['a', 3]]);
        });

        it('ranks a measured habit by amount, so one long run beats several short walks', () => {
            const ranked = rankChallengeStandings([tally('walker', 6, 6), tally('runner', 2, 20)], true);
            expect(ranked[0].userName).to.equal('runner');
        });

        it('breaks an amount tie on days', () => {
            const ranked = rankChallengeStandings([tally('a', 2, 10), tally('b', 4, 10)], true);
            expect(ranked.map((row) => [row.userName, row.rank])).to.deep.equal([['b', 1], ['a', 2]]);
        });

        it('shares a rank on a full tie and skips the next one (1, 1, 3)', () => {
            const ranked = rankChallengeStandings([
                tally('late', 3, 0, '2026-10-05T00:00:00Z'),
                tally('early', 3, 0, '2026-10-01T00:00:00Z'),
                tally('last', 1),
            ], false);
            expect(ranked.map((row) => [row.userName, row.rank])).to.deep.equal([['early', 1], ['late', 1], ['last', 3]]);
        });

        it('shares a rank across a three-way tie', () => {
            const ranked = rankChallengeStandings([tally('a', 0), tally('b', 0), tally('c', 0)], false);
            expect(ranked.map((row) => row.rank)).to.deep.equal([1, 1, 1]);
        });
    });

    describe('dates', () => {
        it('ends a 30-day challenge on its 30th day, inclusive', () => {
            expect(getChallengeEndDate('2026-10-23', 30)).to.equal('2026-11-21');
            expect(getChallengeEndDate('2026-10-23', 7)).to.equal('2026-10-29');
        });

        it('counts today among the days left, and nothing once ended', () => {
            expect(describeChallengeTiming('2026-10-23', '2026-10-29', '2026-10-23')).to.deep.equal({
                hasStarted: true, hasEnded: false, daysLeft: 7, durationDays: 7,
            });
            expect(describeChallengeTiming('2026-10-23', '2026-10-29', '2026-10-29').daysLeft).to.equal(1);
            expect(describeChallengeTiming('2026-10-23', '2026-10-29', '2026-10-30')).to.include({ hasEnded: true, daysLeft: 0 });
        });

        it('reports the full window for a viewer whose day is still before the start', () => {
            // A viewer west of the creator can be a day behind the start date.
            expect(describeChallengeTiming('2026-10-23', '2026-10-29', '2026-10-22')).to.include({
                hasStarted: false, daysLeft: 7,
            });
        });
    });

    describe('generateJoinToken', () => {
        it('makes 12 base62 characters', () => {
            for (let i = 0; i < 50; i += 1) {
                expect(generateJoinToken(randomBytes)).to.match(JOIN_TOKEN_RE);
            }
        });

        it('rejects bytes that would bias the alphabet', () => {
            // Every byte >= 248 must be skipped; 255s alone would loop forever, so mix in a 0.
            let call = 0;
            const fake = (size: number) => {
                call += 1;
                return Buffer.alloc(size, call % 2 ? 255 : 0);
            };
            expect(generateJoinToken(fake)).to.equal('AAAAAAAAAAAA');
        });
    });
});
