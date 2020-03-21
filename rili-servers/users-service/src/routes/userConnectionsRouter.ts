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

const router = express.Router();

// CREATE
router.post('/', createUserConnectionValidation, validate, createUserConnection);

// READ
router.get('/:requestingUserId', getUserConnection);
router.get('/', searchUserConnections);

// UPDATE
router.put('/:requestingUserId', updateUserConnection);

export default router;
