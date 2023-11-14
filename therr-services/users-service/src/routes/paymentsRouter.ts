import * as express from 'express';
import {
    activateUserSubscription,
    handleWebhookEvents,
} from '../handlers/payments';
// import {
//     verifyEmail,
// } from '../handlers/email';

const router = express.Router();

router.post('/checkout/sessions/:id', activateUserSubscription);
router.post('/webhook', handleWebhookEvents);

export default router;
