import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import { createOrUpdateThoughtReaction } from '../../src/handlers/thoughtReactions';

/**
 * These exercise the real handler rather than re-simulating its logic, because the bug
 * they cover lived in the handler's arithmetic and not in anything a re-implementation
 * would reproduce.
 */
describe('reaction metrics — userViewCount accumulation', () => {
    const buildReq = (body: any) => ({
        headers: {
            'x-userid': 'user-123',
            'x-localecode': 'en-us',
        },
        params: { thoughtId: 'thought-123' },
        body,
    });

    const buildRes = () => {
        const res: any = {
            statusCode: undefined,
            body: undefined,
        };
        res.status = (code: number) => {
            res.statusCode = code;
            return res;
        };
        res.send = (payload: any) => {
            res.body = payload;
            return res;
        };
        return res;
    };

    afterEach(() => {
        sinon.restore();
    });

    // Regression: the handler did `existing.userViewCount + (req.body.userViewCount || 0)`.
    // A JSON body may legitimately carry "1" as a string, and `+` on a string concatenates:
    // an existing count of 9 became '91', not 10. Repeating the request grew the column
    // exponentially, defeating the USER_VIEW_COUNT_MAX bound that the gateway and
    // validateReactionMetrics both enforce.
    it('adds a numeric-string userViewCount instead of concatenating it', async () => {
        sinon.stub(Store.thoughtReactions, 'get').resolves([{
            thoughtId: 'thought-123',
            userId: 'user-123',
            userViewCount: 9,
        }]);
        const updateStub = sinon.stub(Store.thoughtReactions, 'update').resolves([{ thoughtId: 'thought-123' }]);

        await createOrUpdateThoughtReaction(buildReq({ userViewCount: '1' }) as any, buildRes());

        const updatePayload = updateStub.args[0][1] as any;
        expect(updatePayload.userViewCount).to.be.a('number');
        expect(updatePayload.userViewCount).to.be.eq(10);
    });

    it('still adds a plain numeric userViewCount', async () => {
        sinon.stub(Store.thoughtReactions, 'get').resolves([{
            thoughtId: 'thought-123',
            userId: 'user-123',
            userViewCount: 9,
        }]);
        const updateStub = sinon.stub(Store.thoughtReactions, 'update').resolves([{ thoughtId: 'thought-123' }]);

        await createOrUpdateThoughtReaction(buildReq({ userViewCount: 1 }) as any, buildRes());

        expect((updateStub.args[0][1] as any).userViewCount).to.be.eq(10);
    });

    it('leaves the existing count untouched when the body omits userViewCount', async () => {
        sinon.stub(Store.thoughtReactions, 'get').resolves([{
            thoughtId: 'thought-123',
            userId: 'user-123',
            userViewCount: 9,
        }]);
        const updateStub = sinon.stub(Store.thoughtReactions, 'update').resolves([{ thoughtId: 'thought-123' }]);

        await createOrUpdateThoughtReaction(buildReq({ userHasLiked: false }) as any, buildRes());

        expect((updateStub.args[0][1] as any).userViewCount).to.be.eq(9);
    });

    it('rejects an out-of-range userViewCount with a 400 before touching the store', async () => {
        const getStub = sinon.stub(Store.thoughtReactions, 'get').resolves([]);
        const res = buildRes();

        await createOrUpdateThoughtReaction(buildReq({ userViewCount: 1000000 }) as any, res);

        expect(res.statusCode).to.be.eq(400);
        expect(getStub.called).to.be.eq(false);
    });
});
