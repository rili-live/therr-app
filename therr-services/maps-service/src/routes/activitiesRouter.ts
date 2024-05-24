import * as express from 'express';
import {
    getNearbyConnections,
    generateActivity,
} from '../handlers/activities';

const router = express.Router();

// READ
router.get('/connections', getNearbyConnections);

// WRITE
router.post('/generate', generateActivity);

export default router;
