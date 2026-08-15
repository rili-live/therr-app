import { expect } from 'chai';
import sinon from 'sinon';
import { AccessLevels, HABITS_LIFETIME_FOUNDER_LIMIT } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import * as googlePlay from '../../src/api/googlePlay';
import { verifyLifetimePurchase } from '../../src/handlers/habitsLifetime';

/**
 * The founder "free for life" purchase.
 *
 * The cases below are the ones where getting it wrong costs real money or a
 * real account: granting on an unverified token, granting the same token
 * twice, and — the one that has actually bitten this codebase before —
 * replacing rather than extending `accessLevels` and locking the buyer out of
 * their own account (docs/WORK_IN_PROGRESS.md § 1.5).
 */
const PRODUCT_ID = 'habits_lifetime_founder';

const makeRes = () => {
    const res: any = {
        statusCode: undefined,
        body: undefined,
        status(code: number) {
            res.statusCode = code;
            return res;
        },
        send(payload: any) {
            res.body = payload;
            return res;
        },
    };
    return res;
};

const makeReq = (overrides: any = {}) => ({
    headers: {
        'x-userid': 'user-1',
        'x-localecode': 'en-us',
        'x-brand-variation': 'habits',
        ...(overrides.headers || {}),
    },
    body: {
        platform: 'android',
        productId: PRODUCT_ID,
        purchaseToken: 'token-abc',
        ...(overrides.body || {}),
    },
});

const purchasedPlayResponse = {
    purchaseState: 0,
    acknowledgementState: 1,
    orderId: 'GPA.1234',
    purchaseTimeMillis: '1755000000000',
    priceAmountMicros: '20000000',
    priceCurrencyCode: 'USD',
};

