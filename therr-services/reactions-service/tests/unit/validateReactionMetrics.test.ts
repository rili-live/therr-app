import { expect } from 'chai';
import validateReactionMetrics from '../../src/utilities/validateReactionMetrics';

describe('validateReactionMetrics', () => {
    describe('accepts what real clients send', () => {
        it('allows the userViewCount: 1 every client sends', () => {
            expect(validateReactionMetrics({ userViewCount: 1 })).to.be.eq(null);
        });

        it('allows a body with none of the bounded fields', () => {
            expect(validateReactionMetrics({ userHasLiked: true })).to.be.eq(null);
        });

        it('allows an empty body, and a nullish body', () => {
            expect(validateReactionMetrics({})).to.be.eq(null);
            expect(validateReactionMetrics(undefined)).to.be.eq(null);
            expect(validateReactionMetrics(null)).to.be.eq(null);
        });

        it('treats explicit null/undefined fields as absent', () => {
            expect(validateReactionMetrics({ userViewCount: null })).to.be.eq(null);
            expect(validateReactionMetrics({ userViewCount: undefined })).to.be.eq(null);
        });

        it('allows every valid rating when rating is in scope', () => {
            [1, 2, 3, 4, 5].forEach((rating) => {
                expect(validateReactionMetrics({ rating }, { withRating: true })).to.be.eq(null);
            });
        });

        it('accepts numeric strings, since express/JSON bodies can carry them', () => {
            expect(validateReactionMetrics({ userViewCount: '1' })).to.be.eq(null);
            expect(validateReactionMetrics({ rating: '5' }, { withRating: true })).to.be.eq(null);
        });
    });

    // Regression: the check used a bare `Number(value)`, which coerces types that are
    // not metrics at all — `Number([])` is 0, `Number([50])` is 50, `Number(true)` is 1,
    // `Number('')` is 0. Each cleared the bounds and then reached the handlers'
    // `existing.userViewCount + req.body.userViewCount`, where a non-number makes `+`
    // concatenate instead of add.
    describe('rejects non-numeric types that Number() would silently coerce', () => {
        const expected = 'userViewCount must be an integer between 0 and 100';

        it('rejects an array, which Number() coerces to a passing integer', () => {
            expect(validateReactionMetrics({ userViewCount: [] })).to.be.eq(expected);
            expect(validateReactionMetrics({ userViewCount: [50] })).to.be.eq(expected);
        });

        it('rejects a boolean', () => {
            expect(validateReactionMetrics({ userViewCount: true })).to.be.eq(expected);
            expect(validateReactionMetrics({ userViewCount: false })).to.be.eq(expected);
        });

        it('rejects an empty or whitespace-only string', () => {
            expect(validateReactionMetrics({ userViewCount: '' })).to.be.eq(expected);
            expect(validateReactionMetrics({ userViewCount: '   ' })).to.be.eq(expected);
        });

        it('rejects an object', () => {
            expect(validateReactionMetrics({ userViewCount: {} })).to.be.eq(expected);
        });
    });

    describe('rejects unbounded metric inflation', () => {
        it('rejects a userViewCount far above the per-request ceiling', () => {
            // The handlers do `existing.userViewCount + req.body.userViewCount`,
            // so an unbounded value here permanently inflates the running total.
            expect(validateReactionMetrics({ userViewCount: 1000000 }))
                .to.be.eq('userViewCount must be an integer between 0 and 100');
        });

        it('rejects a negative userViewCount', () => {
            expect(validateReactionMetrics({ userViewCount: -50 }))
                .to.be.eq('userViewCount must be an integer between 0 and 100');
        });

        it('rejects a non-integer userViewCount', () => {
            expect(validateReactionMetrics({ userViewCount: 1.5 }))
                .to.be.eq('userViewCount must be an integer between 0 and 100');
        });

        it('rejects a non-numeric userViewCount', () => {
            expect(validateReactionMetrics({ userViewCount: 'lots' }))
                .to.be.eq('userViewCount must be an integer between 0 and 100');
        });

        it('rejects an out-of-range userBookmarkPriority', () => {
            expect(validateReactionMetrics({ userBookmarkPriority: 9999 }))
                .to.be.eq('userBookmarkPriority must be an integer between 0 and 100');
        });
    });

    describe('rating bounds', () => {
        it('rejects a rating above the 1-5 star scale', () => {
            // SpaceReactionsStore avg()s this column into the public space page.
            expect(validateReactionMetrics({ rating: 100000 }, { withRating: true }))
                .to.be.eq('rating must be an integer between 1 and 5');
        });

        it('rejects a rating below the scale, including 0', () => {
            expect(validateReactionMetrics({ rating: 0 }, { withRating: true }))
                .to.be.eq('rating must be an integer between 1 and 5');
            expect(validateReactionMetrics({ rating: -5 }, { withRating: true }))
                .to.be.eq('rating must be an integer between 1 and 5');
        });

        it('ignores rating for content types that have no rating column', () => {
            // moments/thoughts have no `rating`; the field should not be policed there.
            expect(validateReactionMetrics({ rating: 100000 })).to.be.eq(null);
        });
    });

    it('reports the first offending field when several are invalid', () => {
        const result = validateReactionMetrics({
            userViewCount: -1,
            userBookmarkPriority: 9999,
        });

        expect(result).to.be.eq('userViewCount must be an integer between 0 and 100');
    });
});
