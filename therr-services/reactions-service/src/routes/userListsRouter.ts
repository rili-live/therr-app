import * as express from 'express';
import { asyncHandler } from 'therr-js-utilities/http';
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

// Handlers with custom error branching (PG 23505 unique-violation mapping) still
// own their try/catch and are wired directly. The rest are wrapped with
// `asyncHandler` so rejected promises route through the shared `handleHttpError`
// with a grep-able context label.
router.post('/', createUserList);
router.get('/', asyncHandler('SQL:USER_LISTS_ROUTES:GET', getUserLists));

// Lookup: which of the user's lists contain a given space (used by the picker)
router.get('/for-space/:spaceId', asyncHandler('SQL:USER_LISTS_ROUTES:FOR_SPACE', getListsForSpace));

router.get('/:listId', asyncHandler('SQL:USER_LISTS_ROUTES:GET_BY_ID', getUserListById));
router.patch('/:listId', updateUserList);
router.delete('/:listId', asyncHandler('SQL:USER_LISTS_ROUTES:DELETE', deleteUserList));

// Membership
router.post('/:listId/spaces', asyncHandler('SQL:USER_LISTS_ROUTES:ADD_SPACE', addSpaceToList));
router.delete('/:listId/spaces/:spaceId', asyncHandler('SQL:USER_LISTS_ROUTES:REMOVE_SPACE', removeSpaceFromList));

export default router;
