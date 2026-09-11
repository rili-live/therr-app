import { expect } from 'chai';
import sinon from 'sinon';
import { AccessLevels } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import * as googlePlay from '../../src/api/googlePlay';
import { getPremiumOffer, verifyPremiumPurchase } from '../../src/handlers/habitsPremium';

/**
 * The $6.99/month premium subscription.
 *
 * The cases below are the ones where getting it wrong costs real money or a real
 * account: granting on an unverified token, granting a subscription that is not
 * actually active, granting the same token from a second account, and — the one
 * that has bitten this codebase before — replacing rather than extending
 * `accessLevels` and locking the buyer out of their own account
 * (docs/WORK_IN_PROGRESS.md § 1.5).
 */
const PRODUCT_ID = 'habits_premium_monthly';

const futureIso = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

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
        purchaseToken: 'sub-token-abc',
        ...(overrides.body || {}),
    },
});

const activePlaySub = () => ({
    subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
    acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
    latestOrderId: 'GPA.5678',
    startTime: '2026-09-01T00:00:00.000Z',
    lineItems: [{
        productId: PRODUCT_ID,
        expiryTime: futureIso(),
        autoRenewingPlan: { autoRenewEnabled: true },
    }],
});

describe('HABITS premium subscription verification', () => {
    let getSubscriptionStub: sinon.SinonStub;
    let acknowledgeStub: sinon.SinonStub;
    let isConfiguredStub: sinon.SinonStub;
    let getByTokenStub: sinon.SinonStub;
    let upsertStub: sinon.SinonStub;
    let findUserStub: sinon.SinonStub;
    let updateUserStub: sinon.SinonStub;

    beforeEach(() => {
        process.env.HABITS_PREMIUM_PRODUCT_ID = PRODUCT_ID;

        isConfiguredStub = sinon.stub(googlePlay, 'isGooglePlayConfigured').returns(true);
        getSubscriptionStub = sinon.stub(googlePlay, 'getSubscriptionPurchase').resolves(activePlaySub() as any);
        acknowledgeStub = sinon.stub(googlePlay, 'acknowledgeSubscriptionPurchase').resolves();

        getByTokenStub = sinon.stub(Store.subscriptionPurchases, 'getByPurchaseToken').resolves(undefined);
        upsertStub = sinon.stub(Store.subscriptionPurchases, 'upsertByPurchaseToken').resolves({
            purchase: { id: 'sub-1', userId: 'user-1', status: 'active' } as any,
            wasAlreadyRecorded: false,
        });
        sinon.stub(Store.subscriptionPurchases, 'markAcknowledged').resolves({} as any);

        findUserStub = sinon.stub(Store.users, 'findUser').resolves([
            { id: 'user-1', accessLevels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED] },
        ]);
        updateUserStub = sinon.stub(Store.users, 'updateUser').resolves([{ id: 'user-1' }]);
    });

    afterEach(() => {
        sinon.restore();
        delete process.env.HABITS_PREMIUM_PRODUCT_ID;
    });

    it('grants the premium access level on a verified active subscription', async () => {
        const res = makeRes();
        await verifyPremiumPurchase(makeReq() as any, res, (() => {}) as any);

        expect(res.statusCode).to.equal(201);
        expect(res.body.isEntitled).to.equal(true);
        expect(res.body.accessLevels).to.include(AccessLevels.HABITS_PREMIUM);
        expect(updateUserStub.calledOnce).to.equal(true);
    });

    it('EXTENDS accessLevels rather than replacing them', async () => {
        // The regression that locked users out: a merge against an
        // under-selected user record wipes EMAIL_VERIFIED, and login rejects
        // accounts without it.
        const res = makeRes();
        await verifyPremiumPurchase(makeReq() as any, res, (() => {}) as any);

        const written = JSON.parse(updateUserStub.firstCall.args[0].accessLevels);
        expect(written).to.include(AccessLevels.EMAIL_VERIFIED);
        expect(written).to.include(AccessLevels.DEFAULT);
        expect(written).to.include(AccessLevels.HABITS_PREMIUM);
    });

    it('reads accessLevels explicitly when loading the user', async () => {
        const res = makeRes();
        await verifyPremiumPurchase(makeReq() as any, res, (() => {}) as any);

        const selectedColumns = findUserStub.lastCall.args[1];
        expect(selectedColumns).to.include('accessLevels');
    });

    it('refuses a subscription Play does not recognise', async () => {
        getSubscriptionStub.resolves(undefined);

        const res = makeRes();
        await verifyPremiumPurchase(makeReq() as any, res, (() => {}) as any);

        expect(res.statusCode).to.equal(400);
        expect(updateUserStub.called).to.equal(false);
    });

    it('refuses a subscription that is not in an entitling state', async () => {
        getSubscriptionStub.resolves({
            ...activePlaySub(),
            subscriptionState: 'SUBSCRIPTION_STATE_ON_HOLD',
        } as any);

        const res = makeRes();
        await verifyPremiumPurchase(makeReq() as any, res, (() => {}) as any);

        expect(res.statusCode).to.equal(409);
        expect(res.body.error).to.equal('subscription-not-active');
        expect(updateUserStub.called).to.equal(false);
    });

    it('refuses an expired subscription even when the state looks entitling', async () => {
        // A CANCELED subscription still entitles until its paid period ends; an
        // expiry in the past is the line that drops it.
        getSubscriptionStub.resolves({
            ...activePlaySub(),
            subscriptionState: 'SUBSCRIPTION_STATE_CANCELED',
            lineItems: [{
                productId: PRODUCT_ID,
                expiryTime: new Date(Date.now() - 1000).toISOString(),
            }],
        } as any);

        const res = makeRes();
        await verifyPremiumPurchase(makeReq() as any, res, (() => {}) as any);

        expect(res.statusCode).to.equal(409);
        expect(res.body.error).to.equal('subscription-not-active');
    });

    it('still grants for a CANCELED subscription paid through the current period', async () => {
        getSubscriptionStub.resolves({
            ...activePlaySub(),
            subscriptionState: 'SUBSCRIPTION_STATE_CANCELED',
        } as any);

        const res = makeRes();
        await verifyPremiumPurchase(makeReq() as any, res, (() => {}) as any);

        expect(res.statusCode).to.equal(201);
        expect(res.body.accessLevels).to.include(AccessLevels.HABITS_PREMIUM);
    });

    it('refuses a token already claimed by a different account', async () => {
        getByTokenStub.resolves({ id: 'sub-9', userId: 'someone-else' } as any);

        const res = makeRes();
        await verifyPremiumPurchase(makeReq() as any, res, (() => {}) as any);

        expect(res.statusCode).to.equal(409);
        expect(res.body.error).to.equal('subscription-already-claimed');
        expect(upsertStub.called).to.equal(false);
        expect(updateUserStub.called).to.equal(false);
    });

    it('is idempotent when the same account re-submits its own token', async () => {
        upsertStub.resolves({
            purchase: { id: 'sub-1', userId: 'user-1', status: 'active' } as any,
            wasAlreadyRecorded: true,
        });

        const res = makeRes();
        await verifyPremiumPurchase(makeReq() as any, res, (() => {}) as any);

        expect(res.statusCode).to.equal(200);
        expect(res.body.isEntitled).to.equal(true);
    });

    it('rejects a token presented for a different product', async () => {
        const res = makeRes();
        await verifyPremiumPurchase(
            makeReq({ body: { productId: 'some_other_sku' } }) as any,
            res,
            (() => {}) as any,
        );

        expect(res.statusCode).to.equal(400);
        expect(getSubscriptionStub.called).to.equal(false);
    });

    it('rejects a subscription whose line items do not include the expected SKU', async () => {
        getSubscriptionStub.resolves({
            ...activePlaySub(),
            lineItems: [{ productId: 'some_other_sku', expiryTime: futureIso() }],
        } as any);

        const res = makeRes();
        await verifyPremiumPurchase(makeReq() as any, res, (() => {}) as any);

        expect(res.statusCode).to.equal(400);
        expect(updateUserStub.called).to.equal(false);
    });

    it('requires a purchase token', async () => {
        const res = makeRes();
        await verifyPremiumPurchase(
            makeReq({ body: { purchaseToken: undefined } }) as any,
            res,
            (() => {}) as any,
        );

        expect(res.statusCode).to.equal(400);
    });

    it('reports unavailable rather than granting when Play is not configured', async () => {
        isConfiguredStub.returns(false);

        const res = makeRes();
        await verifyPremiumPurchase(makeReq() as any, res, (() => {}) as any);

        expect(res.statusCode).to.equal(503);
        expect(updateUserStub.called).to.equal(false);
    });

    it('acknowledges with Play when the subscription is not yet acknowledged', async () => {
        getSubscriptionStub.resolves({
            ...activePlaySub(),
            acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
        } as any);

        const res = makeRes();
        await verifyPremiumPurchase(makeReq() as any, res, (() => {}) as any);

        expect(acknowledgeStub.calledOnce).to.equal(true);
        expect(res.statusCode).to.equal(201);
    });

    it('still entitles the buyer when acknowledgement fails', async () => {
        getSubscriptionStub.resolves({
            ...activePlaySub(),
            acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
        } as any);
        acknowledgeStub.rejects(new Error('play unavailable'));

        const res = makeRes();
        await verifyPremiumPurchase(makeReq() as any, res, (() => {}) as any);

        expect(res.statusCode).to.equal(201);
        expect(res.body.accessLevels).to.include(AccessLevels.HABITS_PREMIUM);
    });

    it('never returns the purchase token or the raw Play payload', async () => {
        upsertStub.resolves({
            purchase: {
                id: 'sub-1',
                userId: 'user-1',
                status: 'active',
                purchaseToken: 'sub-token-abc',
                linkedPurchaseToken: 'old-token',
                verificationPayload: { subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE' },
            } as any,
            wasAlreadyRecorded: false,
        });

        const res = makeRes();
        await verifyPremiumPurchase(makeReq() as any, res, (() => {}) as any);

        expect(res.body.subscription).to.not.have.property('purchaseToken');
        expect(res.body.subscription).to.not.have.property('linkedPurchaseToken');
        expect(res.body.subscription).to.not.have.property('verificationPayload');
        expect(res.body.subscription.status).to.equal('active');
    });
});

