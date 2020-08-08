import * as express from 'express';
import {
    createUserConnectionValidation,
} from '../validation/userConnections';
import {
    validate,
} from '../validation';
import {
    createUserConnection,
    getUserConnection,
    searchUserConnections,
    updateUserConnection,
} from '../handlers/userConnections';
import authenticate from '../middleware/authenticate';

const router = express.Router();

// CREATE
router.post('/', authenticate, createUserConnectionValidation, validate, createUserConnection);

// READ
router.get('/:requestingUserId', authenticate, getUserConnection);
router.get('/', authenticate, searchUserConnections);

// UPDATE
router.put('/:requestingUserId', authenticate, updateUserConnection);

export default router;
