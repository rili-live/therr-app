import * as express from 'express';
import {
    predictAndSendPushNotification,
    testPushNotification,
} from '../handlers/notifications';

const router = express.Router();

// Process User Location Change
router.post('/send', predictAndSendPushNotification);

// For local testing
if (process.env.NODE_ENV !== 'production') {
    router.get('/test', testPushNotification);
}

export default router;
