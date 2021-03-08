import * as express from 'express';
import {
    createMomentReaction,
    getMomentReactions,
    updateMomentReaction,
} from '../handlers/momentReactions';

const router = express.Router();

// CREATE
router.post('/', createMomentReaction);

// GET
router.get('/', getMomentReactions);

// DELETE
router.put('/:momentId', updateMomentReaction);

export default router;
