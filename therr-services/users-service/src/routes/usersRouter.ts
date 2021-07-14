import * as express from 'express';
import {
    createUser,
    getUser,
    getUsers,
    findUsers,
    updateUser,
    updateUserPassword,
    deleteUser,
    createOneTimePassword,
    verifyUserAccount,
    resendVerification,
} from '../handlers/users';

const router = express.Router();

// CREATE
router.post('/', createUser);

// READ
router.get('/:id', getUser);
router.get('/', getUsers);
router.post('/find', findUsers);

// UPDATE
router.put('/change-password', updateUserPassword);
router.put('/:id', updateUser);

// DELETE
router.delete('/:id', deleteUser);

// OTHER
router.post('/forgot-password', createOneTimePassword);
router.post('/verify/resend', resendVerification);
router.post('/verify/:token', verifyUserAccount);

export default router;
