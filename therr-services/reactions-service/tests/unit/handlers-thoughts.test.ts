import { expect } from 'chai';
import sinon from 'sinon';
import * as internalRest from 'therr-js-utilities/internal-rest-request';
import Store from '../../src/store';
import { MAX_STREAM_SCAN_PASSES, searchActiveThoughts } from '../../src/handlers/thoughts';

/**
 * `searchActiveThoughts` serves two different surfaces off one handler:
 *
 *  - the activated stream (no `authorId`), which is ranked by the relevance score the
 *    thought distributor stamped onto each reaction row, and
 *  - an author's profile (`authorId` set), which is reverse-chronological and — for your own
 *    or a friend's profile — is not even restricted to thoughts you have activated
 *    (see `ThoughtsStore.find`).
 *
 * Applying the stream's relevance ranking to the profile hoists whichever of the author's
 * thoughts happen to sit in the viewer's stream above the rest, so these pin the split.
 */
describe('searchActiveThoughts', () => {
    let requestStub: sinon.SinonStub;
    let reactionsGetStub: sinon.SinonStub;

    before(() => {
        process.env.NODE_ENV = process.env.NODE_ENV || 'development';
    });

    const buildRes = () => {
        const res: any = { statusCode: undefined, body: undefined };
        res.status = (code: number) => {
            res.statusCode = code;
            return res;
        };
        res.send = (body: any) => {
            res.body = body;
            return res;
        };
        return res;
    };

    const buildReq = (body: any) => ({
        headers: {
            'x-userid': 'user-1',
            'x-localecode': 'en-us',
            'x-brand-variation': 'therr',
        },
        body: {
            limit: 21,
            offset: 0,
            blockedUsers: [],
            ...body,
        },
    });

    beforeEach(() => {
        // Reactions come back ranked: thought-c first, then thought-a, then thought-b.
        reactionsGetStub = sinon.stub(Store.thoughtReactions, 'get').resolves([
            { thoughtId: 'thought-c', userId: 'user-1' },
            { thoughtId: 'thought-a', userId: 'user-1' },
            { thoughtId: 'thought-b', userId: 'user-1' },
        ] as any);
        sinon.stub(Store.thoughtReactions, 'getCounts').resolves([] as any);
        // The thoughts lookup answers in its own (content-recency) order.
        requestStub = sinon.stub(internalRest, 'internalRestRequest').resolves({
            data: {
                thoughts: [
                    { id: 'thought-a', fromUserId: 'author-1' },
                    { id: 'thought-b', fromUserId: 'author-1' },
                    { id: 'thought-c', fromUserId: 'author-1' },
                ],
                isLastPage: false,
            },
        } as any);
    });

    afterEach(() => {
        sinon.restore();
    });

    it('orders the stream by reaction relevance rather than content recency', async () => {
        const res = buildRes();

        await searchActiveThoughts(buildReq({}), res);

        expect(reactionsGetStub.args[0][2].orderBy).to.eq('relevance');
        expect(res.body.thoughts.map((t: any) => t.id)).to.deep.equal(['thought-c', 'thought-a', 'thought-b']);
    });

    it('leaves an author profile in the order the thoughts lookup returned', async () => {
        const res = buildRes();

        await searchActiveThoughts(buildReq({ authorId: 'author-1' }), res);

        expect(reactionsGetStub.args[0][2].orderBy).to.eq('createdAt');
        expect(res.body.thoughts.map((t: any) => t.id)).to.deep.equal(['thought-a', 'thought-b', 'thought-c']);
    });

    it('drops the createdAt cursor on the stream but keeps it for an author profile', async () => {
        const lastContentCreatedAt = '2026-07-01T00:00:00.000Z';

        await searchActiveThoughts(buildReq({ lastContentCreatedAt }), buildRes());
        expect(requestStub.args[0][1].data.lastContentCreatedAt).to.eq(undefined);

        await searchActiveThoughts(buildReq({ lastContentCreatedAt, authorId: 'author-1' }), buildRes());
        expect(requestStub.args[1][1].data.lastContentCreatedAt).to.eq(lastContentCreatedAt);
    });

    /**
     * Reaction rows carry no brand, so a habits viewer with a Therr history gets reaction pages
     * the users-service lookup filters down to nothing. The stream has to read past them rather
     * than answer "empty, but not the last page" — which the habits feed rendered as empty.
     */
    describe('reading past thoughts the brand cannot see', () => {
        const reactionPage = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => ({
            thoughtId: `${prefix}-${i}`,
            userId: 'user-1',
        }));

        it('reads the next reaction page when the lookup filtered this one out', async () => {
            reactionsGetStub.reset();
            reactionsGetStub.onCall(0).resolves(reactionPage('therr', 4));
            reactionsGetStub.onCall(1).resolves(reactionPage('habits', 4));
            requestStub.reset();
            requestStub.onCall(0).resolves({ data: { thoughts: [], isLastPage: true } });
            requestStub.onCall(1).resolves({
                data: {
                    thoughts: [
                        { id: 'habits-1', fromUserId: 'author-1' },
                        { id: 'habits-0', fromUserId: 'author-1' },
                    ],
                    isLastPage: true,
                },
            });
            const res = buildRes();

            await searchActiveThoughts(buildReq({ limit: 4, offset: 8 }), res);

            expect(reactionsGetStub.args[1][2].offset).to.eq(12);
            expect(res.body.thoughts.map((t: any) => t.id)).to.deep.equal(['habits-0', 'habits-1']);
            // Every reaction row read is consumed, so the next request starts after both pages.
            expect(res.body.pagination).to.deep.equal({ itemsPerPage: 8, offset: 8, isLastPage: false });
        });

        it('stops after a bounded number of passes', async () => {
            reactionsGetStub.reset();
            reactionsGetStub.resolves(reactionPage('therr', 4));
            requestStub.reset();
            requestStub.resolves({ data: { thoughts: [], isLastPage: true } });
            const res = buildRes();

            await searchActiveThoughts(buildReq({ limit: 4, offset: 0 }), res);

            expect(reactionsGetStub.callCount).to.eq(MAX_STREAM_SCAN_PASSES);
            expect(res.body.thoughts).to.deep.equal([]);
            expect(res.body.pagination).to.deep.equal({
                itemsPerPage: 4 * MAX_STREAM_SCAN_PASSES,
                offset: 0,
                isLastPage: false,
            });
        });

        it('reports the last page once the reactions run out', async () => {
            reactionsGetStub.reset();
            reactionsGetStub.onCall(0).resolves(reactionPage('therr', 4));
            reactionsGetStub.onCall(1).resolves(reactionPage('therr-tail', 1));
            requestStub.reset();
            requestStub.resolves({ data: { thoughts: [], isLastPage: true } });
            const res = buildRes();

            await searchActiveThoughts(buildReq({ limit: 4, offset: 0 }), res);

            expect(reactionsGetStub.callCount).to.eq(2);
            expect(res.body.pagination.isLastPage).to.eq(true);
        });

        it('does not scan an author profile, whose lookup ignores the reaction ids', async () => {
            reactionsGetStub.reset();
            reactionsGetStub.resolves([]);
            requestStub.reset();
            requestStub.resolves({
                data: { thoughts: [{ id: 'own-1', fromUserId: 'user-1' }], isLastPage: true },
            });
            const res = buildRes();

            await searchActiveThoughts(buildReq({ authorId: 'user-1' }), res);

            expect(reactionsGetStub.callCount).to.eq(1);
            // An own or friend profile has thoughts to show without any reaction rows.
            expect(res.body.thoughts.map((t: any) => t.id)).to.deep.equal(['own-1']);
            expect(res.body.pagination.itemsPerPage).to.eq(21);
        });
    });
});
