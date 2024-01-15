import * as express from 'express';
import {
    createForum,
    searchCategories,
    getForum,
    searchForums,
    updateForum,
} from '../handlers/forums';

const router = express.Router();

// CREATE
router.post('/', createForum);

// READ
router.post('/search', searchForums);
router.get('/categories', searchCategories);
router.get('/:forumId', getForum);

// UPDATE
router.put('/:forumId', updateForum);

export default router;
