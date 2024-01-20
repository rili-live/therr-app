import * as express from 'express';
import {
    getUserGroups,
    getGroupMembers,
    createUserGroup,
    internalCreateUserGroup,
    updateUserGroup,
    deleteUserGroup,
    notifyGroupMembers,
} from '../handlers/userGroups';

const router = express.Router();

// READ
router.get('/', getUserGroups);
router.get('/:id', getGroupMembers);

// WRITE
router.post('/', createUserGroup);
router.post('/priviledged', internalCreateUserGroup);
router.put('/:id', updateUserGroup);
router.delete('/:id', deleteUserGroup);
router.post('/notify-members', notifyGroupMembers);

export default router;
