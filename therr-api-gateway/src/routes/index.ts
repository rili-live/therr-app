import * as express from 'express';
import mapsServiceRouter from '../services/maps/router';
import messagesServiceRouter from '../services/messages/router';
import reactionsServiceRouter from '../services/reactions/router';
import usersServiceRouter from '../services/users/router';

const router = express.Router();

// READ
router.use('/maps-service', mapsServiceRouter);
router.use('/messages-service', messagesServiceRouter);
router.use('/reactions-service', reactionsServiceRouter);
router.use('/users-service', usersServiceRouter);

export default router;
