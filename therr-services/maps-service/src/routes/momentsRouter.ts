import * as express from 'express';
import {
    createMoment,
    searchMoments,
} from '../handlers/moments';

const router = express.Router();

// CREATE
router.post('/', createMoment);

// SEARCH
router.get('/', searchMoments);

export default router;
