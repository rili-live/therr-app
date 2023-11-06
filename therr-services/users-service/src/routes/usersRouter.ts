import * as express from 'express';
import {
    createUser,
    getMe,
    getUser,
    getUserByPhoneNumber,
    getUserByUserName,
    getUsers,
    findUsers,
    searchUsers,
    updateUser,
    updatePhoneVerification,
    updateUserCoins,
    blockUser,
    reportUser,
    updateUserPassword,
    deleteUser,
    createOneTimePassword,
    verifyUserAccount,
    resendVerification,
    requestSpace,
    updateLastKnownLocation,
} from '../handlers/users';

const router = express.Router();

// CREATE
router.post('/', createUser);

// READ
router.get('/me', getMe);
router.get('/:id', getUser);
router.get('/', getUsers);
router.get('/by-phone/:phoneNumber', getUserByPhoneNumber);
router.get('/by-username/:userName', getUserByUserName);
router.post('/find', findUsers);
router.post('/search', searchUsers);

// UPDATE
router.put('/change-password', updateUserPassword);
router.put('/:id', updateUser);
router.put('/:id/location', updateLastKnownLocation);
router.put('/:id/verify-phone', updatePhoneVerification); // apply phone verified access level
router.put('/:id/block', blockUser);
router.put('/:id/report', reportUser);
router.put('/:id/coins', updateUserCoins);
router.put('/:id/location', updateUserCoins);

// DELETE
router.delete('/:id', deleteUser);

// OTHER
router.post('/forgot-password', createOneTimePassword);
router.post('/verify/resend', resendVerification);
router.post('/verify/:token', verifyUserAccount);
router.post('/request-space', requestSpace);
router.post('/request-space/:spaceId', requestSpace);

export default router;
