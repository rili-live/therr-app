import * as express from 'express';
import {
    createUserMetric,
    getUserMetrics,
} from '../handlers/userMetrics';

const router = express.Router();

// CREATE
router.post('/', createUserMetric);

// SEARCH
// router.get('/me', getUserMetrics);
router.get('/:contentUserId', getUserMetrics);

export default router;
