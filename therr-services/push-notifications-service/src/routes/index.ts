import * as express from 'express';
import locationProcessingRouter from './locationProcessingRouter';
import notificationsRouter from './notificationsRouter';

const router = express.Router();

router.use('/location', locationProcessingRouter);

router.use('/notifications', notificationsRouter);

export default router;
