import * as express from 'express';
import {
    createThought,
    getThoughtDetails,
    searchThoughts,
    findThoughts,
    deleteThoughts,
} from '../handlers/thoughts';

const router = express.Router();

// CREATE
router.post('/', createThought);

// SEARCH
router.post('/:spaceId/details', getThoughtDetails);
router.post('/search', searchThoughts);
router.post('/find', findThoughts);

// DELETE
router.delete('/', deleteThoughts);

export default router;
