import * as express from 'express';
import {
    searchActiveSpaces,
    searchBookmarkedSpaces,
} from '../handlers/spaces';

const router = express.Router();

// POST
router.post('/active/search', searchActiveSpaces);
router.post('/bookmarked/search', searchBookmarkedSpaces);

export default router;
