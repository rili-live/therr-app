import * as express from 'express';
import {
    createUser,
    getUser,
    getUsers,
    updateUser,
    deleteUser,
    verifyUserAccount,
    resendVerification,
} from '../handlers/users';

const router = express.Router();

// CREATE
router.post('/', createUser);

// READ
router.get('/:id', getUser);
router.get('/', getUsers);

// UPDATE
router.put('/:id', updateUser);

// DELETE
router.delete('/:id', deleteUser);

// OTHER
router.post('/verify/resend', resendVerification);
router.post('/verify/:token', verifyUserAccount);

export default router;
