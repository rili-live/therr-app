import * as express from 'express';
import {
    createUserLocations,
} from '../handlers/userLocations';

const router = express.Router();

// WRITE
router.post('/:userId', createUserLocations);

export default router;
