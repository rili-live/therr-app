import * as express from 'express';
import {
    searchActiveMoments,
    searchActiveMomentsByIds,
    searchBookmarkedMoments,
} from '../handlers/moments';

const router = express.Router();

// POST
router.post('/active/search', searchActiveMoments);
router.post('/active/search/ids', searchActiveMomentsByIds);
router.post('/bookmarked/search', searchBookmarkedMoments);

export default router;
