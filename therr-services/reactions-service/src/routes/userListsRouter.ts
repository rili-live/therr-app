import * as express from 'express';
import {
    createUserList,
    getUserLists,
    getUserListById,
    updateUserList,
    deleteUserList,
    addSpaceToList,
    removeSpaceFromList,
    getListsForSpace,
} from '../handlers/userLists';

const router = express.Router();

// List CRUD
router.post('/', createUserList);
router.get('/', getUserLists);

// Lookup: which of the user's lists contain a given space (used by the picker)
router.get('/for-space/:spaceId', getListsForSpace);

router.get('/:listId', getUserListById);
router.patch('/:listId', updateUserList);
router.delete('/:listId', deleteUserList);

// Membership
router.post('/:listId/spaces', addSpaceToList);
router.delete('/:listId/spaces/:spaceId', removeSpaceFromList);

export default router;
