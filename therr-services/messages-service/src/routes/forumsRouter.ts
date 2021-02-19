import * as express from 'express';
import {
    createForum,
    searchCategories,
    searchForums,
    updateForum,
} from '../handlers/forums';

const router = express.Router();

// CREATE
router.post('/', createForum);

// READ
router.post('/search', searchForums);
router.get('/categories', searchCategories);

// UPDATE
router.put('/:forumId', updateForum);

export default router;
