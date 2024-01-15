import * as express from 'express';
import {
    getUserForums,
    createUserForum,
    updateUserForum,
    deleteUserForum,
} from '../handlers/userForums';

const router = express.Router();

// READ
router.get('/', getUserForums);

// WRITE
router.post('/', createUserForum);
router.put('/:id', updateUserForum);
router.delete('/:id', deleteUserForum);

export default router;
