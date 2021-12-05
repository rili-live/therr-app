import * as express from 'express';
import {
    createSpace,
    getSpaceDetails,
    searchSpaces,
    findSpaces,
    getSignedUrlPublicBucket,
    getSignedUrlPrivateBucket,
    deleteSpaces,
} from '../handlers/spaces';

const router = express.Router();

// CREATE
router.post('/', createSpace);

// SEARCH
router.post('/:spaceId/details', getSpaceDetails);
router.post('/search', searchSpaces);
router.post('/find', findSpaces);

// GCS
router.get('/signed-url/public', getSignedUrlPublicBucket);
router.get('/signed-url/private', getSignedUrlPrivateBucket);

// DELETE
router.delete('/', deleteSpaces);

export default router;
