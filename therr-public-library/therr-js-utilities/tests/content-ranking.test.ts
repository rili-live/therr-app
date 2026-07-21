import { expect } from 'chai';
import {
    DEFAULT_MAX_AUTO_EXPANDED_PER_PAGE,
    getContentRankingScore,
    getInterestMatchScore,
    selectAutoExpandedThoughtIds,
} from '../src/content-ranking';

const HOUR_MS = 60 * 60 * 1000;
const now = Date.now();
const hoursAgo = (hours: number) => new Date(now - (hours * HOUR_MS)).toISOString();

describe('content-ranking', () => {
    describe('getInterestMatchScore', () => {
        it('returns 0 for empty inputs', () => {
            expect(getInterestMatchScore([], ['interests.music'])).to.equal(0);
            expect(getInterestMatchScore(['interests.music'], [])).to.equal(0);
            expect(getInterestMatchScore(null, undefined)).to.equal(0);
        });

        it('returns 1 for a full overlap of the smaller set', () => {
            expect(getInterestMatchScore(['interests.music'], ['interests.music', 'interests.art'])).to.equal(1);
        });

        it('returns a partial score for partial overlap', () => {
            const score = getInterestMatchScore(['interests.music', 'interests.food'], ['interests.music', 'interests.art']);
            expect(score).to.equal(0.5);
        });
    });

    describe('getContentRankingScore', () => {
        it('scores a brand new post with no engagement at 1.0', () => {
            const score = getContentRankingScore({ createdAt: new Date(now).toISOString() }, undefined, now);
            expect(score).to.be.closeTo(1, 0.001);
        });

        it('returns a pre-computed rankingScore untouched', () => {
            const score = getContentRankingScore({ createdAt: hoursAgo(500), rankingScore: 4.2 }, undefined, now);
            expect(score).to.equal(4.2);
        });

        it('decays with age (half-life)', () => {
            const fresh = getContentRankingScore({ createdAt: hoursAgo(0) }, undefined, now);
            const halfLife = getContentRankingScore({ createdAt: hoursAgo(48) }, undefined, now);
            expect(halfLife).to.be.closeTo(fresh / 2, 0.001);
        });

        it('ranks an engaged thread above an unengaged post of the same age', () => {
            const quiet = getContentRankingScore({ createdAt: hoursAgo(2) }, undefined, now);
            const busy = getContentRankingScore({
                createdAt: hoursAgo(2),
                likeCount: 4,
                replies: [{ id: 'r1' }, { id: 'r2' }],
            }, undefined, now);
            expect(busy).to.be.greaterThan(quiet);
        });

        it('boosts interest-matched content', () => {
            const base = getContentRankingScore({ createdAt: hoursAgo(2) }, undefined, now);
            const matched = getContentRankingScore({ createdAt: hoursAgo(2), interestMatchScore: 1 }, undefined, now);
            expect(matched).to.be.greaterThan(base);
        });
    });

    describe('selectAutoExpandedThoughtIds', () => {
        it('only selects thoughts that have replies', () => {
            const ids = selectAutoExpandedThoughtIds([
                { id: 'no-replies', createdAt: hoursAgo(1) },
                { id: 'with-replies', createdAt: hoursAgo(1), replies: [{ id: 'r1' }] },
            ], { nowMs: now });
            expect(ids).to.deep.equal(['with-replies']);
        });

        it('caps the number of expanded threads per page', () => {
            const thoughts = Array.from({ length: 10 }, (_, i) => ({
                id: `thought-${i}`,
                createdAt: hoursAgo(1),
                replies: [{ id: `r-${i}` }],
            }));
            const ids = selectAutoExpandedThoughtIds(thoughts, { nowMs: now });
            expect(ids.length).to.equal(DEFAULT_MAX_AUTO_EXPANDED_PER_PAGE);
        });

        it('selects the highest scoring threads first', () => {
            const ids = selectAutoExpandedThoughtIds([
                { id: 'quiet', createdAt: hoursAgo(40), replies: [{ id: 'r1' }] },
                {
                    id: 'busy', createdAt: hoursAgo(1), likeCount: 10, replies: [{ id: 'r2' }, { id: 'r3' }],
                },
            ], { maxAutoExpandedPerPage: 1, nowMs: now });
            expect(ids).to.deep.equal(['busy']);
        });

        it('excludes threads below the minimum score', () => {
            const ids = selectAutoExpandedThoughtIds([
                { id: 'ancient', createdAt: hoursAgo(24 * 365), replies: [{ id: 'r1' }] },
            ], { nowMs: now });
            expect(ids).to.deep.equal([]);
        });
    });
});
