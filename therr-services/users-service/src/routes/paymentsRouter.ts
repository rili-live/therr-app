import * as express from 'express';
import {
    activateUserSubscription,
    createCheckoutSession,
    createCustomerPortalSession,
    handleWebhookEvents,
} from '../handlers/payments';

const router = express.Router();

// Order matters: the literal route must be registered before the `:id` param
// route, or Express matches `sessions` as an id and every checkout start is
// answered by the activation handler instead.
router.post('/checkout/sessions', createCheckoutSession);
router.post('/checkout/sessions/:id', activateUserSubscription);
router.post('/customer-portal/sessions', createCustomerPortalSession);
router.post('/webhook', handleWebhookEvents);

export default router;
