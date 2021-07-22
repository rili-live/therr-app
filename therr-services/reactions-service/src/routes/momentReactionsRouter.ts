import * as express from 'express';
import {
    createOrUpdateMomentReaction,
    createOrUpdateMultiMomentReactions,
    getMomentReactions,
    getReactionsByMomentId,
    findMomentReactions,
} from '../handlers/momentReactions';

const router = express.Router();

// CREATE/UPDATE
router.post('/:momentId', createOrUpdateMomentReaction);

router.post('/create-update/multiple', createOrUpdateMultiMomentReactions);

// GET
router.get('/', getMomentReactions);

// GET
router.get('/:momentId', getReactionsByMomentId);

// POST
router.post('/find/dynamic', findMomentReactions);

export default router;
