import * as express from 'express';
import appLoggingRouter from './appLoggingRouter';
import directMessagesRouter from './directMessagesRouter';
import forumsRouter from './forumsRouter';
import forumMessagesRouter from './forumMessagesRouter';
import deleteUserData from '../handlers/deleteUserData';

const router = express.Router();

router.use('/app-logs', appLoggingRouter);
router.use('/direct-messages', directMessagesRouter);
router.use('/forums', forumsRouter);
router.use('/forums-messages', forumMessagesRouter);
router.delete('/delete-user-data', deleteUserData);

export default router;
