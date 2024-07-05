import * as express from 'express';
import {
    createActivity,
    createForum,
    searchCategories,
    getForum,
    findForums,
    searchForums,
    updateForum,
    archiveForum,
} from '../handlers/forums';

const router = express.Router();

// CREATE
router.post('/', createForum);
router.post('/activities', createActivity);

// READ
router.post('/find', findForums); // internal route
router.post('/search', searchForums);
router.get('/categories', searchCategories);
router.get('/:forumId', getForum);

// UPDATE
router.put('/:forumId', updateForum);
router.delete('/:forumId', archiveForum);

export default router;
