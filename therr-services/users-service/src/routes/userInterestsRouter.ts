import * as express from 'express';
import {
    createUpdateUserInterests,
    getUserInterests,
} from '../handlers/userInterests';

const router = express.Router();

// READ
router.get('/me', getUserInterests);
router.get('/:userId', getUserInterests);

// WRITE
router.post('/me', createUpdateUserInterests);

export default router;
