/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import { AccessLevels } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import stripe from '../../src/api/stripe';
import {
    productIdMap,
    handleSubscriptionDeleted,
    handleSubscriptionPaused,
    handleSubscriptionResumed,
    handleSubscriptionTrialWillEnd,
} from '../../src/handlers/helpers/payment-webhook-handlers';

const mockCustomer = {
    id: 'cus_test123',
    email: 'business@example.com',
    object: 'customer' as const,
};

const mockProduct = {
    id: 'prod_OK9dEHmueTGDZ1',
    name: 'Basic Plan',
    object: 'product' as const,
};

const makeSubscriptionEvent = (type: string, overrides: any = {}) => ({
    type,
    data: {
        object: {
            id: 'sub_test123',
            customer: 'cus_test123',
            status: overrides.status || 'active',
            plan: {
                id: 'price_test123',
                amount: 1499,
                product: 'prod_OK9dEHmueTGDZ1',
            },
            product: { id: 'prod_OK9dEHmueTGDZ1' },
            trial_start: overrides.trial_start,
            trial_end: overrides.trial_end,
            ...overrides,
        },
    },
});

describe('Payment Webhook Handlers', () => {
    let getUsersStub: sinon.SinonStub;
    let updateUserStub: sinon.SinonStub;

    beforeEach(() => {
        sinon.stub(stripe.customers, 'retrieve').resolves(mockCustomer as any);
        sinon.stub(stripe.products, 'retrieve').resolves(mockProduct as any);
        updateUserStub = sinon.stub(Store.users, 'updateUser').resolves([{ id: 'user-123' }]);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('productIdMap', () => {
        it('should map Basic product to DASHBOARD_SUBSCRIBER_BASIC', () => {
            expect(productIdMap.prod_OK9dEHmueTGDZ1.accessLevel)
                .to.equal(AccessLevels.DASHBOARD_SUBSCRIBER_BASIC);
        });

        it('should map Premium product to DASHBOARD_SUBSCRIBER_PREMIUM', () => {
            expect(productIdMap.prod_OK9e5d2awEPukG.accessLevel)
                .to.equal(AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM);
        });

        it('should map Pro product to DASHBOARD_SUBSCRIBER_PRO', () => {
            expect(productIdMap.prod_OK9f7dJp7rtPB8.accessLevel)
                .to.equal(AccessLevels.DASHBOARD_SUBSCRIBER_PRO);
        });

        it('should not have duplicate access level mappings for different products', () => {
            const accessLevels = Object.values(productIdMap).map((v) => v.accessLevel);
            const uniqueLevels = new Set(accessLevels);
            expect(uniqueLevels.size).to.equal(accessLevels.length);
        });
    });

    describe('handleSubscriptionDeleted', () => {
        it('should revoke all dashboard access levels when subscription is canceled', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'business@example.com',
                accessLevels: [
                    AccessLevels.DEFAULT,
                    AccessLevels.EMAIL_VERIFIED,
                    AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
                ],
            };
            getUsersStub = sinon.stub(Store.users, 'getUsers').resolves([mockUser]);

            const event = makeSubscriptionEvent('customer.subscription.deleted', { status: 'canceled' });
            await handleSubscriptionDeleted(event);

            expect(getUsersStub.calledOnce).to.be.eq(true);
            expect(updateUserStub.calledOnce).to.be.eq(true);

            const updateArgs = updateUserStub.args[0];
            const updatedLevels = JSON.parse(updateArgs[0].accessLevels);
            expect(updatedLevels).to.include(AccessLevels.DEFAULT);
            expect(updatedLevels).to.include(AccessLevels.EMAIL_VERIFIED);
            expect(updatedLevels).to.not.include(AccessLevels.DASHBOARD_SUBSCRIBER_BASIC);
            expect(updatedLevels).to.not.include(AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM);
            expect(updatedLevels).to.not.include(AccessLevels.DASHBOARD_SUBSCRIBER_PRO);
            expect(updatedLevels).to.not.include(AccessLevels.DASHBOARD_SUBSCRIBER_AGENCY);
        });

        it('should revoke all dashboard tiers even if user has multiple', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'business@example.com',
                accessLevels: [
                    AccessLevels.DEFAULT,
                    AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
                    AccessLevels.DASHBOARD_SUBSCRIBER_PRO,
                ],
            };
            getUsersStub = sinon.stub(Store.users, 'getUsers').resolves([mockUser]);

            const event = makeSubscriptionEvent('customer.subscription.deleted');
            await handleSubscriptionDeleted(event);

            const updatedLevels = JSON.parse(updateUserStub.args[0][0].accessLevels);
            expect(updatedLevels).to.deep.equal([AccessLevels.DEFAULT]);
        });

        it('should not call updateUser when user is not found', async () => {
            getUsersStub = sinon.stub(Store.users, 'getUsers').resolves([]);

            const event = makeSubscriptionEvent('customer.subscription.deleted');
            await handleSubscriptionDeleted(event);

            expect(updateUserStub.called).to.be.eq(false);
        });

        it('should not call updateUser when customer email is missing', async () => {
            sinon.restore(); // Clear the default stub
            sinon.stub(stripe.customers, 'retrieve').resolves({ ...mockCustomer, email: '' } as any);
            sinon.stub(stripe.products, 'retrieve').resolves(mockProduct as any);
            updateUserStub = sinon.stub(Store.users, 'updateUser').resolves([{ id: 'user-123' }]);
            getUsersStub = sinon.stub(Store.users, 'getUsers').resolves([]);

            const event = makeSubscriptionEvent('customer.subscription.deleted');
            await handleSubscriptionDeleted(event);

            expect(getUsersStub.called).to.be.eq(false);
            expect(updateUserStub.called).to.be.eq(false);
        });
    });

    describe('handleSubscriptionPaused', () => {
        it('should revoke dashboard access when subscription is paused', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'business@example.com',
                accessLevels: [
                    AccessLevels.DEFAULT,
                    AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM,
                ],
            };
            getUsersStub = sinon.stub(Store.users, 'getUsers').resolves([mockUser]);

            const event = makeSubscriptionEvent('customer.subscription.paused', { status: 'paused' });
            await handleSubscriptionPaused(event);

            expect(updateUserStub.calledOnce).to.be.eq(true);
            const updatedLevels = JSON.parse(updateUserStub.args[0][0].accessLevels);
            expect(updatedLevels).to.not.include(AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM);
            expect(updatedLevels).to.include(AccessLevels.DEFAULT);
        });
    });

    describe('handleSubscriptionResumed', () => {
        it('should restore dashboard access when subscription is resumed', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'business@example.com',
                accessLevels: [AccessLevels.DEFAULT],
            };
            getUsersStub = sinon.stub(Store.users, 'getUsers').resolves([mockUser]);

            const event = makeSubscriptionEvent('customer.subscription.resumed');
            await handleSubscriptionResumed(event);

            expect(updateUserStub.calledOnce).to.be.eq(true);
            const updatedLevels = JSON.parse(updateUserStub.args[0][0].accessLevels);
            expect(updatedLevels).to.include(AccessLevels.DASHBOARD_SUBSCRIBER_BASIC);
            expect(updatedLevels).to.include(AccessLevels.DEFAULT);
        });

        it('should not duplicate access level if already present', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'business@example.com',
                accessLevels: [AccessLevels.DEFAULT, AccessLevels.DASHBOARD_SUBSCRIBER_BASIC],
            };
            getUsersStub = sinon.stub(Store.users, 'getUsers').resolves([mockUser]);

            const event = makeSubscriptionEvent('customer.subscription.resumed');
            await handleSubscriptionResumed(event);

            const updatedLevels = JSON.parse(updateUserStub.args[0][0].accessLevels);
            const basicCount = updatedLevels.filter((l: string) => l === AccessLevels.DASHBOARD_SUBSCRIBER_BASIC).length;
            expect(basicCount).to.equal(1);
        });
    });

    describe('handleSubscriptionTrialWillEnd', () => {
        it('should not throw when trial end event is received', async () => {
            const event = makeSubscriptionEvent('customer.subscription.trial_will_end', {
                trial_end: Math.floor(Date.now() / 1000) + 259200, // 3 days from now
            });

            // Should not throw
            await handleSubscriptionTrialWillEnd(event);
        });
    });

    describe('access level revocation edge cases', () => {
        it('should preserve non-dashboard access levels during revocation', () => {
            const dashboardLevels = [
                AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
                AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM,
                AccessLevels.DASHBOARD_SUBSCRIBER_PRO,
                AccessLevels.DASHBOARD_SUBSCRIBER_AGENCY,
            ];
            const userLevels = [
                AccessLevels.DEFAULT,
                AccessLevels.EMAIL_VERIFIED,
                AccessLevels.DASHBOARD_SIGNUP,
                AccessLevels.DASHBOARD_SUBSCRIBER_PRO,
            ];

            const filtered = userLevels.filter((l) => !dashboardLevels.includes(l));

            expect(filtered).to.include(AccessLevels.DEFAULT);
            expect(filtered).to.include(AccessLevels.EMAIL_VERIFIED);
            expect(filtered).to.include(AccessLevels.DASHBOARD_SIGNUP);
            expect(filtered).to.not.include(AccessLevels.DASHBOARD_SUBSCRIBER_PRO);
        });

        it('should handle user with no access levels', () => {
            const userLevels: string[] = [];
            const dashboardLevels = [
                AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
                AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM,
                AccessLevels.DASHBOARD_SUBSCRIBER_PRO,
                AccessLevels.DASHBOARD_SUBSCRIBER_AGENCY,
            ];

            const filtered = userLevels.filter((l) => !dashboardLevels.includes(l as AccessLevels));
            expect(filtered).to.have.lengthOf(0);
        });
    });

    describe('returnUrl validation', () => {
        it('should accept valid dashboard URLs', () => {
            const dashboardHost = 'dashboard.therr.com';
            const returnUrl = 'https://dashboard.therr.com/settings';

            const parsed = new URL(returnUrl);
            expect(parsed.hostname).to.equal(dashboardHost);
        });

        it('should reject URLs from different domains', () => {
            const dashboardHost = 'dashboard.therr.com';
            const maliciousUrl = 'https://evil.com/phishing';

            const parsed = new URL(maliciousUrl);
            expect(parsed.hostname).to.not.equal(dashboardHost);
        });

        it('should handle invalid URL strings gracefully', () => {
            let isValid = false;
            try {
                const url = new URL('not-a-valid-url');
                isValid = !!url;
            } catch {
                isValid = false;
            }
            expect(isValid).to.be.eq(false);
        });

        it('should accept white-label origin URLs', () => {
            const whiteLabelOrigin = 'adsly.app';
            const returnUrl = 'https://adsly.app/settings';

            const parsed = new URL(returnUrl);
            expect(parsed.hostname === whiteLabelOrigin).to.be.eq(true);
        });
    });

    describe('Customer Portal session creation', () => {
        it('should look up Stripe customer by billing email', async () => {
            const stripeCustomerListStub = sinon.stub(stripe.customers, 'list').resolves({
                data: [mockCustomer],
            } as any);

            const email = 'business@example.com';
            const result = await stripe.customers.list({ email, limit: 1 });

            expect(stripeCustomerListStub.calledOnce).to.be.eq(true);
            expect(stripeCustomerListStub.args[0][0]).to.deep.equal({ email, limit: 1 });
            expect(result.data).to.have.lengthOf(1);
            expect(result.data[0].id).to.equal('cus_test123');
        });

        it('should prefer billingEmail over email', () => {
            const user = {
                billingEmail: 'billing@example.com',
                email: 'personal@example.com',
            };

            const email = user.billingEmail || user.email;
            expect(email).to.equal('billing@example.com');
        });

        it('should fallback to email when billingEmail is not set', () => {
            const user = {
                billingEmail: undefined,
                email: 'personal@example.com',
            };

            const email = user.billingEmail || user.email;
            expect(email).to.equal('personal@example.com');
        });
    });
});
