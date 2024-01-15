import * as express from 'express';
import {
    getUserGroups,
    createUserGroup,
    updateUserGroup,
    deleteUserGroup,
} from '../handlers/userGroups';

const router = express.Router();

// READ
router.get('/', getUserGroups);

// WRITE
router.post('/', createUserGroup);
router.put('/:id', updateUserGroup);
router.delete('/:id', deleteUserGroup);

export default router;
