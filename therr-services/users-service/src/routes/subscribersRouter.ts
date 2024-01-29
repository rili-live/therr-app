import * as express from 'express';
import {
    getSubscriptionSettings,
    createFeedback,
    createSubscriber,
    updateSubscriptions,
} from '../handlers/subscribers';

const router = express.Router();

// READ
router.get('/preferences', getSubscriptionSettings);

// CREATE
router.post('/signup', createSubscriber);

router.post('/send-feedback', createFeedback);

router.post('/unsubscribe', updateSubscriptions);

export default router;
