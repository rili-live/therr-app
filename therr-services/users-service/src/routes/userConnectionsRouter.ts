import * as express from 'express';
import {
    createUserConnection,
    createOrInviteUserConnections,
    findPeopleYouMayKnow,
    getUserConnection,
    searchUserConnections,
    updateUserConnection,
} from '../handlers/userConnections';

const router = express.Router();

// CREATE
router.post('/', createUserConnection);
router.post('/multi-invite', createOrInviteUserConnections);
router.post('/find-people', express.json({
    limit: '1000kb',
}), findPeopleYouMayKnow);

// READ
router.get('/:requestingUserId', getUserConnection);
router.get('/', searchUserConnections);

// UPDATE
router.put('/', updateUserConnection);

export default router;
