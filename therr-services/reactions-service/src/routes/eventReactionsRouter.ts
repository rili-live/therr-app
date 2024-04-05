import * as express from 'express';
import {
    createOrUpdateEventReaction,
    createOrUpdateMultiEventReactions,
    createOrUpdateMultiUserReactions,
    getEventReactions,
    getEventRatings,
    getReactionsByEventId,
    countEventReactions,
    findEventReactions,
} from '../handlers/eventReactions';

const router = express.Router();

// CREATE/UPDATE
router.post('/:eventId', createOrUpdateEventReaction);

router.post('/create-update/multiple', createOrUpdateMultiEventReactions);

router.post('/create-update/multiple-users', createOrUpdateMultiUserReactions);
// GET
router.get('/', getEventReactions);

// GET
router.get('/:eventId/ratings', getEventRatings);

// GET
router.get('/:eventId', getReactionsByEventId);
router.get('/:eventId/count', countEventReactions);

// POST
router.post('/find/dynamic', findEventReactions);

export default router;
