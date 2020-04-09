import * as express from 'express';
import {
    updateNotificationValidation,
} from '../validation/notifications';
import {
    validate,
} from '../validation';
import {
    createNotification,
    getNotification,
    searchNotifications,
    updateNotification,
} from '../handlers/notifications';

const router = express.Router();

// CREATE
router.post('/', createNotification);

// READ
router.get('/:notificationId', getNotification);
router.get('/', searchNotifications);

// UPDATE
router.put('/:notificationId', updateNotificationValidation, validate, updateNotification);

export default router;
