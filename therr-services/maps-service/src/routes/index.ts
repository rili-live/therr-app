import * as express from 'express';
import eventsRouter from './eventsRouter';
import momentsRouter from './momentsRouter';
import spacesRouter from './spacesRouter';
import spaceMetricsRouter from './spaceMetricsRouter';
import createMediaUrls from '../handlers/createMediaUrls';
import deleteUserData from '../handlers/deleteUserData';

const router = express.Router();

router.delete('/delete-user-data', deleteUserData);

router.post('/media/signed-urls', createMediaUrls);

router.use('/events', eventsRouter);
router.use('/moments', momentsRouter);
router.use('/spaces', spacesRouter);
router.use('/space-metrics', spaceMetricsRouter);

export default router;
