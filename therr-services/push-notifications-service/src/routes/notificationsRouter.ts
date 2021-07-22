import * as express from 'express';
import {
    predictAndSendPushNotification,
} from '../handlers/notifications';

const router = express.Router();

// Process User Location Change
router.post('/send', predictAndSendPushNotification);

export default router;
