import * as express from 'express';
import {
    activateUserSubscription,
    createCustomerPortalSession,
    handleWebhookEvents,
} from '../handlers/payments';

const router = express.Router();

router.post('/checkout/sessions/:id', activateUserSubscription);
router.post('/customer-portal/sessions', createCustomerPortalSession);
router.post('/webhook', handleWebhookEvents);

export default router;
