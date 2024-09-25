import * as express from 'express';
import {
    processUserLocationChange,
    processUserBackgroundLocation,
} from '../handlers/locationProcessing';

const router = express.Router();

// Process User Location Change
router.post('/process-user-location', processUserLocationChange);

router.post('/process-user-background-location', processUserBackgroundLocation);

export default router;
