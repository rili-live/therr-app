import * as express from 'express';
import {
    createOrUpdateMomentReaction,
    getMomentReactions,
    getReactionsByMomentId,
} from '../handlers/momentReactions';

const router = express.Router();

// CREATE/UPDATE
router.post('/:momentId', createOrUpdateMomentReaction);

// GET
router.get('/', getMomentReactions);

// GET
router.get('/:momentId', getReactionsByMomentId);

export default router;