describe('HABITS lifetime purchase verification', () => {
    let getProductPurchaseStub: sinon.SinonStub;
    let acknowledgeStub: sinon.SinonStub;
    let isConfiguredStub: sinon.SinonStub;
    let getByTokenStub: sinon.SinonStub;
    let createWithSlotStub: sinon.SinonStub;
    let findUserStub: sinon.SinonStub;
    let updateUserStub: sinon.SinonStub;

    beforeEach(() => {
        process.env.HABITS_LIFETIME_PRODUCT_ID = PRODUCT_ID;

        isConfiguredStub = sinon.stub(googlePlay, 'isGooglePlayConfigured').returns(true);
        getProductPurchaseStub = sinon.stub(googlePlay, 'getProductPurchase').resolves(purchasedPlayResponse as any);
        acknowledgeStub = sinon.stub(googlePlay, 'acknowledgeProductPurchase').resolves();

        getByTokenStub = sinon.stub(Store.lifetimePurchases, 'getByPurchaseToken').resolves(undefined);
        createWithSlotStub = sinon.stub(Store.lifetimePurchases, 'createWithFounderSlot').resolves({
            purchase: { id: 'purchase-1', founderNumber: 42, userId: 'user-1' } as any,
            wasAlreadyRecorded: false,
        });
        sinon.stub(Store.lifetimePurchases, 'markAcknowledged').resolves({} as any);

        findUserStub = sinon.stub(Store.users, 'findUser').resolves([
            { id: 'user-1', accessLevels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED] },
        ]);
        updateUserStub = sinon.stub(Store.users, 'updateUser').resolves([{ id: 'user-1' }]);
    });

    afterEach(() => {
        sinon.restore();
        delete process.env.HABITS_LIFETIME_PRODUCT_ID;
    });

    it('grants the lifetime access level on a verified purchase', async () => {
        const res = makeRes();
        await verifyLifetimePurchase(makeReq() as any, res, (() => {}) as any);

        expect(res.statusCode).to.equal(201);
        expect(res.body.isEntitled).to.equal(true);
        expect(res.body.accessLevels).to.include(AccessLevels.HABITS_LIFETIME);
        expect(updateUserStub.calledOnce).to.equal(true);
    });

    it('EXTENDS accessLevels rather than replacing them', async () => {
        // The regression that locked users out: a merge against an
        // under-selected user record wipes EMAIL_VERIFIED, and login rejects
        // accounts without it.
        const res = makeRes();
        await verifyLifetimePurchase(makeReq() as any, res, (() => {}) as any);

        const written = JSON.parse(updateUserStub.firstCall.args[0].accessLevels);
        expect(written).to.include(AccessLevels.EMAIL_VERIFIED);
        expect(written).to.include(AccessLevels.DEFAULT);
        expect(written).to.include(AccessLevels.HABITS_LIFETIME);
    });

    it('reads accessLevels explicitly when loading the user', async () => {
        const res = makeRes();
        await verifyLifetimePurchase(makeReq() as any, res, (() => {}) as any);

        const selectedColumns = findUserStub.lastCall.args[1];
        expect(selectedColumns).to.include('accessLevels');
    });

    it('refuses a purchase Play does not recognise', async () => {
        getProductPurchaseStub.resolves(undefined);

        const res = makeRes();
        await verifyLifetimePurchase(makeReq() as any, res, (() => {}) as any);

        expect(res.statusCode).to.equal(400);
        expect(updateUserStub.called).to.equal(false);
    });

    it('refuses a purchase that has not completed', async () => {
        getProductPurchaseStub.resolves({ ...purchasedPlayResponse, purchaseState: 2 } as any);

        const res = makeRes();
        await verifyLifetimePurchase(makeReq() as any, res, (() => {}) as any);

        expect(res.statusCode).to.equal(409);
        expect(res.body.error).to.equal('purchase-not-completed');
        expect(updateUserStub.called).to.equal(false);
    });

    it('refuses a token already claimed by a different account', async () => {
        getByTokenStub.resolves({ id: 'purchase-9', userId: 'someone-else' } as any);

        const res = makeRes();
        await verifyLifetimePurchase(makeReq() as any, res, (() => {}) as any);

        expect(res.statusCode).to.equal(409);
        expect(res.body.error).to.equal('purchase-already-claimed');
        expect(createWithSlotStub.called).to.equal(false);
        expect(updateUserStub.called).to.equal(false);
    });

    it('is idempotent when the same account re-submits its own token', async () => {
        createWithSlotStub.resolves({
            purchase: { id: 'purchase-1', founderNumber: 42, userId: 'user-1' } as any,
            wasAlreadyRecorded: true,
        });

        const res = makeRes();
        await verifyLifetimePurchase(makeReq() as any, res, (() => {}) as any);

        expect(res.statusCode).to.equal(200);
        expect(res.body.isEntitled).to.equal(true);
    });

    it('honours a purchase that lands after the founder limit is reached', async () => {
        // They paid. Refusing to record a completed Play purchase would leave
        // the buyer charged and unentitled, which is worse than one extra seat.
        createWithSlotStub.resolves({
            purchase: { id: 'purchase-1', founderNumber: null, userId: 'user-1' } as any,
            wasAlreadyRecorded: false,
        });

        const res = makeRes();
        await verifyLifetimePurchase(makeReq() as any, res, (() => {}) as any);

        expect(res.statusCode).to.equal(201);
        expect(res.body.accessLevels).to.include(AccessLevels.HABITS_LIFETIME);
    });

    it('passes the configured founder limit to the allocator', async () => {
        const res = makeRes();
        await verifyLifetimePurchase(makeReq() as any, res, (() => {}) as any);

        expect(createWithSlotStub.firstCall.args[1]).to.equal(HABITS_LIFETIME_FOUNDER_LIMIT);
    });

    it('rejects a token presented for a different product', async () => {
        const res = makeRes();
        await verifyLifetimePurchase(
            makeReq({ body: { productId: 'some_other_sku' } }) as any,
            res,
            (() => {}) as any,
        );

        expect(res.statusCode).to.equal(400);
        expect(getProductPurchaseStub.called).to.equal(false);
    });

    it('requires a purchase token', async () => {
        const res = makeRes();
        await verifyLifetimePurchase(
            makeReq({ body: { purchaseToken: undefined } }) as any,
            res,
            (() => {}) as any,
        );

        expect(res.statusCode).to.equal(400);
    });

    it('reports unavailable rather than granting when Play is not configured', async () => {
        isConfiguredStub.returns(false);

        const res = makeRes();
        await verifyLifetimePurchase(makeReq() as any, res, (() => {}) as any);

        expect(res.statusCode).to.equal(503);
        expect(updateUserStub.called).to.equal(false);
    });

    it('acknowledges with Play when the purchase is not yet acknowledged', async () => {
        getProductPurchaseStub.resolves({ ...purchasedPlayResponse, acknowledgementState: 0 } as any);

        const res = makeRes();
        await verifyLifetimePurchase(makeReq() as any, res, (() => {}) as any);

        expect(acknowledgeStub.calledOnce).to.equal(true);
        expect(res.statusCode).to.equal(201);
    });

    it('still entitles the buyer when acknowledgement fails', async () => {
        // Play auto-refunds unacknowledged purchases after three days, so this
        // is worth an alert — but failing the request would push the client
        // into retrying an already-granted purchase.
        getProductPurchaseStub.resolves({ ...purchasedPlayResponse, acknowledgementState: 0 } as any);
        acknowledgeStub.rejects(new Error('play unavailable'));

        const res = makeRes();
        await verifyLifetimePurchase(makeReq() as any, res, (() => {}) as any);

        expect(res.statusCode).to.equal(201);
        expect(res.body.accessLevels).to.include(AccessLevels.HABITS_LIFETIME);
    });
});
