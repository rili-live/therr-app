import * as express from 'express';
import {
    createMomentReaction,
    getMomentReactions,
    getMomentReactionsByMomentId,
    updateMomentReaction,
} from '../handlers/momentReactions';

const router = express.Router();

// CREATE
router.post('/', createMomentReaction);

// GET
router.get('/', getMomentReactions);

// GET
router.get('/:momentId', getMomentReactionsByMomentId);

// DELETE
router.put('/:momentId', updateMomentReaction);

export default router;
