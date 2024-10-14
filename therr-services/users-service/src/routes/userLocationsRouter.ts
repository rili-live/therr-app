import * as express from 'express';
import {
    getUserLocations,
    createUserLocations,
    updateUserLocation,
} from '../handlers/userLocations';

const router = express.Router();

// READ
router.get('/:userId', getUserLocations);

// WRITE
router.post('/:userId', createUserLocations);
router.put('/:userLocationId', updateUserLocation);

export default router;
