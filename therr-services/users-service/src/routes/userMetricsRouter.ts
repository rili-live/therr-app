import * as express from 'express';
import {
    createUserMetric,
    getUserMetrics,
    getMomentMetrics,
} from '../handlers/userMetrics';

const router = express.Router();

// CREATE
router.post('/', createUserMetric);

// SEARCH
// router.get('/me', getUserMetrics);
router.get('/:contentUserId', getUserMetrics);
router.get('/moments/:momentId', getMomentMetrics);

export default router;
