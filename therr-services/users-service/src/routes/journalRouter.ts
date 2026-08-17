import * as express from 'express';
import {
    getJournalFeed,
    createJournalEntry,
    updateJournalEntry,
    deleteJournalEntry,
} from '../handlers/journal';

const router = express.Router();

// READ
router.get('/', getJournalFeed);

// CREATE
router.post('/', createJournalEntry);

// UPDATE
router.put('/:id', updateJournalEntry);

// DELETE
router.delete('/:id', deleteJournalEntry);

export default router;
