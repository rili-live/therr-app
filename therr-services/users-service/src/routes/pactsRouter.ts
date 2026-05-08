import * as express from 'express';
import {
    createPact,
    bulkInvitePact,
    getPact,
    getUserPacts,
    getActivePacts,
    getPendingInvites,
    acceptPact,
    declinePact,
    abandonPact,
    completePact,
    deletePact,
} from '../handlers/pacts';

const router = express.Router();

// READ
router.get('/active', getActivePacts);
router.get('/invites', getPendingInvites);
router.get('/:id', getPact);
router.get('/', getUserPacts);

// CREATE
router.post('/', createPact);
router.post('/bulk-invite', bulkInvitePact);

// UPDATE
router.put('/:id/accept', acceptPact);
router.put('/:id/decline', declinePact);
router.put('/:id/abandon', abandonPact);
router.put('/:id/complete', completePact);

// DELETE
router.delete('/:id', deletePact);

export default router;
