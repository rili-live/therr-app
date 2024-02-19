import * as express from 'express';
import {
    createEvent,
    updateEvent,
    getEventDetails,
    searchEvents,
    searchMyEvents,
    searchGroupEvents,
    searchSpaceEvents,
    findEvents,
    getSignedUrlPublicBucket,
    getSignedUrlPrivateBucket,
    deleteEvents,
} from '../handlers/events';

const router = express.Router();

// WRITE
router.post('/', createEvent);
router.put('/:eventId', updateEvent);

// SEARCH
router.post('/:eventId/details', getEventDetails);
router.post('/search', searchEvents);
router.post('/search/me', searchMyEvents);
router.post('/search/for-group-ids', searchGroupEvents);
router.post('/search/for-space-ids', searchSpaceEvents);
router.post('/find', findEvents);

// GCS
router.get('/signed-url/public', getSignedUrlPublicBucket);
router.get('/signed-url/private', getSignedUrlPrivateBucket);

// DELETE
router.delete('/', deleteEvents);

export default router;
