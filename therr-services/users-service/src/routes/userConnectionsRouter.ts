import * as express from 'express';
import {
    createUserConnection,
    createOrInviteUserConnections,
    findPeopleYouMayKnow,
    getTopRankedConnections,
    getUserConnection,
    searchUserConnections,
    updateUserConnection,
    updateUserConnectionType,
    incrementUserConnection,
} from '../handlers/userConnections';

const router = express.Router();

// PUBLIC
router.post('/', createUserConnection);
router.post('/multi-invite', createOrInviteUserConnections);
router.post('/increment', incrementUserConnection);
router.get('/ranked', getTopRankedConnections);
router.get('/:requestingUserId', getUserConnection);
router.get('/', searchUserConnections);
router.put('/', updateUserConnection);
router.put('/type', updateUserConnectionType);

// PRIVATE
router.post('/find-people', express.json({
    limit: '1000kb',
}), findPeopleYouMayKnow);

export default router;
