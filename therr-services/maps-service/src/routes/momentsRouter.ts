import * as express from 'express';
import {
    createMoment,
    searchMoments,
    findMoments,
    deleteMoments,
} from '../handlers/moments';

const router = express.Router();

// CREATE
router.post('/', createMoment);

// SEARCH
router.post('/search', searchMoments);

router.post('/find', findMoments);

// DELETE
router.delete('/', deleteMoments);

export default router;
