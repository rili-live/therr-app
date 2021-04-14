import * as express from 'express';
import {
    processUserLocationChange,
} from '../handlers/locationProcessing';

const router = express.Router();

// Process User Location Change
router.post('/process-user-location', processUserLocationChange);

export default router;
