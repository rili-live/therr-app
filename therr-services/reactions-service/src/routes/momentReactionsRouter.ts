import * as express from 'express';
import {
    createOrUpdateMomentReaction,
    createOrUpdateMultiMomentReactions,
    getMomentReactions,
    getReactionsByMomentId,
    findMomentReactions,
    countMomentReactions,
} from '../handlers/momentReactions';

const router = express.Router();

// CREATE/UPDATE
router.post('/:momentId', createOrUpdateMomentReaction);

router.post('/create-update/multiple', createOrUpdateMultiMomentReactions);

// GET
router.get('/', getMomentReactions);

// GET
router.get('/:momentId', getReactionsByMomentId);
router.get('/:momentId/count', countMomentReactions);

// POST
router.post('/find/dynamic', findMomentReactions);

export default router;
