import { expect } from 'chai';
import pickReactionWriteFields from '../../src/utilities/pickReactionWriteFields';

const KINDS: Array<'moment' | 'space' | 'thought' | 'event'> = ['moment', 'space', 'thought', 'event'];

describe('pickReactionWriteFields', () => {
    describe('keeps what real clients send', () => {
        it('keeps the shared reaction fields for every kind', () => {
            const body = {
                userViewCount: 1,
                userHasActivated: true,
                userHasLiked: true,
                userHasSuperLiked: false,
                userHasDisliked: false,
                userHasReported: false,
                userHasSuperDisliked: false,
                userBookmarkCategory: 'Uncategorized',
                userBookmarkPriority: 0,
            };

            KINDS.forEach((kind) => {
                expect(pickReactionWriteFields(kind, body)).to.deep.equal(body);
            });
        });

        it('keeps an explicit null userBookmarkCategory, which is how clients un-bookmark', () => {
            // AreaDisplay/ThoughtDisplay/ViewSpace all toggle a bookmark off by sending null. A
            // `!== undefined` copy would keep it too, but hasOwnProperty is the precise semantic
            // and this is the case that makes it load-bearing.
            const params = pickReactionWriteFields('space', { userBookmarkCategory: null });
            expect(params).to.have.property('userBookmarkCategory');
            expect(params.userBookmarkCategory).to.be.eq(null);
        });

        it('keeps rating on space and event, and drops it on moment and thought', () => {
            expect(pickReactionWriteFields('space', { rating: 5 })).to.deep.equal({ rating: 5 });
            expect(pickReactionWriteFields('event', { rating: 5 })).to.deep.equal({ rating: 5 });
            // Neither table has the column.
            expect(pickReactionWriteFields('moment', { rating: 5 })).to.deep.equal({});
            expect(pickReactionWriteFields('thought', { rating: 5 })).to.deep.equal({});
        });

        it('keeps attendingCount on event — the deployed app RSVPs with it', () => {
            // Not declared in the gateway's createOrUpdateEventReactionValidation, so it only ever
            // reached the table through the `...req.body` spread. Dropping it here would silently
            // break RSVP for installs that cannot be force-updated.
            expect(pickReactionWriteFields('event', { attendingCount: 3 })).to.deep.equal({ attendingCount: 3 });
        });

        it('omits absent fields rather than writing undefined over them', () => {
            const params = pickReactionWriteFields('space', { userHasLiked: true });
            expect(params).to.deep.equal({ userHasLiked: true });
            expect(Object.prototype.hasOwnProperty.call(params, 'rating')).to.be.eq(false);
        });

        it('tolerates an empty, missing, or non-object body', () => {
            expect(pickReactionWriteFields('moment', {})).to.deep.equal({});
            expect(pickReactionWriteFields('moment', undefined)).to.deep.equal({});
            expect(pickReactionWriteFields('moment', null)).to.deep.equal({});
            expect(pickReactionWriteFields('moment', 'not-an-object')).to.deep.equal({});
        });
    });

    // Regression: the handlers spread `...req.body` straight into the store, and the store hands
    // its params object to knex.insert()/knex.update() unfiltered. express-validator at the gateway
    // validates the fields it lists but does not strip the ones it does not, so every column on the
    // table was writable by any authenticated user.
    describe('drops server-owned columns', () => {
        it('drops relevanceScore, scoredAt and algorithmKey on a thought reaction', () => {
            // The feed orders by "relevanceScore" DESC NULLS LAST — a client that could set it
            // pinned any activated thought to the top of its own stream. The distributor still
            // writes these, but via the per-thought relevanceScores map the handler applies itself.
            expect(pickReactionWriteFields('thought', {
                userHasLiked: true,
                relevanceScore: 99999,
                scoredAt: '2026-01-01T00:00:00.000Z',
                algorithmKey: 'pulse',
            })).to.deep.equal({ userHasLiked: true });
        });

        it('drops client-supplied geo on moment, space and event reactions', () => {
            const body = {
                userHasLiked: true,
                contentLatitude: 41.8781,
                contentLongitude: -87.6298,
                contentLocation: 'POINT(-87.6298 41.8781)',
                contentAuthorId: '00000000-0000-0000-0000-000000000001',
            };

            (['moment', 'space', 'event'] as const).forEach((kind) => {
                expect(pickReactionWriteFields(kind, body)).to.deep.equal({ userHasLiked: true });
            });
        });

        it('drops the space visit columns, which are derived from recordVisit server-side', () => {
            expect(pickReactionWriteFields('space', {
                rating: 4,
                recordVisit: true,
                visitCount: 500,
                visitedAt: '2020-01-01T00:00:00.000Z',
                lastVisitedAt: '2020-01-01T00:00:00.000Z',
            })).to.deep.equal({ rating: 4 });
        });

        it('drops identity, audit and archival columns', () => {
            expect(pickReactionWriteFields('moment', {
                id: '00000000-0000-0000-0000-000000000002',
                userId: '00000000-0000-0000-0000-000000000003',
                momentId: '00000000-0000-0000-0000-000000000004',
                userLocale: 'zz-zz',
                createdAt: '2000-01-01T00:00:00.000Z',
                updatedAt: '2000-01-01T00:00:00.000Z',
                updateCount: 0,
                isArchived: true,
            })).to.deep.equal({});
        });

        it('drops the route-scoped keys so they cannot ride into a batch write', () => {
            expect(pickReactionWriteFields('moment', { momentIds: ['a'], userHasActivated: true }))
                .to.deep.equal({ userHasActivated: true });
            expect(pickReactionWriteFields('space', { spaceIds: ['a'], recordVisit: true }))
                .to.deep.equal({});
            expect(pickReactionWriteFields('thought', { thoughtIds: ['a'], relevanceScores: { a: 5 } }))
                .to.deep.equal({});
            expect(pickReactionWriteFields('event', { eventIds: ['a'], userIds: ['b'], eventId: 'c' }))
                .to.deep.equal({});
        });

        it('drops unknown fields entirely rather than passing them through', () => {
            expect(pickReactionWriteFields('space', {
                rating: 3,
                someColumnAddedNextYear: 'value',
            })).to.deep.equal({ rating: 3 });
        });

        it('does not copy prototype keys or inherited properties', () => {
            const body = JSON.parse('{"__proto__": {"polluted": true}, "userHasLiked": true}');
            const params = pickReactionWriteFields('moment', body);

            expect(params).to.deep.equal({ userHasLiked: true });
            expect(({} as any).polluted).to.be.eq(undefined);

            const inherited = Object.create({ rating: 5 });
            inherited.userHasLiked = true;
            expect(pickReactionWriteFields('space', inherited)).to.deep.equal({ userHasLiked: true });
        });
    });
});
