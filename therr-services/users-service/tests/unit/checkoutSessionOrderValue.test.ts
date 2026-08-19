import { expect } from 'chai';
import sinon from 'sinon';
import stripe from '../../src/api/stripe';
import { resolveCheckoutSessionGrant } from '../../src/handlers/helpers/checkoutSessionAccessLevels';
import { isValidPlan, PLAN_PRODUCT_IDS, resolvePriceId } from '../../src/handlers/helpers/checkoutSessionPlans';

const buildSession = (overrides: any = {}) => ({
    mode: 'subscription',
    status: 'complete',
    payment_status: 'paid',
    currency: 'usd',
    amount_total: 1499,
    customer_details: { email: 'buyer@example.com' },
    metadata: { plan: 'basic', billingPeriod: 'monthly' },
    subscription: {
        status: 'active',
        currency: 'usd',
        items: { data: [{ price: { product: 'prod_OK9dEHmueTGDZ1', unit_amount: 1499 }, quantity: 1 }] },
    },
    ...overrides,
});

describe('resolveCheckoutSessionGrant order value', () => {
    let retrieveStub: sinon.SinonStub;

    afterEach(() => {
        retrieveStub?.restore();
    });

    const resolveWith = (session: any) => {
        retrieveStub = sinon.stub(stripe.checkout.sessions, 'retrieve').resolves(session as any);
        return resolveCheckoutSessionGrant('cs_test_123');
    };

    it('converts Stripe minor units to major units', async () => {
        // 1499 cents is $14.99. Reporting 1499 to GA4 would overstate revenue
        // a hundredfold with nothing downstream able to detect it.
        const grant = await resolveWith(buildSession());

        expect(grant.value).to.equal(14.99);
        expect(grant.currency).to.equal('USD');
    });

    it('falls back to the recurring amount when a trial totals zero', async () => {
        const grant = await resolveWith(buildSession({ amount_total: 0 }));

        expect(grant.value).to.equal(14.99);
    });

    it('reports no value when neither the session nor the subscription has an amount', async () => {
        const grant = await resolveWith(buildSession({
            amount_total: 0,
            subscription: { status: 'active', currency: 'usd', items: { data: [] } },
        }));

        expect(grant.value).to.equal(undefined);
        expect(grant.currency).to.equal('USD');
    });

    it('passes the plan metadata through for the purchase event', async () => {
        const grant = await resolveWith(buildSession());

        expect(grant.plan).to.equal('basic');
        expect(grant.billingPeriod).to.equal('monthly');
    });

    it('leaves plan metadata undefined for a session created outside this flow', async () => {
        // Purchases made through the legacy Payment Links carry no metadata.
        const grant = await resolveWith(buildSession({ metadata: {} }));

        expect(grant.plan).to.equal(undefined);
    });
});

describe('checkout session plans', () => {
    it('accepts only the three known plan slugs', () => {
        ['basic', 'advanced', 'pro'].forEach((plan) => expect(isValidPlan(plan)).to.equal(true));
        [undefined, null, '', 'enterprise', '__proto__', 'toString', 42].forEach((plan) => {
            expect(isValidPlan(plan)).to.equal(false);
        });
    });

    it('maps each plan to a distinct Stripe product', () => {
        const productIds = Object.values(PLAN_PRODUCT_IDS);
        expect(new Set(productIds).size).to.equal(productIds.length);
    });

    it('picks the price whose recurring interval matches the billing period', async () => {
        const listStub = sinon.stub(stripe.prices, 'list').resolves({
            data: [
                { id: 'price_month', recurring: { interval: 'month' } },
                { id: 'price_year', recurring: { interval: 'year' } },
            ],
        } as any);

        expect(await resolvePriceId('basic', 'monthly')).to.equal('price_month');
        expect(await resolvePriceId('basic', 'annual')).to.equal('price_year');

        listStub.restore();
    });

    it('returns undefined rather than falling back to the wrong interval', async () => {
        // Charging a customer a yearly price when they picked monthly is worse
        // than refusing to start checkout at all.
        const listStub = sinon.stub(stripe.prices, 'list').resolves({
            data: [{ id: 'price_month', recurring: { interval: 'month' } }],
        } as any);

        expect(await resolvePriceId('basic', 'annual')).to.equal(undefined);

        listStub.restore();
    });
});
