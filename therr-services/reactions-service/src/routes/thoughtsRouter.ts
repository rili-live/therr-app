import * as express from 'express';
import {
    searchActiveThoughts,
    searchBookmarkedThoughts,
} from '../handlers/thoughts';

const router = express.Router();

// POST
router.post('/active/search', searchActiveThoughts);
router.post('/bookmarked/search', searchBookmarkedThoughts);

export default router;
