import * as express from 'express';
import {
    searchActiveMoments,
    searchBookmarkedMoments,
} from '../handlers/moments';

const router = express.Router();

// POST
router.post('/active/search', searchActiveMoments);
router.post('/bookmarked/search', searchBookmarkedMoments);

export default router;
