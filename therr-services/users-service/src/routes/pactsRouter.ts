import * as express from 'express';
import {
    createPact,
    bulkInvitePact,
    getPact,
    getUserPacts,
    getActivePacts,
    getPendingInvites,
    nudgePact,
    acceptPact,
    claimPactInvite,
    declinePact,
    abandonPact,
    completePact,
    deletePact,
} from '../handlers/pacts';
import runDailyHabitsDigest from '../handlers/habitsDigest';

const router = express.Router();

// INTERNAL — not registered in the API gateway, so unreachable from the
// public internet. Triggered once daily by an internal cron (see
// docs/WORK_IN_PROGRESS.md § Manual Operational Follow-ups).
router.post('/digest/run-daily', runDailyHabitsDigest);

// READ
router.get('/active', getActivePacts);
router.get('/invites', getPendingInvites);
router.get('/:id', getPact);
router.get('/', getUserPacts);

// CREATE
router.post('/', createPact);
router.post('/bulk-invite', bulkInvitePact);
router.post('/claim', claimPactInvite);

// UPDATE
router.put('/:id/nudge', nudgePact);
router.put('/:id/accept', acceptPact);
router.put('/:id/decline', declinePact);
router.put('/:id/abandon', abandonPact);
router.put('/:id/complete', completePact);

// DELETE
router.delete('/:id', deletePact);

export default router;
