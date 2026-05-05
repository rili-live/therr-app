import * as express from 'express';
import {
    createActivity,
    getActivitiesByPactId,
} from '../handlers/pactActivities';

const router = express.Router({ mergeParams: true });

router.post('/:pactId/activities', createActivity);
router.get('/:pactId/activities', getActivitiesByPactId);

export default router;
