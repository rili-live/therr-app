import * as express from 'express';
import {
    getUserLocations,
    createUserLocations,
} from '../handlers/userLocations';

const router = express.Router();

// READ
router.get('/:userId', getUserLocations);

// WRITE
router.post('/:userId', createUserLocations);

export default router;
