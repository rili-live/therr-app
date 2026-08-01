/**
 * Covers the batched reaction lookups the thought-details view depends on.
 *
 * Both calls fan a whole thread's replies into a single internal request, so the
 * failure mode they have to be pinned against is a *partial* result — a response
 * that looks successful while silently omitting some replies' state. That renders
 * as a like that "won't stick" on exactly the replies the user scrolled to, which
 * is indistinguishable from a client bug from the outside.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import * as internalRestRequestModule from 'therr-js-utilities/internal-rest-request';
import { countReactionsByThoughtId, findReactionsByUser } from '../../src/api/reactions';

const headers: any = {
    'x-platform': 'mobile',
    'x-brand-variation': 'therr',
    'x-localecode': 'en-us',
    'x-userid': 'user-1',
};

describe('reactions API (users-service)', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('findReactionsByUser', () => {
        it('requests a limit that covers the whole batch', async () => {
            const stub = sinon.stub(internalRestRequestModule, 'internalRestRequest')
                .resolves({ data: { reactions: [] } } as any);
            // More replies than the `find/dynamic` default page size of 100.
            const thoughtIds = Array.from({ length: 150 }, (_, i) => `reply-${i}`);

            await findReactionsByUser(thoughtIds, headers);

            const { data } = stub.args[0][1] as any;
            // Pre-fix this sent no limit at all, so the reactions store fell back to 100
            // rows ordered by `createdAt DESC` and dropped the other 50 replies' state.
            expect(data.limit).to.be.at.least(thoughtIds.length);
        });

        it('keys every returned reaction by its thoughtId', async () => {
            sinon.stub(internalRestRequestModule, 'internalRestRequest').resolves({
                data: {
                    reactions: [
                        { thoughtId: 'reply-1', userHasLiked: true },
                        { thoughtId: 'reply-2', userHasLiked: false },
                    ],
                },
            } as any);

            const result = await findReactionsByUser(['reply-1', 'reply-2'], headers);

            expect(result).to.deep.equal({
                'reply-1': { thoughtId: 'reply-1', userHasLiked: true },
                'reply-2': { thoughtId: 'reply-2', userHasLiked: false },
            });
        });

        it('makes no request at all for an empty batch', async () => {
            const stub = sinon.stub(internalRestRequestModule, 'internalRestRequest').resolves({ data: {} } as any);

            const result = await findReactionsByUser([], headers);

            expect(stub.called).to.equal(false);
            expect(result).to.deep.equal({});
        });

        it('degrades to no reactions rather than failing the details view', async () => {
            sinon.stub(internalRestRequestModule, 'internalRestRequest').rejects(new Error('reactions-service down'));

            const result = await findReactionsByUser(['reply-1'], headers);

            expect(result).to.deep.equal({});
        });
    });

    describe('countReactionsByThoughtId', () => {
        it('returns the counts map the reactions service sends', async () => {
            sinon.stub(internalRestRequestModule, 'internalRestRequest').resolves({
                data: { counts: { 'reply-1': 3 } },
            } as any);

            const result = await countReactionsByThoughtId(['reply-1', 'reply-2'], headers);

            // 'reply-2' has no likes, so it has no row to group and is absent rather than 0.
            expect(result).to.deep.equal({ 'reply-1': 3 });
        });

        it('makes no request at all for an empty batch', async () => {
            const stub = sinon.stub(internalRestRequestModule, 'internalRestRequest').resolves({ data: {} } as any);

            const result = await countReactionsByThoughtId([], headers);

            expect(stub.called).to.equal(false);
            expect(result).to.deep.equal({});
        });

        it('degrades to no counts rather than failing the details view', async () => {
            sinon.stub(internalRestRequestModule, 'internalRestRequest').rejects(new Error('reactions-service down'));

            const result = await countReactionsByThoughtId(['reply-1'], headers);

            expect(result).to.deep.equal({});
        });
    });
});
