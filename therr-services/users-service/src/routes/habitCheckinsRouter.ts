import * as express from 'express';
import {
    createCheckin,
    getCheckin,
    getTodayCheckins,
    getCheckinsByDateRange,
    getPactCheckins,
    updateCheckin,
    skipCheckin,
    deleteCheckin,
} from '../handlers/habitCheckins';

const router = express.Router();

// READ
router.get('/today', getTodayCheckins);
router.get('/range', getCheckinsByDateRange);
router.get('/pact/:pactId', getPactCheckins);
router.get('/:id', getCheckin);

// CREATE
router.post('/', createCheckin);

// UPDATE
router.put('/:id', updateCheckin);
router.put('/:id/skip', skipCheckin);

// DELETE
router.delete('/:id', deleteCheckin);

export default router;
