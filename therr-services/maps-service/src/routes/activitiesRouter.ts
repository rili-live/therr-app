import * as express from 'express';
import {
    getNearbyConnections,
    generateActity,
} from '../handlers/activities';

const router = express.Router();

// READ
router.get('/connections', getNearbyConnections);

// WRITE
router.post('/generate', generateActity);

export default router;
