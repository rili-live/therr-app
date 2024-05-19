import * as express from 'express';
import {
    createUpdateUserInterests,
    getUserInterests,
    incrementUserInterests,
} from '../handlers/userInterests';

const router = express.Router();

// PUBLIC
router.get('/me', getUserInterests);
router.post('/me', createUpdateUserInterests);
router.post('/increment', incrementUserInterests);

// PRIVATE
router.get('/:userId', getUserInterests);

export default router;
