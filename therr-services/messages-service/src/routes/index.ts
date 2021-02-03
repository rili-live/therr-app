import * as express from 'express';
import directMessagesRouter from './directMessagesRouter';
import forumsRouter from './forumsRouter';
import forumMessagesRouter from './forumMessagesRouter';

const router = express.Router();

router.use('/direct-messages', directMessagesRouter);
router.use('/forums', forumsRouter);
router.use('/forums-messages', forumMessagesRouter);

export default router;
