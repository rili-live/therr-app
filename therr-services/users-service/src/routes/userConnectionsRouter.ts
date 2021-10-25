import * as express from 'express';
import {
    createUserConnection,
    getUserConnection,
    searchUserConnections,
    updateUserConnection,
} from '../handlers/userConnections';

const router = express.Router();

// CREATE
router.post('/', createUserConnection);

// READ
router.get('/:requestingUserId', getUserConnection);
router.get('/', searchUserConnections);

// UPDATE
router.put('/', updateUserConnection);

export default router;
