import * as express from 'express';
import {
    createMoment,
    searchMoments,
    findMoments,
    getSignedUrlPublicBucket,
    getSignedUrlPrivateBucket,
    deleteMoments,
} from '../handlers/moments';

const router = express.Router();

// CREATE
router.post('/', createMoment);

// SEARCH
router.post('/search', searchMoments);

router.post('/find', findMoments);

// GCS
router.get('/signed-url/public', getSignedUrlPublicBucket);
router.get('/signed-url/private', getSignedUrlPrivateBucket);

// DELETE
router.delete('/', deleteMoments);

export default router;
