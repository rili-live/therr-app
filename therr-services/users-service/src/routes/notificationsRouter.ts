import * as express from 'express';
import {
    validate,
} from '../validation';
import {
    createNotification,
    getNotification,
    recordPushOpen,
    searchNotifications,
    updateNotification,
} from '../handlers/notifications';

const router = express.Router();

// CREATE
router.post('/', createNotification);
// A tap on a queued push (main.notificationQueue.openedAt)
router.post('/push-opens', recordPushOpen);

// READ
router.get('/:notificationId', getNotification);
router.get('/', searchNotifications);

// UPDATE
router.put('/:notificationId', validate, updateNotification);

export default router;
