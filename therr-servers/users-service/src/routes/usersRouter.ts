import * as express from 'express';
import {
    createUserValidation,
} from '../validation/users';
import {
    validate,
} from '../validation';
import {
    createUser,
    getUser,
    getUsers,
    updateUser,
    deleteUser,
} from '../handlers/users';
import authenticate from '../middleware/authenticate';

const router = express.Router();

// CREATE
router.post('/', createUserValidation, validate, createUser);

// READ
router.get('/:id', authenticate, getUser);
router.get('/', authenticate, getUsers);

// UPDATE
router.put('/:id', authenticate, updateUser);

// DELETE
router.delete('/:id', authenticate, deleteUser);

export default router;
