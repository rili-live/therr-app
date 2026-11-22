import * as express from 'express';
import {
    createDrop,
    deleteDrop,
    getDrop,
    getReceivedDrops,
    getSentDrops,
    openDrop,
} from '../handlers/drops';

// Drops — see docs/DROPS.md.
const router = express.Router();

// READ (literal paths before `/:id`)
router.get('/received', getReceivedDrops);
router.get('/sent', getSentDrops);
router.get('/:id', getDrop);

// CREATE
router.post('/', createDrop);

// OPEN
router.post('/:id/open', openDrop);

// DELETE (sender deletes; recipient dismisses)
router.delete('/:id', deleteDrop);

export default router;
