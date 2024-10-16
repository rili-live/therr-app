import * as express from 'express';
import {
    predictAndSendPushNotification,
    predictAndSendMultiPushNotification,
    testPushNotification,
} from '../handlers/notifications';

const router = express.Router();

// Send a push notification
router.post('/send', predictAndSendPushNotification);
// Send a push notification to multiple users
router.post('/send-multiple', predictAndSendMultiPushNotification);

// For local testing (can send notifications to a production device)
if (process.env.NODE_ENV !== 'production') {
    router.get('/test', testPushNotification);
}

export default router;
