import * as express from 'express';
import campaignsServiceRouter from '../services/campaigns/router';
import filesRouter from '../services/files/router';
import phoneRouter from '../services/phone/router';
import mapsServiceRouter from '../services/maps/router';
import messagesServiceRouter from '../services/messages/router';
import pushNotificationsServiceRouter from '../services/push-notifications/router';
import reactionsServiceRouter from '../services/reactions/router';
import usersServiceRouter from '../services/users/router';
import {
    genericRateLimiter,
    serviceRateLimiter,
} from '../middleware/rateLimiters';

const router = express.Router();

router.use(genericRateLimiter);

// READ
router.use('/phone', serviceRateLimiter(300), phoneRouter);
router.use('/user-files', serviceRateLimiter(500), filesRouter);
router.use('/maps-service', serviceRateLimiter(400), mapsServiceRouter);
router.use('/messages-service', serviceRateLimiter(), messagesServiceRouter);
router.use('/push-notifications-service', serviceRateLimiter(), pushNotificationsServiceRouter);
router.use('/reactions-service', serviceRateLimiter(), reactionsServiceRouter);
router.use('/users-service', serviceRateLimiter(), usersServiceRouter);
router.use('/users-service/campaigns', serviceRateLimiter(), campaignsServiceRouter);

export default router;
