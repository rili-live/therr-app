import * as express from 'express';
import directMessagesRouter from './directMessagesRouter';

const router = express.Router();

router.use('/direct-messages', directMessagesRouter);

export default router;
