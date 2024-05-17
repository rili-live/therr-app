import * as express from 'express';
import {
    getNearbyConnections,
    createActivity,
} from '../handlers/activities';

const router = express.Router();

// READ
router.get('/connections', getNearbyConnections);

// WRITE
router.post('/', createActivity);

export default router;
