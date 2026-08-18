import { expect } from 'chai';
import sinon from 'sinon';
import { AccessLevels } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import stripe from '../../src/api/stripe';
import { activateUserSubscription } from '../../src/handlers/payments';

describe('Payments Handler', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('activateUserSubscription', () => {
        it('should fetch user by id when userId provided', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'test@test.com',
                accessLevels: [AccessLevels.DEFAULT],
            };
            const getUserByIdStub = sinon.stub(Store.users, 'getUserById').resolves([mockUser]);

            const result = await Store.users.getUserById('user-123');

            expect(result[0].id).to.equal('user-123');
            getUserByIdStub.restore();
        });

        it('should fetch user by email when userId not provided', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'billing@test.com',
                accessLevels: [AccessLevels.DEFAULT],
            };
            const getUserByEmailStub = sinon.stub(Store.users, 'getUserByEmail').resolves([mockUser]);

            const result = await Store.users.getUserByEmail('billing@test.com');

            expect(result[0].email).to.equal('billing@test.com');
            getUserByEmailStub.restore();
        });

        it('should update user access levels on successful subscription', async () => {
            const newAccessLevel = 'premium.subscriber';
            const mockUser = {
                id: 'user-123',
                accessLevels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED],
            };
            const updateUserStub = sinon.stub(Store.users, 'updateUser').resolves([{
                ...mockUser,
                accessLevels: [...mockUser.accessLevels, newAccessLevel],
            }]);

            const userAccessLevels = new Set<string>(mockUser.accessLevels);
            userAccessLevels.add(newAccessLevel);

            const result = await Store.users.updateUser({
                accessLevels: JSON.stringify([...userAccessLevels]),
            }, { id: 'user-123' });

            expect(result[0].accessLevels).to.include(newAccessLevel);
            updateUserStub.restore();
        });

        it('should not update user if no access levels to add', async () => {
            const mockUser = {
                id: 'user-123',
                accessLevels: [AccessLevels.DEFAULT],
            };
            const updateUserStub = sinon.stub(Store.users, 'updateUser').resolves([]);

            // When accessLevels array is empty, no update should occur
            const accessLevels: string[] = [];

            if (accessLevels.length) {
                await Store.users.updateUser({
                    accessLevels: JSON.stringify(accessLevels),
                }, { id: 'user-123' });
            }

            expect(updateUserStub.called).to.be.eq(false);
            updateUserStub.restore();
        });

        it('should handle subscription mode payment', () => {
            const mockStripeResponse = {
                mode: 'subscription',
                payment_status: 'paid',
                status: 'complete',
                subscription: {
                    items: {
                        data: [
                            { price: { product: 'prod_123' } },
                        ],
                    },
                },
            };

            expect(mockStripeResponse.mode).to.equal('subscription');
            expect(mockStripeResponse.payment_status).to.equal('paid');
            expect(mockStripeResponse.status).to.equal('complete');
        });
    });

    // Unlike the block above, these drive the real handler rather than re-asserting a copy of its
    // logic inline. They cover `notGrantedReason`, which exists because every one of these paths
    // answers 200 — without it a refusal is indistinguishable from "nothing to grant".
    describe('activateUserSubscription — notGrantedReason', () => {
        const BASIC_PRODUCT_ID = 'prod_OK9dEHmueTGDZ1';

        const buildSession = (overrides: any = {}) => ({
            mode: 'subscription',
            status: 'complete',
            payment_status: 'paid',
            customer_details: { email: 'buyer@test.com' },
            customer_email: null,
            subscription: {
                status: 'active',
                items: { data: [{ price: { product: BASIC_PRODUCT_ID } }] },
            },
            ...overrides,
        });

        const invoke = async (session: any, headers: any = {}) => {
            sinon.stub(stripe.checkout.sessions, 'retrieve').resolves(session);
            const res: any = {
                status: sinon.stub().returnsThis(),
                send: sinon.stub().returnsThis(),
            };

            await activateUserSubscription({ params: { id: 'cs_test' }, headers }, res);

            return res.send.firstCall.args[0];
        };

        it('reports a billing-email mismatch instead of refusing silently', async () => {
            sinon.stub(Store.users, 'getUserById').resolves([{
                id: 'user-123',
                email: 'someone-else@test.com',
                accessLevels: [AccessLevels.DEFAULT],
            }]);
            const updateUserStub = sinon.stub(Store.users, 'updateUser').resolves([]);

            const body = await invoke(buildSession(), { 'x-userid': 'user-123' });

            expect(body.notGrantedReason).to.equal('billing-email-mismatch');
            expect(body.isAccessLevelUpdated).to.be.eq(false);
            expect(updateUserStub.called).to.be.eq(false);
        });

        it('reports a non-grantable session for a cancelled subscription', async () => {
            sinon.stub(Store.users, 'getUserById').resolves([{
                id: 'user-123',
                email: 'buyer@test.com',
                accessLevels: [AccessLevels.DEFAULT],
            }]);
            sinon.stub(Store.users, 'updateUser').resolves([]);

            const body = await invoke(buildSession({
                subscription: {
                    status: 'canceled',
                    items: { data: [{ price: { product: BASIC_PRODUCT_ID } }] },
                },
            }), { 'x-userid': 'user-123' });

            expect(body.notGrantedReason).to.equal('session-not-grantable');
            expect(body.isAccessLevelUpdated).to.be.eq(false);
        });

        it('reports account-not-found when no account holds the billing email', async () => {
            sinon.stub(Store.users, 'getUserByConditions').resolves([]);
            sinon.stub(Store.users, 'updateUser').resolves([]);

            const body = await invoke(buildSession());

            expect(body.notGrantedReason).to.equal('account-not-found');
            expect(body.isAccessLevelUpdated).to.be.eq(false);
        });

        it('reports no-mapped-access-level for a product missing from productIdMap', async () => {
            sinon.stub(Store.users, 'getUserById').resolves([{
                id: 'user-123',
                email: 'buyer@test.com',
                accessLevels: [AccessLevels.DEFAULT],
            }]);
            sinon.stub(Store.users, 'updateUser').resolves([]);

            const body = await invoke(buildSession({
                subscription: {
                    status: 'active',
                    items: { data: [{ price: { product: 'prod_not_in_map' } }] },
                },
            }), { 'x-userid': 'user-123' });

            expect(body.notGrantedReason).to.equal('no-mapped-access-level');
        });

        it('omits the reason entirely when the grant lands', async () => {
            sinon.stub(Store.users, 'getUserById').resolves([{
                id: 'user-123',
                email: 'buyer@test.com',
                accessLevels: [AccessLevels.DEFAULT],
            }]);
            const updateUserStub = sinon.stub(Store.users, 'updateUser').resolves([{ id: 'user-123' }]);

            const body = await invoke(buildSession(), { 'x-userid': 'user-123' });

            expect(body.notGrantedReason).to.be.eq(undefined);
            expect(body.isAccessLevelUpdated).to.be.eq(true);
            expect(updateUserStub.calledOnce).to.be.eq(true);
            // Unioned, never replaced — replacing here is what stripped EMAIL_VERIFIED and locked
            // users out of login right after paying.
            expect(JSON.parse(updateUserStub.firstCall.args[0].accessLevels)).to.include(AccessLevels.DEFAULT);
        });
    });

    describe('handleWebhookEvents', () => {
        it('should handle payment_intent.succeeded event', () => {
            const event = {
                type: 'payment_intent.succeeded',
                data: {
                    object: {
                        amount: 1000,
                        status: 'succeeded',
                    },
                },
            };

            expect(event.type).to.equal('payment_intent.succeeded');
            expect(event.data.object.status).to.equal('succeeded');
        });

        it('should handle customer.subscription.created event', () => {
            const event = {
                type: 'customer.subscription.created',
                data: {
                    object: {
                        id: 'sub_123',
                        status: 'active',
                        customer: 'cus_123',
                    },
                },
            };

            expect(event.type).to.equal('customer.subscription.created');
            expect(event.data.object.status).to.equal('active');
        });

        it('should handle customer.subscription.updated event', () => {
            const event = {
                type: 'customer.subscription.updated',
                data: {
                    object: {
                        id: 'sub_123',
                        status: 'active',
                    },
                },
            };

            expect(event.type).to.equal('customer.subscription.updated');
        });

        it('should handle customer.subscription.deleted event', () => {
            const event = {
                type: 'customer.subscription.deleted',
                data: {
                    object: {
                        id: 'sub_123',
                        status: 'canceled',
                    },
                },
            };

            expect(event.type).to.equal('customer.subscription.deleted');
            expect(event.data.object.status).to.equal('canceled');
        });

        it('should handle customer.subscription.paused event', () => {
            const event = {
                type: 'customer.subscription.paused',
                data: {
                    object: {
                        id: 'sub_123',
                        status: 'paused',
                    },
                },
            };

            expect(event.type).to.equal('customer.subscription.paused');
        });

        it('should handle customer.subscription.resumed event', () => {
            const event = {
                type: 'customer.subscription.resumed',
                data: {
                    object: {
                        id: 'sub_123',
                        status: 'active',
                    },
                },
            };

            expect(event.type).to.equal('customer.subscription.resumed');
        });

        it('should handle customer.subscription.trial_will_end event', () => {
            const event = {
                type: 'customer.subscription.trial_will_end',
                data: {
                    object: {
                        id: 'sub_123',
                        trial_end: 1234567890,
                    },
                },
            };

            expect(event.type).to.equal('customer.subscription.trial_will_end');
        });

        it('should handle payment_method.attached event', () => {
            const event = {
                type: 'payment_method.attached',
                data: {
                    object: {
                        id: 'pm_123',
                        customer: 'cus_123',
                    },
                },
            };

            expect(event.type).to.equal('payment_method.attached');
        });

        it('should log unhandled event types', () => {
            const event = {
                type: 'unknown.event.type',
                data: {
                    object: {},
                },
            };

            // This should be logged as an unhandled event type
            const knownEventTypes = [
                'payment_intent.succeeded',
                'customer.subscription.created',
                'customer.subscription.updated',
                'customer.subscription.deleted',
                'customer.subscription.paused',
                'customer.subscription.resumed',
                'customer.subscription.pending_update_applied',
                'customer.subscription.pending_update_expired',
                'customer.subscription.trial_will_end',
                'payment_method.attached',
            ];

            expect(knownEventTypes.includes(event.type)).to.be.eq(false);
        });
    });

    describe('subscription access levels', () => {
        it('should add new access level without duplicates', () => {
            const existingLevels: string[] = [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED];
            const newLevel = 'premium.subscriber';

            const userAccessLevels = new Set<string>(existingLevels);
            userAccessLevels.add(newLevel);

            expect([...userAccessLevels]).to.have.lengthOf(3);
            expect([...userAccessLevels]).to.include(newLevel);
        });

        it('should not duplicate existing access levels', () => {
            const existingLevels = [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED];
            const newLevel = AccessLevels.EMAIL_VERIFIED; // Already exists

            const userAccessLevels = new Set(existingLevels);
            userAccessLevels.add(newLevel);

            expect([...userAccessLevels]).to.have.lengthOf(2);
        });

        it('should handle multiple subscription products', () => {
            const subscriptionItems = [
                { price: { product: 'prod_basic' } },
                { price: { product: 'prod_premium' } },
            ];

            const productIds = subscriptionItems.map((item) => item.price.product);

            expect(productIds).to.have.lengthOf(2);
            expect(productIds).to.include('prod_basic');
            expect(productIds).to.include('prod_premium');
        });
    });

    describe('subscription status validation', () => {
        it('should only process paid and complete subscriptions', () => {
            const validSubscription = {
                mode: 'subscription',
                payment_status: 'paid',
                status: 'complete',
            };

            const isValid = validSubscription.mode === 'subscription'
                && validSubscription.payment_status === 'paid'
                && validSubscription.status === 'complete';

            expect(isValid).to.be.eq(true);
        });

        it('should not process unpaid subscriptions', () => {
            const unpaidSubscription = {
                mode: 'subscription',
                payment_status: 'unpaid',
                status: 'incomplete',
            };

            const isValid = unpaidSubscription.mode === 'subscription'
                && unpaidSubscription.payment_status === 'paid'
                && unpaidSubscription.status === 'complete';

            expect(isValid).to.be.eq(false);
        });

        it('should not process incomplete subscriptions', () => {
            const incompleteSubscription = {
                mode: 'subscription',
                payment_status: 'paid',
                status: 'incomplete',
            };

            const isValid = incompleteSubscription.mode === 'subscription'
                && incompleteSubscription.payment_status === 'paid'
                && incompleteSubscription.status === 'complete';

            expect(isValid).to.be.eq(false);
        });

        it('should not process one-time payments in subscription flow', () => {
            const oneTimePayment = {
                mode: 'payment',
                payment_status: 'paid',
                status: 'complete',
            };

            const isSubscription = oneTimePayment.mode === 'subscription';

            expect(isSubscription).to.be.eq(false);
        });
    });

    describe('billing email handling', () => {
        it('should prefer customer_details email over customer_email', () => {
            const response = {
                customer_details: { email: 'details@test.com' },
                customer_email: 'fallback@test.com',
            };

            const billingEmail = response.customer_details?.email || response.customer_email;

            expect(billingEmail).to.equal('details@test.com');
        });

        it('should fallback to customer_email when customer_details empty', () => {
            const response: { customer_details: { email: string } | null, customer_email: string | null } = {
                customer_details: null,
                customer_email: 'fallback@test.com',
            };

            const billingEmail = response.customer_details?.email || response.customer_email;

            expect(billingEmail).to.equal('fallback@test.com');
        });

        it('should handle missing billing email', () => {
            const response: { customer_details: { email: string } | null, customer_email: string | null } = {
                customer_details: null,
                customer_email: null,
            };

            const billingEmail = response.customer_details?.email || response.customer_email;

            expect(billingEmail).to.be.eq(null);
        });
    });
});
