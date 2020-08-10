import * as express from 'express';
import directMesssagesRouter from './directMessagesRouter';

const router = express.Router();

router.use('/direct-messages', directMesssagesRouter);

export default router;
