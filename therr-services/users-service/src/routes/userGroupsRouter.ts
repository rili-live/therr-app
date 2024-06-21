import * as express from 'express';
import {
    getUserGroups,
    getGroupMembers,
    createUserGroup,
    internalCreateUserGroups,
    updateUserGroup,
    deleteUserGroup,
    notifyGroupMembers,
} from '../handlers/userGroups';

const router = express.Router();

// PUBLIC
router.get('/', getUserGroups);
router.get('/:id', getGroupMembers);
router.post('/', createUserGroup);
router.put('/:id', updateUserGroup);
router.delete('/:id', deleteUserGroup);
router.post('/notify-members', notifyGroupMembers);

// PRIVATE
router.post('/privileged', internalCreateUserGroups);

export default router;
