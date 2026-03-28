import Stripe from 'stripe';
import { AccessLevels } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import normalizeEmail from 'normalize-email';
import Store from '../../store';
import sendAdminNewBusinessSubscriptionEmail from '../../api/email/admin/sendAdminNewBusinessSubscriptionEmail';
import sendDashboardSubscriberIntroEmail from '../../api/email/for-business/sendDashboardSubscriberIntroEmail';
import sendDashboardSubscriberUserNotFoundEmail from '../../api/email/for-business/sendDashboardSubscriberUserNotFoundEmail';
import stripe from '../../api/stripe';
import * as globalConfig from '../../../../../global-config';

export const productIdMap: {
    [key: string]: {
        accessLevel: string;
        domain: string;
        brandVariation: string;
    }
} = {
    // Basic plan
    prod_OK9dEHmueTGDZ1: {
        accessLevel: AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
        domain: globalConfig[process.env.NODE_ENV].dashboardHost,
        brandVariation: 'dashboard-therr',
    },
    // Premium plan
    prod_OK9e5d2awEPukG: {
        accessLevel: AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM,
        domain: globalConfig[process.env.NODE_ENV].dashboardHost,
        brandVariation: 'dashboard-therr',
    },
    // Pro plan
    // TODO: Verify this Stripe product ID corresponds to the Pro plan in the Stripe dashboard
    prod_OK9f7dJp7rtPB8: {
        accessLevel: AccessLevels.DASHBOARD_SUBSCRIBER_PRO,
        domain: globalConfig[process.env.NODE_ENV].dashboardHost,
        brandVariation: 'dashboard-therr',
    },
    // TODO: Add Agency plan product ID from Stripe dashboard
    // prod_XXXXXXXXXXXXXXX: {
    //     accessLevel: AccessLevels.DASHBOARD_SUBSCRIBER_AGENCY,
    //     domain: globalConfig[process.env.NODE_ENV].dashboardHost,
    //     brandVariation: 'dashboard-therr',
    // },
};

const handleSubscriptionCreateUpdate = async (event) => {
    const eventObject = event.data.object;

    const customer = await stripe.customers.retrieve(eventObject.customer) as Stripe.Customer;
    const product = await stripe.products.retrieve(eventObject.plan?.product);

    logSpan({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: ['Customer Subscription Created'],
        traceArgs: {
            'subscription.planId': eventObject.plan?.id,
            'subscription.planAmount': eventObject.plan?.amount,
            'subscription.productId': eventObject.product?.id,
            'subscription.productName': product.name,
            'subscription.trialStart': eventObject.trial_start ? eventObject.trial_start * 1000 : undefined,
            'subscription.trialEnd': eventObject.trial_end ? eventObject.trial_end * 1000 : undefined,
            'subscription.status': eventObject.status,
        },
    });

    const normedEmail = normalizeEmail(customer.email || eventObject?.receipt_email || eventObject?.billing_details?.email);
    let fetchedUser: any = {};

    if (eventObject.status === 'trialing') {
        if (normedEmail) {
            await Store.users.getUsers({
                email: normedEmail,
            }, {}, {}, ['id', 'email', 'accessLevels']).then(([user]) => {
                sendDashboardSubscriberIntroEmail({
                    subject: 'Free Trial Activated: Therr for Business',
                    toAddresses: [normedEmail],
                    agencyDomainName: productIdMap[eventObject.product?.id]?.domain || '',
                    brandVariation: productIdMap[eventObject.product?.id]?.brandVariation || 'dashboard-therr',
                    recipientIdentifiers: {
                        id: user.id,
                        accountEmail: user.email,
                    },
                }, {
                    productName: product.name,
                });

                if (user) {
                    fetchedUser = user;
                    const userAccessLevels = new Set(
                        user.accessLevels,
                    );
                    userAccessLevels.add(productIdMap[product.id].accessLevel || AccessLevels.DASHBOARD_SUBSCRIBER_BASIC);
                    return Store.users.updateUser({
                        accessLevels: JSON.stringify([...userAccessLevels]),
                    }, {
                        id: user.id,
                    });
                }

                // User Not Found: Send email to rectify account subscription status
                sendDashboardSubscriberUserNotFoundEmail({
                    subject: 'Subscriber Missing Email | Not Found',
                    toAddresses: [normedEmail, process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
                    agencyDomainName: productIdMap[product.id].domain,
                    brandVariation: productIdMap[eventObject.product?.id]?.brandVariation,
                    recipientIdentifiers: {
                        id: user.id,
                        accountEmail: user.email,
                    },
                }, {
                    productName: product.name,
                });
            });
        } else {
            console.error('Missing customer email for subscriber free trial');
        }
    } else if (eventObject.status === 'active') {
        if (normedEmail) {
            await Store.users.getUsers({
                email: normedEmail,
            }, {}, {}, ['id', 'email', 'accessLevels']).then(([user]) => {
                if (user) {
                    fetchedUser = user;
                    const userAccessLevels = new Set(user.accessLevels || []);
                    userAccessLevels.add(productIdMap[product.id]?.accessLevel || AccessLevels.DASHBOARD_SUBSCRIBER_BASIC);
                    return Store.users.updateUser({
                        accessLevels: JSON.stringify([...userAccessLevels]),
                    }, { id: user.id });
                }
            });
        }
    }

    sendAdminNewBusinessSubscriptionEmail({
        subject: '[New Subscriber] New Dashboard Payment',
        toAddresses: [],
        agencyDomainName: productIdMap[eventObject.product?.id]?.domain || '',
        brandVariation: productIdMap[eventObject.product?.id]?.brandVariation,
    }, {
        customerEmail: normedEmail,
    }, {
        webhookEventType: event.type,
        webhookEventAmount: eventObject.amount,
        webhookEventStatus: eventObject.status,
        userId: fetchedUser?.id,
        userEmail: fetchedUser?.email,
    });
};

const getDashboardAccessLevels = () => [
    AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
    AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM,
    AccessLevels.DASHBOARD_SUBSCRIBER_PRO,
    AccessLevels.DASHBOARD_SUBSCRIBER_AGENCY,
];

const revokeDashboardAccess = async (event) => {
    const eventObject = event.data.object;
    const customer = await stripe.customers.retrieve(eventObject.customer) as Stripe.Customer;
    const normedEmail = normalizeEmail(customer.email || '');

    if (!normedEmail) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Missing customer email for subscription revocation'],
            traceArgs: { 'webhook.eventType': event.type, 'webhook.customerId': eventObject.customer },
        });
        return;
    }

    const dashboardAccessLevels = getDashboardAccessLevels();

    await Store.users.getUsers({
        email: normedEmail,
    }, {}, {}, ['id', 'email', 'accessLevels']).then(([user]) => {
        if (user) {
            const updatedAccessLevels = (user.accessLevels || [])
                .filter((level: string) => !dashboardAccessLevels.includes(level as AccessLevels));

            return Store.users.updateUser({
                accessLevels: JSON.stringify(updatedAccessLevels),
            }, { id: user.id });
        }

        logSpan({
            level: 'warn',
            messageOrigin: 'API_SERVER',
            messages: ['User not found for subscription revocation'],
            traceArgs: { 'webhook.email': normedEmail, 'webhook.eventType': event.type },
        });
    });
};

