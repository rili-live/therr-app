import * as express from 'express';
import {
    createOrUpdateThoughtReaction,
    createOrUpdateMultiThoughtReactions,
    getThoughtReactions,
    getReactionsByThoughtId,
    countThoughtReactions,
    countMultiThoughtReactions,
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
router.get('/:thoughtId/count', countThoughtReactions);

// POST
router.post('/find/dynamic', findThoughtReactions);
// Two path segments, so this cannot be swallowed by the single-segment `POST /:thoughtId` above.
router.post('/count/multiple', countMultiThoughtReactions);

export default router;
