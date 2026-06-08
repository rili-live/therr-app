import * as express from 'express';
import {
    createSpace,
    getSpaceDetails,
    getSpaceReportsSummary,
    searchSpaces,
    searchMySpaces,
    claimSpace,
    requestSpace,
    approveSpaceRequest,
    findSpaces,
    getSpacePairings,
    submitPairingFeedback,
    getSignedUrlPublicBucket,
    getSignedUrlPrivateBucket,
    updateSpace,
    deleteSpaces,
} from '../handlers/spaces';
import { submitCorrection, getCorrectionsSummary } from '../handlers/spaceCorrections';

const router = express.Router();

// PAIRINGS (must be before /:spaceId catch-all patterns)
router.get('/:spaceId/pairings', getSpacePairings);
router.get('/:spaceId/reports-summary', getSpaceReportsSummary);
router.post('/:spaceId/pairings/feedback', submitPairingFeedback);

// CORRECTIONS (crowdsourced edits to business info)
router.post('/:spaceId/corrections', submitCorrection);
router.get('/:spaceId/corrections/summary', getCorrectionsSummary);

// WRITE
router.post('/', createSpace);
router.put('/:spaceId', updateSpace);

// SEARCH
router.post('/:spaceId/details', getSpaceDetails);
router.post('/request-claim', requestSpace);
router.post('/request-claim/:spaceId', claimSpace);
router.post('/request-approve/:spaceId', approveSpaceRequest);
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
