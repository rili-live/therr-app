import * as express from 'express';
import {
    predictAndSendPushNotification,
    predictAndSendMultiPushNotification,
    testPushNotification,
} from '../handlers/notifications';
import {
    getPushDiagnostics,
    sendTestPushNotification,
} from '../handlers/diagnostics';

const router = express.Router();

// Send a push notification
router.post('/send', predictAndSendPushNotification);
// Send a push notification to multiple users
router.post('/send-multiple', predictAndSendMultiPushNotification);

// Diagnostics. Available in production (unlike /test below) because the failure
// these exist to diagnose is a production-only one — it depends on the deployed
// credentials and on real device tokens. Gated to SUPER_ADMIN at the gateway.
router.get('/diagnostics', getPushDiagnostics);
router.post('/diagnostics/send-test', sendTestPushNotification);

// For local testing (can send notifications to a production device)
if (process.env.NODE_ENV !== 'production') {
    router.get('/test', testPushNotification);
}

export default router;
