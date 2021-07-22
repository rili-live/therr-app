import * as express from 'express';
import {
    createDirectMessage,
    searchDirectMessages,
} from '../handlers/directMessages';

const router = express.Router();

// CREATE
router.post('/', createDirectMessage);

// READ
router.get('/', searchDirectMessages);

export default router;
