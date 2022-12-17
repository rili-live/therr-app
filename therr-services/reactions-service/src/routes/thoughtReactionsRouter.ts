import * as express from 'express';
import {
    createOrUpdateThoughtReaction,
    createOrUpdateMultiThoughtReactions,
    getThoughtReactions,
    getReactionsByThoughtId,
    findThoughtReactions,
} from '../handlers/thoughtReactions';

const router = express.Router();

// CREATE/UPDATE
router.post('/:thoughtId', createOrUpdateThoughtReaction);

router.post('/create-update/multiple', createOrUpdateMultiThoughtReactions);

// GET
router.get('/', getThoughtReactions);

// GET
router.get('/:thoughtId', getReactionsByThoughtId);

// POST
router.post('/find/dynamic', findThoughtReactions);

export default router;
