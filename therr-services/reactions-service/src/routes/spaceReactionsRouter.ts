import * as express from 'express';
import {
    createOrUpdateSpaceReaction,
    createOrUpdateMultiSpaceReactions,
    getSpaceReactions,
    getSpaceRatings,
    getBatchSpaceRatings,
    getReactionsBySpaceId,
    getVisitedSpaces,
    countSpaceReactions,
    findSpaceReactions,
} from '../handlers/spaceReactions';

const router = express.Router();

// CREATE/UPDATE
router.post('/:spaceId', createOrUpdateSpaceReaction);

router.post('/create-update/multiple', createOrUpdateMultiSpaceReactions);
// GET
router.get('/', getSpaceReactions);

// GET - visited spaces (must be before /:spaceId to avoid param conflict)
router.get('/visited', getVisitedSpaces);

// GET
router.get('/:spaceId/ratings', getSpaceRatings);

// GET
router.get('/:spaceId', getReactionsBySpaceId);
router.get('/:spaceId/count', countSpaceReactions);

// POST
router.post('/ratings/batch', getBatchSpaceRatings);
router.post('/find/dynamic', findSpaceReactions);

export default router;
