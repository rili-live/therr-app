import * as express from 'express';
import authRouter from './authRouter';
// import emailsRouter from './emailsRouter';
import campaignsRouter from './campaignsRouter';
import paymentsRouter from './paymentsRouter';
import socialSyncRouter from './socialSyncRouter';
import subscribersRouter from './subscribersRouter';
import usersRouter from './usersRouter';
import userGroupsRouter from './userGroupsRouter';
import userAchievementsRouter from './userAchievementsRouter';
import notificationsRouter from './notificationsRouter';
import rewardsRouter from './rewardsRouter';
import thoughtsRouter from './thoughtsRouter';
import userConnectionsRouter from './userConnectionsRouter';
import userMetricsRouter from './userMetricsRouter';
import userOrganizationsRouter from './userOrganizationsRouter';

const router = express.Router();

router.use('/auth', authRouter);
// router.use('/emails', emailsRouter);
router.use('/campaigns', campaignsRouter);
router.use('/payments', paymentsRouter);
router.use('/social-sync', socialSyncRouter);
router.use('/rewards', rewardsRouter);
router.use('/subscribers', subscribersRouter);
router.use('/thoughts', thoughtsRouter);
router.use('/users/achievements', userAchievementsRouter);
router.use('/users/connections', userConnectionsRouter);
router.use('/users/notifications', notificationsRouter);
router.use('/users/metrics', userMetricsRouter);
router.use('/users/organizations', userOrganizationsRouter);
router.use('/users', usersRouter);
router.use('/users-groups', userGroupsRouter);

export default router;
