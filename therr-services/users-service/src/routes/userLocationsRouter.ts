import * as express from 'express';
import {
    getUserLocations,
    getUserDwellingLocations,
    createUserLocations,
    updateUserLocation,
} from '../handlers/userLocations';

const router = express.Router();

// READ
router.get('/:userId/dwellings', getUserDwellingLocations);
router.get('/:userId', getUserLocations);

// WRITE
router.post('/:userId', createUserLocations);
router.put('/:userLocationId', updateUserLocation);

export default router;
