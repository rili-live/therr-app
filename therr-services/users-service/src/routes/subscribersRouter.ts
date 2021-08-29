import * as express from 'express';
import {
    createFeedback,
    createSubscriber,
} from '../handlers/subscribers';

const router = express.Router();

// CREATE
router.post('/signup', createSubscriber);

router.post('/send-feedback', createFeedback);

export default router;
