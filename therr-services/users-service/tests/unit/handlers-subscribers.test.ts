import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import { createSubscriber } from '../../src/handlers/subscribers';

/**
 * The iOS waitlist path through createSubscriber.
 *
 * The landing pages on therr.com and habits.therr.com have no App Store link — neither app
 * has a published iOS build — so their iOS button opens a dialog whose email field posts
 * here with `isSubscribedToIosWaitlist`. Two behaviours are what make the resulting rows
 * worth anything, and both are easy to regress silently:
 *
 *   1. An address ALREADY on the general marketing list is upgraded rather than rejected.
 *      The old 400 threw away the demand signal for exactly the people most engaged with
 *      the product, and the visitor saw an error for doing nothing wrong.
 *   2. The brand the request came from is stamped on the row. Without it "how many Friends
 *      with Habits users want iPhone" is unanswerable from the table.
 *
 * A plain re-subscribe (no waitlist flag) must still 400, because therr-landing's signup
 * form relies on that to tell a visitor they are already subscribed.
 */
describe('Subscribers Handler', () => {
    afterEach(() => {
        sinon.restore();
    });

    const buildRes = () => {
        const res: any = {};
        res.statusCode = null;
        res.body = null;
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

    const buildReq = (body: any, brandVariation?: string) => ({
        headers: {
            'x-localecode': 'en-us',
            ...(brandVariation ? { 'x-brand-variation': brandVariation } : {}),
        },
        body,
    });

    describe('createSubscriber', () => {
        it('stamps the requesting brand on a new waitlist row', async () => {
            sinon.stub(Store.subscribers, 'findSubscriber').resolves([]);
            const createStub = sinon.stub(Store.subscribers, 'createSubscriber')
                .resolves([{ id: 'sub-1', email: 'streakqueen@example.com' }]);

            const res = buildRes();
            await createSubscriber(buildReq({
                email: 'streakqueen@example.com',
                isSubscribedToIosWaitlist: true,
            }, 'habits') as any, res, (() => {}) as any);

            expect(createStub.args[0][0]).to.deep.equal({
                email: 'streakqueen@example.com',
                brandVariation: 'habits',
                isSubscribedToIosWaitlist: true,
            });
            expect(res.statusCode).to.eq(201);
        });

        it('defaults the brand to therr when the header is absent', async () => {
            sinon.stub(Store.subscribers, 'findSubscriber').resolves([]);
            const createStub = sinon.stub(Store.subscribers, 'createSubscriber').resolves([{ id: 'sub-1' }]);

            await createSubscriber(
                buildReq({ email: 'nobrand@example.com' }) as any,
                buildRes(),
                (() => {}) as any,
            );

            expect(createStub.args[0][0]).to.deep.equal({
                email: 'nobrand@example.com',
                brandVariation: 'therr',
                isSubscribedToIosWaitlist: false,
            });
        });

        it('never forwards unknown body keys to the insert', async () => {
            // The gateway proxies the body verbatim and the store spreads what it is given
            // into the INSERT column list, so an unexpected key would make the query throw.
            sinon.stub(Store.subscribers, 'findSubscriber').resolves([]);
            const createStub = sinon.stub(Store.subscribers, 'createSubscriber').resolves([{ id: 'sub-1' }]);

            await createSubscriber(buildReq({
                email: 'crafted@example.com',
                isSubscribedToMarketing: false,
                somethingElse: 'DROP TABLE',
            }) as any, buildRes(), (() => {}) as any);

            expect(Object.keys(createStub.args[0][0])).to.have.members([
                'email', 'brandVariation', 'isSubscribedToIosWaitlist',
            ]);
        });

        it('upgrades an existing general subscriber onto the waitlist', async () => {
            sinon.stub(Store.subscribers, 'findSubscriber')
                .resolves([{ id: 'sub-1', email: 'streakqueen@example.com', isSubscribedToIosWaitlist: false }]);
            const updateStub = sinon.stub(Store.subscribers, 'updateSubscriber')
                .resolves([{ id: 'sub-1', isSubscribedToIosWaitlist: true }]);
            const createStub = sinon.stub(Store.subscribers, 'createSubscriber').resolves([]);

            const res = buildRes();
            await createSubscriber(buildReq({
                email: 'streakqueen@example.com',
                isSubscribedToIosWaitlist: true,
            }, 'habits') as any, res, (() => {}) as any);

            expect(updateStub.args[0][0]).to.deep.equal({ isSubscribedToIosWaitlist: true });
            expect(updateStub.args[0][1]).to.deep.equal({ email: 'streakqueen@example.com' });
            expect(createStub.called).to.eq(false);
            expect(res.statusCode).to.eq(200);
        });

        it('treats a repeat waitlist submission as success rather than an error', async () => {
            sinon.stub(Store.subscribers, 'findSubscriber')
                .resolves([{ id: 'sub-1', email: 'streakqueen@example.com', isSubscribedToIosWaitlist: true }]);
            const updateStub = sinon.stub(Store.subscribers, 'updateSubscriber').resolves([]);

            const res = buildRes();
            await createSubscriber(buildReq({
                email: 'streakqueen@example.com',
                isSubscribedToIosWaitlist: true,
            }) as any, res, (() => {}) as any);

            expect(res.statusCode).to.eq(200);
            expect(updateStub.called).to.eq(false);
        });

        it('still rejects a plain duplicate subscribe, which therr-landing depends on', async () => {
            sinon.stub(Store.subscribers, 'findSubscriber')
                .resolves([{ id: 'sub-1', email: 'streakqueen@example.com', isSubscribedToIosWaitlist: false }]);
            const updateStub = sinon.stub(Store.subscribers, 'updateSubscriber').resolves([]);

            const res = buildRes();
            await createSubscriber(
                buildReq({ email: 'streakqueen@example.com' }) as any,
                res,
                (() => {}) as any,
            );

            expect(res.statusCode).to.eq(400);
            expect(updateStub.called).to.eq(false);
        });

        it('requires an email address', async () => {
            const res = buildRes();
            await createSubscriber(buildReq({}) as any, res, (() => {}) as any);

            expect(res.statusCode).to.eq(400);
        });
    });
});
