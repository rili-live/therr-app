import * as express from 'express';
import {
    createActivity,
} from '../handlers/activities';

const router = express.Router();

// WRITE
router.post('/', createActivity);

export default router;
