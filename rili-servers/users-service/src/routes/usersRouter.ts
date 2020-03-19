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

const router = express.Router();

// CREATE
router.post('/', createUserValidation, validate, createUser);

// READ
router.get('/:id', getUser);
router.get('/', getUsers);

// UPDATE
router.put('/:id', updateUser);

// DELETE
router.delete('/:id', deleteUser);

export default router;
