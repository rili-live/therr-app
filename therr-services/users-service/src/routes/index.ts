import * as express from 'express';
import authRouter from './authRouter';
// import emailsRouter from './emailsRouter';
import usersRouter from './usersRouter';
import notificationsRouter from './notificationsRouter';
import userConnectionsRouter from './userConnectionsRouter';

const router = express.Router();

router.use('/auth', authRouter);
// router.use('/emails', emailsRouter);
router.use('/users/connections', userConnectionsRouter);
router.use('/users/notifications', notificationsRouter);
router.use('/users', usersRouter);

export default router;