describe('HABITS premium offer endpoint', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('reports entitlement and redacts token fields on the current subscription', async () => {
        sinon.stub(googlePlay, 'isGooglePlayConfigured').returns(true);
        sinon.stub(Store.subscriptionPurchases, 'getActiveByUserId').resolves({
            id: 'sub-1',
            userId: 'user-1',
            status: 'active',
            purchaseToken: 'sub-token-abc',
            verificationPayload: { subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE' },
        } as any);
        sinon.stub(Store.users, 'findUser').resolves([
            { id: 'user-1', accessLevels: [AccessLevels.DEFAULT, AccessLevels.HABITS_PREMIUM] },
        ]);

        const res = makeRes();
        await getPremiumOffer(makeReq() as any, res, (() => {}) as any);

        expect(res.statusCode).to.equal(200);
        expect(res.body.isEntitled).to.equal(true);
        expect(res.body.subscription).to.not.have.property('purchaseToken');
        expect(res.body.subscription).to.not.have.property('verificationPayload');
    });

    it('reports no subscription as null and no entitlement for a free account', async () => {
        sinon.stub(googlePlay, 'isGooglePlayConfigured').returns(true);
        sinon.stub(Store.subscriptionPurchases, 'getActiveByUserId').resolves(undefined);
        sinon.stub(Store.users, 'findUser').resolves([
            { id: 'user-1', accessLevels: [AccessLevels.DEFAULT] },
        ]);

        const res = makeRes();
        await getPremiumOffer(makeReq() as any, res, (() => {}) as any);

        expect(res.body.subscription).to.equal(null);
        expect(res.body.isEntitled).to.equal(false);
    });

    /**
     * The SKU is a Friends with Habits product on a Friends with Habits Play listing.
     * The guard has to suppress it for a client that says it is another brand, without
     * suppressing it for a client that says nothing at all — getBrandContext defaults a
     * missing header to THERR, so keying on the brand alone would hide the paywall from
     * every legacy Habits install, which cannot be force-updated.
     */
    describe('brand scoping', () => {
        beforeEach(() => {
            sinon.stub(googlePlay, 'isGooglePlayConfigured').returns(true);
            sinon.stub(Store.subscriptionPurchases, 'getActiveByUserId').resolves({
                id: 'sub-1', userId: 'user-1', status: 'active',
            } as any);
            sinon.stub(Store.users, 'findUser').resolves([
                { id: 'user-1', accessLevels: [AccessLevels.DEFAULT, AccessLevels.HABITS_PREMIUM] },
            ]);
        });

        it('offers the subscription to a habits client', async () => {
            const res = makeRes();
            await getPremiumOffer(makeReq() as any, res, (() => {}) as any);

            expect(res.body.isBrandSupported).to.equal(true);
            expect(res.body.isStoreConfigured).to.equal(true);
            expect(res.body.subscription).to.not.equal(null);
        });

        it('withholds the offer from a client that declares another brand', async () => {
            const res = makeRes();
            await getPremiumOffer(
                makeReq({ headers: { 'x-brand-variation': 'therr' } }) as any,
                res,
                (() => {}) as any,
            );

            expect(res.body.isBrandSupported).to.equal(false);
            // The flag deployed clients already gate the CTA on.
            expect(res.body.isStoreConfigured).to.equal(false);
            expect(res.body.subscription).to.equal(null);
        });

        it('still reports entitlement truthfully to an unsupported brand', async () => {
            // It describes the caller's own account, and the free-tier gates read the
            // access level whichever client is asking.
            const res = makeRes();
            await getPremiumOffer(
                makeReq({ headers: { 'x-brand-variation': 'therr' } }) as any,
                res,
                (() => {}) as any,
            );

            expect(res.body.isEntitled).to.equal(true);
        });

        it('still offers the subscription when no brand header is sent at all', async () => {
            // A legacy install. getBrandContext calls this THERR; treating that as a
            // real brand declaration would hide the paywall from every one of them.
            const req: any = makeReq();
            delete req.headers['x-brand-variation'];

            const res = makeRes();
            await getPremiumOffer(req, res, (() => {}) as any);

            expect(res.body.isBrandSupported).to.equal(true);
            expect(res.body.isStoreConfigured).to.equal(true);
        });
    });
});
