import * as express from 'express';
import {
    getUserHabits,
    getSoloEligibility,
    createUserHabit,
    archiveUserHabit,
    restoreUserHabit,
    continueSoloHabit,
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
// "Stop waiting on the invite — keep this habit alone." Distinct from restore:
// it also abandons the outstanding pact and enforces the solo-unlock gate.
router.put('/:id/continue-solo', continueSoloHabit);

export default router;
