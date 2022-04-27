import * as express from 'express';
import {
    createMoment,
    updateMoment,
    getMomentDetails,
    searchMoments,
    searchMyMoments,
    findMoments,
    getSignedUrlPublicBucket,
    getSignedUrlPrivateBucket,
    deleteMoments,
} from '../handlers/moments';

const router = express.Router();

// WRITE
router.post('/', createMoment);
router.put('/:momentId', updateMoment);

// SEARCH
router.post('/:momentId/details', getMomentDetails);
router.post('/search', searchMoments);
router.post('/search/me', searchMyMoments);
router.post('/find', findMoments);

// GCS
router.get('/signed-url/public', getSignedUrlPublicBucket);
router.get('/signed-url/private', getSignedUrlPrivateBucket);

// DELETE
router.delete('/', deleteMoments);

export default router;
