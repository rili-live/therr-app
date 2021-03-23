import * as express from 'express';
import mapsServiceRouter from '../services/maps/router';
import messagesServiceRouter from '../services/messages/router';
import reactionsServiceRouter from '../services/reactions/router';
import usersServiceRouter from '../services/users/router';
import {
    genericRateLimiter,
    serviceRateLimiter,
} from '../middleware/rateLimiters';

const router = express.Router();

router.use(genericRateLimiter);

// READ
router.use('/maps-service', serviceRateLimiter, mapsServiceRouter);
router.use('/messages-service', serviceRateLimiter, messagesServiceRouter);
router.use('/reactions-service', serviceRateLimiter, reactionsServiceRouter);
router.use('/users-service', serviceRateLimiter, usersServiceRouter);

export default router;
