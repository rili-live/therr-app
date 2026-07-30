/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import * as internalRest from 'therr-js-utilities/internal-rest-request';
import Store from '../../src/store';
import { searchActiveThoughts } from '../../src/handlers/thoughts';

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
});