const restoreDashboardAccess = async (event) => {
    const eventObject = event.data.object;
    const customer = await stripe.customers.retrieve(eventObject.customer) as Stripe.Customer;
    const normedEmail = normalizeEmail(customer.email || '');

    if (!normedEmail) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Missing customer email for subscription restoration'],
            traceArgs: { 'webhook.eventType': event.type },
        });
        return;
    }

    const product = await stripe.products.retrieve(eventObject.plan?.product);
    const accessLevel = productIdMap[product.id]?.accessLevel || AccessLevels.DASHBOARD_SUBSCRIBER_BASIC;

    await Store.users.getUsers({
        email: normedEmail,
    }, {}, {}, ['id', 'email', 'accessLevels']).then(([user]) => {
        if (user) {
            const userAccessLevels = new Set(user.accessLevels || []);
            userAccessLevels.add(accessLevel);

            return Store.users.updateUser({
                accessLevels: JSON.stringify([...userAccessLevels]),
            }, { id: user.id });
        }
    });
};

const handleSubscriptionDeleted = async (event) => {
    logSpan({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: ['Customer Subscription Deleted'],
        traceArgs: { 'webhook.eventType': event.type, 'webhook.customerId': event.data.object.customer },
    });

    await revokeDashboardAccess(event);
};

const handleSubscriptionPaused = async (event) => {
    logSpan({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: ['Customer Subscription Paused'],
        traceArgs: { 'webhook.eventType': event.type, 'webhook.customerId': event.data.object.customer },
    });

    await revokeDashboardAccess(event);
};

const handleSubscriptionResumed = async (event) => {
    logSpan({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: ['Customer Subscription Resumed'],
        traceArgs: { 'webhook.eventType': event.type, 'webhook.customerId': event.data.object.customer },
    });

    await restoreDashboardAccess(event);
};

const handleSubscriptionTrialWillEnd = async (event) => {
    const eventObject = event.data.object;
    const customer = await stripe.customers.retrieve(eventObject.customer) as Stripe.Customer;
    const normedEmail = normalizeEmail(customer.email || '');

    logSpan({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: ['Customer Subscription Trial Will End'],
        traceArgs: {
            'webhook.eventType': event.type,
            'webhook.trialEnd': eventObject.trial_end ? eventObject.trial_end * 1000 : undefined,
            'webhook.customerEmail': normedEmail,
        },
    });

    // TODO: Send trial-ending-soon email to customer
};

export {
    handleSubscriptionCreateUpdate,
    handleSubscriptionDeleted,
    handleSubscriptionPaused,
    handleSubscriptionResumed,
    handleSubscriptionTrialWillEnd,
};
