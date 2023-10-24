import * as express from 'express';
import {
    createSpaceMetric,
    getSpaceMetrics,
} from '../handlers/spaceMetrics';

const router = express.Router();

// CREATE
router.post('/check-in', createSpaceMetric);
router.post('/', createSpaceMetric);

// SEARCH
router.get('/:spaceId/engagement', getSpaceMetrics);
router.get('/:spaceId', getSpaceMetrics);

export default router;
