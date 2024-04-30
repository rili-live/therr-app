import * as express from 'express';
import {
    getInterests,
} from '../handlers/interests';

const router = express.Router();

// PUBLIC
router.get('/', getInterests);

export default router;
