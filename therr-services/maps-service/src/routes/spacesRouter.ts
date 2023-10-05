import * as express from 'express';
import {
    createSpace,
    getSpaceDetails,
    searchSpaces,
    searchMySpaces,
    requestSpace,
    findSpaces,
    getSignedUrlPublicBucket,
    getSignedUrlPrivateBucket,
    updateSpace,
    deleteSpaces,
} from '../handlers/spaces';

const router = express.Router();

// WRITE
router.post('/', createSpace);
router.put('/:spaceId', updateSpace);

// SEARCH
router.post('/:spaceId/details', getSpaceDetails);
router.post('/request-claim', requestSpace);
router.post('/list', searchSpaces);
router.post('/search', searchSpaces);
router.post('/search/me', searchMySpaces);
router.post('/find', findSpaces);

// GCS
router.get('/signed-url/public', getSignedUrlPublicBucket);
router.get('/signed-url/private', getSignedUrlPrivateBucket);

// DELETE
router.delete('/', deleteSpaces);

export default router;
