import * as express from 'express';
import {
    createForumMessage,
    searchForumMessages,
} from '../handlers/forumMessages';

const router = express.Router();

// CREATE
router.post('/', createForumMessage);

// READ
router.post('/:forumId', searchForumMessages);

export default router;
