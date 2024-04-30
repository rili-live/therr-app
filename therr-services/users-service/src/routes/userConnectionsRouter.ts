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

// PUBLIC
router.post('/', createUserConnection);
router.post('/multi-invite', createOrInviteUserConnections);
router.get('/:requestingUserId', getUserConnection);
router.get('/', searchUserConnections);
router.put('/', updateUserConnection);

// PRIVATE
router.post('/find-people', express.json({
    limit: '1000kb',
}), findPeopleYouMayKnow);

export default router;
