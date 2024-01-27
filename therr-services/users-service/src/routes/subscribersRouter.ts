import * as express from 'express';
import {
    createFeedback,
    createSubscriber,
    updateSubscriptions,
} from '../handlers/subscribers';

const router = express.Router();

// CREATE
router.post('/signup', createSubscriber);

router.post('/send-feedback', createFeedback);

router.post('/unsubscribe', updateSubscriptions);

export default router;
