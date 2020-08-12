import * as express from 'express';
import messagesServiceRouter from '../services/messages/router';
import usersServiceRouter from '../services/users/router';

const router = express.Router();

// READ
router.use('/messages-service', messagesServiceRouter);
router.use('/users-service', usersServiceRouter);

export default router;
