import * as express from 'express';
import {
    createOrUpdateSpaceReaction,
    createOrUpdateMultiSpaceReactions,
    getSpaceReactions,
    getSpaceRatings,
    getReactionsBySpaceId,
    countSpaceReactions,
    findSpaceReactions,
} from '../handlers/spaceReactions';

const router = express.Router();

// CREATE/UPDATE
router.post('/:spaceId', createOrUpdateSpaceReaction);

router.post('/create-update/multiple', createOrUpdateMultiSpaceReactions);
// GET
router.get('/', getSpaceReactions);

// GET
router.get('/:spaceId/ratings', getSpaceRatings);

// GET
router.get('/:spaceId', getReactionsBySpaceId);
router.get('/:spaceId/count', countSpaceReactions);

// POST
router.post('/find/dynamic', findSpaceReactions);

export default router;
