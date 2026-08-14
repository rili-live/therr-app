import { expect } from 'chai';
import sinon from 'sinon';
import { AccessLevels } from 'therr-js-utilities/constants';
import stripe from '../../src/api/stripe';
import Store from '../../src/store';
import {
    applyCheckoutSessionAccessLevels,
    doesSessionEmailMatchAccount,
    mergeAccessLevels,
    resolveAccessLevelsForAccountEmail,
    resolveCheckoutSessionGrant,
} from '../../src/handlers/helpers/checkoutSessionAccessLevels';

// From `productIdMap` in payment-webhook-handlers. Using the real id keeps this test honest:
// if the map is re-keyed, these fail rather than passing against a fixture that agrees with
// nothing in production.
const BASIC_PRODUCT_ID = 'prod_OK9dEHmueTGDZ1';

const buildSession = (overrides: any = {}) => ({
    mode: 'subscription',
    status: 'complete',
    payment_status: 'paid',
    customer_details: { email: 'buyer@test.com' },
    customer_email: null,
    subscription: {
        status: 'active',
        items: {
            data: [{ price: { product: BASIC_PRODUCT_ID } }],
        },
    },
    ...overrides,
});

const stubSession = (session: any) => sinon.stub(stripe.checkout.sessions, 'retrieve').resolves(session);

