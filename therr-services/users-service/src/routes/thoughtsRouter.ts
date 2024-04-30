import * as express from 'express';
import {
    createThought,
    getThoughtDetails,
    searchThoughts,
    findThoughts,
    deleteThoughts,
} from '../handlers/thoughts';

const router = express.Router();

// PRIVATE
router.post('/find', findThoughts);

// PUBLIC
router.post('/', createThought);
router.post('/search', searchThoughts);
router.post('/:thoughtId/details', getThoughtDetails);
router.delete('/', deleteThoughts);

export default router;
