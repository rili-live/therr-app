import * as express from 'express';
import {
    createUserConnection,
    createOrInviteUserConnections,
    getUserConnection,
    searchUserConnections,
    updateUserConnection,
} from '../handlers/userConnections';

const router = express.Router();

// CREATE
router.post('/', createUserConnection);
router.post('/multi-invite', createOrInviteUserConnections);

// READ
router.get('/:requestingUserId', getUserConnection);
router.get('/', searchUserConnections);

// UPDATE
router.put('/', updateUserConnection);

export default router;
