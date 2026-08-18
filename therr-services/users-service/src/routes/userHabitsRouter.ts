import * as express from 'express';
import {
    getUserHabits,
    getSoloEligibility,
    createUserHabit,
    archiveUserHabit,
    restoreUserHabit,
} from '../handlers/userHabits';

const router = express.Router();

// READ
// Literal before any `:id` sibling — Express matches in registration order, and
// the gateway asserts the same ordering at boot.
router.get('/eligibility', getSoloEligibility);
router.get('/', getUserHabits);

// CREATE
router.post('/', createUserHabit);

// UPDATE
router.put('/:id/archive', archiveUserHabit);
router.put('/:id/restore', restoreUserHabit);

export default router;
