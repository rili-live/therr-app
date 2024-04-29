import * as express from 'express';
import {
    createUpdateUserInterests,
    getUserInterests,
} from '../handlers/userInterests';

const router = express.Router();

// PUBLIC
router.get('/me', getUserInterests);
router.post('/me', createUpdateUserInterests);

// PRIVATE
router.get('/:userId', getUserInterests);

export default router;
