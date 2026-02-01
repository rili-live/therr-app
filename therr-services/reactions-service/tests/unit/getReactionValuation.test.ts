/* eslint-disable quotes */
import { expect } from 'chai';
import { CurrentSocialValuations } from 'therr-js-utilities/constants';
import getReactionValuation from '../../src/utilities/getReactionValuation';

describe('getReactionValuation', () => {
    describe('Addition (positive coin value)', () => {
        it('returns bookmark value when adding bookmark', () => {
            const existing = { userBookmarkCategory: null };
            const reqBody = { userBookmarkCategory: 'favorites' };

            const result = getReactionValuation(existing, reqBody);

            expect(result).to.equal(CurrentSocialValuations.bookmark);
        });

        it('returns like value when adding like', () => {
            const existing = { userHasLiked: false };
            const reqBody = { userHasLiked: true };

            const result = getReactionValuation(existing, reqBody);

            expect(result).to.equal(CurrentSocialValuations.like);
        });

        it('returns superLike value when adding super like', () => {
            const existing = { userHasSuperLiked: false };
            const reqBody = { userHasSuperLiked: true };

            const result = getReactionValuation(existing, reqBody);

            expect(result).to.equal(CurrentSocialValuations.superLike);
        });

        it('returns combined value when adding multiple reactions', () => {
            const existing = {
                userBookmarkCategory: null,
                userHasLiked: false,
                userHasSuperLiked: false,
            };
            const reqBody = {
                userBookmarkCategory: 'favorites',
                userHasLiked: true,
                userHasSuperLiked: true,
            };

            const result = getReactionValuation(existing, reqBody);

            const expectedValue = CurrentSocialValuations.bookmark
                + CurrentSocialValuations.like
                + CurrentSocialValuations.superLike;
            expect(result).to.equal(expectedValue);
        });
    });

    describe('Reduction (negative coin value)', () => {
        it('returns negative bookmark value when removing bookmark', () => {
            const existing = { userBookmarkCategory: 'favorites' };
            const reqBody = { userBookmarkCategory: null };

            const result = getReactionValuation(existing, reqBody);

            expect(result).to.equal(-CurrentSocialValuations.bookmark);
        });

        it('returns negative like value when adding dislike', () => {
            const existing = { userHasDisliked: false };
            const reqBody = { userHasDisliked: true };

            const result = getReactionValuation(existing, reqBody);

            expect(result).to.equal(-CurrentSocialValuations.like);
        });

        it('returns negative superLike value when adding super dislike', () => {
            const existing = { userHasSuperDisliked: false };
            const reqBody = { userHasSuperDisliked: true };

            const result = getReactionValuation(existing, reqBody);

            expect(result).to.equal(-CurrentSocialValuations.superLike);
        });
    });

    describe('No change (zero coin value)', () => {
        it('returns 0 when no reaction changes', () => {
            const existing = {
                userBookmarkCategory: 'favorites',
                userHasLiked: true,
                userHasSuperLiked: false,
            };
            const reqBody = {
                userBookmarkCategory: 'favorites',
                userHasLiked: true,
                userHasSuperLiked: false,
            };

            const result = getReactionValuation(existing, reqBody);

            expect(result).to.equal(0);
        });

        it('returns 0 when adding like that already exists', () => {
            const existing = { userHasLiked: true };
            const reqBody = { userHasLiked: true };

            const result = getReactionValuation(existing, reqBody);

            expect(result).to.equal(0);
        });

        it('returns 0 when adding dislike that already exists', () => {
            const existing = { userHasDisliked: true };
            const reqBody = { userHasDisliked: true };

            const result = getReactionValuation(existing, reqBody);

            expect(result).to.equal(0);
        });

        it('returns 0 when removing non-existent bookmark', () => {
            const existing = { userBookmarkCategory: null };
            const reqBody = { userBookmarkCategory: null };

            const result = getReactionValuation(existing, reqBody);

            expect(result).to.equal(0);
        });
    });

    describe('Mixed additions and reductions', () => {
        it('correctly calculates net value for mixed reactions', () => {
            const existing = {
                userBookmarkCategory: 'old-category',
                userHasLiked: false,
                userHasDisliked: false,
            };
            const reqBody = {
                userBookmarkCategory: null,
                userHasLiked: true,
                userHasDisliked: true,
            };

            const result = getReactionValuation(existing, reqBody);

            // -bookmark + like - like = -bookmark
            const expectedValue = CurrentSocialValuations.like
                - CurrentSocialValuations.bookmark
                - CurrentSocialValuations.like;
            expect(result).to.equal(expectedValue);
        });
    });

    describe('Edge cases', () => {
        it('handles empty existing object', () => {
            const existing = {};
            const reqBody = { userHasLiked: true };

            const result = getReactionValuation(existing, reqBody);

            expect(result).to.equal(CurrentSocialValuations.like);
        });

        it('handles undefined values in existing', () => {
            const existing = { userBookmarkCategory: undefined };
            const reqBody = { userBookmarkCategory: 'favorites' };

            const result = getReactionValuation(existing, reqBody);

            expect(result).to.equal(CurrentSocialValuations.bookmark);
        });

        it('handles empty reqBody', () => {
            const existing = { userHasLiked: true };
            const reqBody = {};

            const result = getReactionValuation(existing, reqBody);

            expect(result).to.equal(0);
        });
    });
});