describe('checkoutSessionAccessLevels', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('resolveCheckoutSessionGrant', () => {
        it('maps a paid, complete subscription session to its plan access level', async () => {
            stubSession(buildSession());

            const grant = await resolveCheckoutSessionGrant('cs_test_paid');

            expect(grant.isGrantable).to.equal(true);
            expect(grant.accessLevels).to.deep.equal([AccessLevels.DASHBOARD_SUBSCRIBER_BASIC]);
            expect(grant.productIds).to.deep.equal([BASIC_PRODUCT_ID]);
            expect(grant.billingEmail).to.equal('buyer@test.com');
        });

        // The regression this helper exists to close: a Checkout Session that only starts a
        // free trial completes with `payment_status: 'no_payment_required'`, so the old
        // `payment_status === 'paid'` gate granted nothing and the upgrade depended entirely
        // on the subscription webhook arriving.
        it('grants on a trialing subscription that required no payment', async () => {
            stubSession(buildSession({
                payment_status: 'no_payment_required',
                subscription: {
                    status: 'trialing',
                    items: { data: [{ price: { product: BASIC_PRODUCT_ID } }] },
                },
            }));

            const grant = await resolveCheckoutSessionGrant('cs_test_trial');

            expect(grant.isGrantable).to.equal(true);
            expect(grant.subscriptionStatus).to.equal('trialing');
            expect(grant.accessLevels).to.deep.equal([AccessLevels.DASHBOARD_SUBSCRIBER_BASIC]);
        });

        it('grants nothing for a session that never completed', async () => {
            stubSession(buildSession({ status: 'open', payment_status: 'unpaid' }));

            const grant = await resolveCheckoutSessionGrant('cs_test_open');

            expect(grant.isGrantable).to.equal(false);
            expect(grant.accessLevels).to.deep.equal([]);
            expect(grant.productIds).to.deep.equal([]);
        });

        it('grants nothing for a subscription in a non-granting status', async () => {
            stubSession(buildSession({
                payment_status: 'unpaid',
                subscription: {
                    status: 'incomplete_expired',
                    items: { data: [{ price: { product: BASIC_PRODUCT_ID } }] },
                },
            }));

            const grant = await resolveCheckoutSessionGrant('cs_test_expired');

            expect(grant.isGrantable).to.equal(false);
            expect(grant.accessLevels).to.deep.equal([]);
        });

        // Regression: `payment_status` is frozen at 'paid' for the life of a session object, so
        // gating on it let a subscriber who had cancelled (and been revoked by
        // `handleSubscriptionDeleted`) replay the session id still sitting in their browser
        // history against `/login?paymentSessionId=` and re-grant themselves the plan for free.
        it('grants nothing once the subscription is cancelled, even though the session still reads paid', async () => {
            stubSession(buildSession({
                payment_status: 'paid',
                subscription: {
                    status: 'canceled',
                    items: { data: [{ price: { product: BASIC_PRODUCT_ID } }] },
                },
            }));

            const grant = await resolveCheckoutSessionGrant('cs_test_cancelled');

            expect(grant.isGrantable).to.equal(false);
            expect(grant.accessLevels).to.deep.equal([]);
        });

        it('grants nothing for a paused, past-due or unpaid subscription on a paid session', async () => {
            // Sequential rather than Promise.all: these share one sinon sandbox, so restoring and
            // re-stubbing concurrently would have each iteration clobber the others' stub.
            // eslint-disable-next-line no-restricted-syntax
            for (const status of ['paused', 'past_due', 'unpaid']) {
                sinon.restore();
                stubSession(buildSession({
                    payment_status: 'paid',
                    subscription: {
                        status,
                        items: { data: [{ price: { product: BASIC_PRODUCT_ID } }] },
                    },
                }));

                // eslint-disable-next-line no-await-in-loop
                const grant = await resolveCheckoutSessionGrant(`cs_test_${status}`);

                expect(grant.isGrantable, `expected ${status} to grant nothing`).to.equal(false);
                expect(grant.accessLevels).to.deep.equal([]);
            }
        });

        it('records the product but grants no level for a product missing from productIdMap', async () => {
            stubSession(buildSession({
                subscription: {
                    status: 'active',
                    items: { data: [{ price: { product: 'prod_not_in_map' } }] },
                },
            }));

            const grant = await resolveCheckoutSessionGrant('cs_test_unknown');

            expect(grant.isGrantable).to.equal(true);
            expect(grant.productIds).to.deep.equal(['prod_not_in_map']);
            expect(grant.accessLevels).to.deep.equal([]);
        });

        it('falls back to customer_email when customer_details carries none', async () => {
            stubSession(buildSession({
                customer_details: { email: null },
                customer_email: 'fallback@test.com',
            }));

            const grant = await resolveCheckoutSessionGrant('cs_test_fallback');

            expect(grant.billingEmail).to.equal('fallback@test.com');
        });
    });

    describe('doesSessionEmailMatchAccount', () => {
        const grant: any = { billingEmail: 'Buyer@Test.com' };

        it('matches regardless of case', () => {
            expect(doesSessionEmailMatchAccount(grant, 'buyer@test.com')).to.equal(true);
        });

        it('rejects a different address', () => {
            expect(doesSessionEmailMatchAccount(grant, 'someone-else@test.com')).to.equal(false);
        });

        it('fails closed when the session carries no billing email', () => {
            expect(doesSessionEmailMatchAccount({ billingEmail: undefined } as any, 'buyer@test.com')).to.equal(false);
        });

        it('fails closed when the account has no email', () => {
            expect(doesSessionEmailMatchAccount(grant, undefined)).to.equal(false);
        });
    });

    describe('resolveAccessLevelsForAccountEmail', () => {
        it('returns the granted levels when the billing email matches the account', async () => {
            stubSession(buildSession());

            const levels = await resolveAccessLevelsForAccountEmail('cs_test', 'buyer@test.com');

            expect(levels).to.deep.equal([AccessLevels.DASHBOARD_SUBSCRIBER_BASIC]);
        });

        // A session id is a bearer token for a purchase, not an account — without the email
        // check, any registration quoting a leaked id would inherit that plan.
        it('returns nothing when a different account claims the session', async () => {
            stubSession(buildSession());

            const levels = await resolveAccessLevelsForAccountEmail('cs_test', 'attacker@test.com');

            expect(levels).to.deep.equal([]);
        });

        it('returns nothing for a session that is not grantable', async () => {
            stubSession(buildSession({ status: 'open', payment_status: 'unpaid' }));

            const levels = await resolveAccessLevelsForAccountEmail('cs_test', 'buyer@test.com');

            expect(levels).to.deep.equal([]);
        });

        // Fails open: registration and sign-in must survive a Stripe outage, since the
        // subscription webhook grants the level independently.
        it('returns nothing rather than throwing when Stripe fails', async () => {
            sinon.stub(stripe.checkout.sessions, 'retrieve').rejects(new Error('Stripe is down'));

            const levels = await resolveAccessLevelsForAccountEmail('cs_test', 'buyer@test.com');

            expect(levels).to.deep.equal([]);
        });
    });

    describe('mergeAccessLevels', () => {
        it('unions granted levels onto the existing ones without dropping any', () => {
            const merged = mergeAccessLevels(
                [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED],
                [AccessLevels.DASHBOARD_SUBSCRIBER_BASIC],
            );

            expect(merged).to.deep.equal([
                AccessLevels.DEFAULT,
                AccessLevels.EMAIL_VERIFIED,
                AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
            ]);
        });

        it('does not duplicate a level the account already holds', () => {
            const merged = mergeAccessLevels(
                [AccessLevels.DEFAULT, AccessLevels.DASHBOARD_SUBSCRIBER_BASIC],
                [AccessLevels.DASHBOARD_SUBSCRIBER_BASIC],
            );

            expect(merged).to.deep.equal([AccessLevels.DEFAULT, AccessLevels.DASHBOARD_SUBSCRIBER_BASIC]);
        });

        it('treats a missing existing list as empty', () => {
            expect(mergeAccessLevels(undefined, [AccessLevels.DASHBOARD_SUBSCRIBER_BASIC]))
                .to.deep.equal([AccessLevels.DASHBOARD_SUBSCRIBER_BASIC]);
        });
    });

    describe('applyCheckoutSessionAccessLevels', () => {
        const userDetails = {
            id: 'user-123',
            email: 'buyer@test.com',
            accessLevels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED],
        };

        it('persists the merged levels and returns the user the token should be minted from', async () => {
            stubSession(buildSession());
            const updateUserStub = sinon.stub(Store.users, 'updateUser').resolves([{}]);

            const result = await applyCheckoutSessionAccessLevels('cs_test', userDetails);

            expect(result.accessLevels).to.deep.equal([
                AccessLevels.DEFAULT,
                AccessLevels.EMAIL_VERIFIED,
                AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
            ]);
            expect(updateUserStub.calledOnce).to.equal(true);
            // The existing levels must survive the write — replacing rather than unioning here
            // would strip EMAIL_VERIFIED and lock the user out of their next login.
            expect(JSON.parse(updateUserStub.firstCall.args[0].accessLevels)).to.include(AccessLevels.EMAIL_VERIFIED);
            expect(updateUserStub.firstCall.args[1]).to.deep.equal({ id: 'user-123' });
        });

        it('does not write when the account already holds the granted level', async () => {
            stubSession(buildSession());
            const updateUserStub = sinon.stub(Store.users, 'updateUser').resolves([{}]);

            const result = await applyCheckoutSessionAccessLevels('cs_test', {
                ...userDetails,
                accessLevels: [AccessLevels.DEFAULT, AccessLevels.DASHBOARD_SUBSCRIBER_BASIC],
            });

            expect(updateUserStub.called).to.equal(false);
            expect(result.accessLevels).to.deep.equal([AccessLevels.DEFAULT, AccessLevels.DASHBOARD_SUBSCRIBER_BASIC]);
        });

        it('does not write when a different account claims the session', async () => {
            stubSession(buildSession({ customer_details: { email: 'someone-else@test.com' } }));
            const updateUserStub = sinon.stub(Store.users, 'updateUser').resolves([{}]);

            const result = await applyCheckoutSessionAccessLevels('cs_test', userDetails);

            expect(updateUserStub.called).to.equal(false);
            expect(result).to.deep.equal(userDetails);
        });

        // A failed upgrade must never cost the user their sign-in.
        it('returns the original user unchanged when the write fails', async () => {
            stubSession(buildSession());
            sinon.stub(Store.users, 'updateUser').rejects(new Error('db is down'));

            const result = await applyCheckoutSessionAccessLevels('cs_test', userDetails);

            expect(result).to.deep.equal(userDetails);
        });
    });
});
