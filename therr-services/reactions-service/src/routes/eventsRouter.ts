import * as express from 'express';
import {
    searchActiveEvents,
    searchActiveEventsByIds,
    searchBookmarkedEvents,
} from '../handlers/events';

const router = express.Router();

// POST
router.post('/active/search', searchActiveEvents);
router.post('/active/search/ids', searchActiveEventsByIds);
router.post('/bookmarked/search', searchBookmarkedEvents);

export default router;
