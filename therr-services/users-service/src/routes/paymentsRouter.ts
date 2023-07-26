import * as express from 'express';
import {
    handleWebhookEvents,
} from '../handlers/payments';
// import {
//     verifyEmail,
// } from '../handlers/email';

const router = express.Router();

router.post('/webhook', handleWebhookEvents);

export default router;
