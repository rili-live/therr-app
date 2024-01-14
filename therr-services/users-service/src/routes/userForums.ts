import * as express from 'express';
import {
    getUserForums,
    createUserForum,
} from '../handlers/userForums';

const router = express.Router();

// READ
router.get('/', getUserForums);

// WRITE
router.post('/', createUserForum);

export default router;
