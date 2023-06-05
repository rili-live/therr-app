import * as express from 'express';
import authRouter from './authRouter';
// import emailsRouter from './emailsRouter';
import socialSyncRouter from './socialSyncRouter';
import subscribersRouter from './subscribersRouter';
import usersRouter from './usersRouter';
import userAchievementsRouter from './userAchievementsRouter';
import notificationsRouter from './notificationsRouter';
import rewardsRouter from './rewardsRouter';
import thoughtsRouter from './thoughtsRouter';
import userConnectionsRouter from './userConnectionsRouter';
import userMetricsRouter from './userMetricsRouter';

const router = express.Router();

router.use('/auth', authRouter);
// router.use('/emails', emailsRouter);
router.use('/social-sync', socialSyncRouter);
router.use('/rewards', rewardsRouter);
router.use('/subscribers', subscribersRouter);
router.use('/thoughts', thoughtsRouter);
router.use('/users/achievements', userAchievementsRouter);
router.use('/users/connections', userConnectionsRouter);
router.use('/users/notifications', notificationsRouter);
router.use('/users/metrics', userMetricsRouter);
router.use('/users', usersRouter);

export default router;
