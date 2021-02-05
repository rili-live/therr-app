import * as express from 'express';
import {
    createForumMessage,
    searchForumMessages,
} from '../handlers/forumMessages';

const router = express.Router();

// CREATE
router.post('/', createForumMessage);

// READ
router.get('/:forumId', searchForumMessages);

export default router;
