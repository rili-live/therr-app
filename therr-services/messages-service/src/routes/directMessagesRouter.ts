import * as express from 'express';
import {
    createDirectMessage,
    searchDirectMessages,
    searchMyDirectMessages,
} from '../handlers/directMessages';

const router = express.Router();

// CREATE
router.post('/', createDirectMessage);

// READ
router.get('/', searchDirectMessages);
router.get('/me', searchMyDirectMessages);

export default router;
