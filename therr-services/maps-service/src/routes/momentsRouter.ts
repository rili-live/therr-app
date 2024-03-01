import * as express from 'express';
import {
    createMoment,
    createIntegratedMoment,
    dynamicCreateIntegratedMoment,
    updateMoment,
    getMomentDetails,
    getIntegratedMoments,
    searchMoments,
    searchMyMoments,
    searchSpaceMoments,
    findMoments,
    getSignedUrlPublicBucket,
    getSignedUrlPrivateBucket,
    deleteMoments,
} from '../handlers/moments';

const router = express.Router();

// WRITE
router.post('/', createMoment);
router.post('/integrated', createIntegratedMoment);
router.post('/integrated/dynamic', dynamicCreateIntegratedMoment);
router.put('/:momentId', updateMoment);

// SEARCH
router.get('/integrated/:userId', getIntegratedMoments);
router.post('/:momentId/details', getMomentDetails);
router.post('/search', searchMoments);
router.post('/search/me', searchMyMoments);
router.post('/search/for-space-ids', searchSpaceMoments);
router.post('/find', findMoments);

// GCS
router.get('/signed-url/public', getSignedUrlPublicBucket);
router.get('/signed-url/private', getSignedUrlPrivateBucket);

// DELETE
router.delete('/', deleteMoments);

export default router;
