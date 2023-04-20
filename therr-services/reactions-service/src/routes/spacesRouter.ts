import * as express from 'express';
import {
    searchActiveSpaces,
    searchActiveSpacesByIds,
    searchBookmarkedSpaces,
} from '../handlers/spaces';

const router = express.Router();

// POST
router.post('/active/search', searchActiveSpaces);
router.post('/active/search/ids', searchActiveSpacesByIds);
router.post('/bookmarked/search', searchBookmarkedSpaces);

export default router;
