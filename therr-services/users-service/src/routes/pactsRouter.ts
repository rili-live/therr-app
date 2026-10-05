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
    renewPact,
    addPactMembers,
    removePactMember,
    continueSoloPact,
    setPactPledge,
    clearPactPledge,
    deletePact,
} from '../handlers/pacts';
import {
    getOpenPacts,
    setPactOpen,
    requestToJoinPact,
    cancelJoinRequest,
    getPactJoinRequests,
    approveJoinRequest,
    declineJoinRequest,
} from '../handlers/pactJoinRequests';
import runDailyHabitsDigest from '../handlers/habitsDigest';

const router = express.Router();

// INTERNAL — not registered in the API gateway, so unreachable from the
// public internet. Triggered once daily by an internal cron (see
// docs/WORK_IN_PROGRESS.md § Manual Operational Follow-ups).
router.post('/digest/run-daily', runDailyHabitsDigest);

// READ
router.get('/active', getActivePacts);
router.get('/invites', getPendingInvites);
// Before '/:id', which would otherwise read "open" as a pact id.
router.get('/open', getOpenPacts);
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
router.put('/:id/renew', renewPact);
router.put('/:id/continue-solo', continueSoloPact);

// PLEDGE (the caller's own, per member)
router.put('/:id/pledge', setPactPledge);
router.delete('/:id/pledge', clearPactPledge);

// OPEN PACTS (opt-in; see handlers/pactJoinRequests.ts)
router.put('/:id/open', setPactOpen);
router.get('/:id/join-requests', getPactJoinRequests);
router.post('/:id/join-requests', requestToJoinPact);
router.delete('/:id/join-requests/mine', cancelJoinRequest);
router.put('/:id/join-requests/:requestId/approve', approveJoinRequest);
router.put('/:id/join-requests/:requestId/decline', declineJoinRequest);

// MEMBERS
router.post('/:id/members', addPactMembers);
router.delete('/:id/members/:userId', removePactMember);

// DELETE
router.delete('/:id', deletePact);

export default router;
