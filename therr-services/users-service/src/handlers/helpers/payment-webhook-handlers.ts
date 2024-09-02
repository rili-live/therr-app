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
    prod_OK9dEHmueTGDZ1: {
        accessLevel: AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
        domain: globalConfig[process.env.NODE_ENV].dashboardHost,
        brandVariation: 'dashboard-therr',
    },
    prod_OK9e5d2awEPukG: {
        accessLevel: AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM,
        domain: globalConfig[process.env.NODE_ENV].dashboardHost,
        brandVariation: 'dashboard-therr',
    },
    prod_OK9f7dJp7rtPB8: {
        accessLevel: AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
        domain: globalConfig[process.env.NODE_ENV].dashboardHost,
        brandVariation: 'dashboard-therr',
    },
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
        // TODO: Send subscription started email (trial phase completed)
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

export {
    handleSubscriptionCreateUpdate,
};
