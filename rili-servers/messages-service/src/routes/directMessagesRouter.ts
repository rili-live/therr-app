import * as express from 'express';
import {
    createDirectMessageValidation,
} from '../validation/directMessages';
import {
    validate,
} from '../validation';
import {
    createDirectMessage,
    searchDirectMessages,
} from '../handlers/directMessages';

const router = express.Router();

// CREATE
router.post('/', createDirectMessageValidation, validate, createDirectMessage);

// READ
router.get('/', searchDirectMessages);

export default router;
