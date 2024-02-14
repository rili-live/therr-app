import * as express from 'express';
import eventReactionsRouter from './eventReactionsRouter';
import eventsRouter from './eventsRouter';
import momentReactionsRouter from './momentReactionsRouter';
import momentsRouter from './momentsRouter';
import spaceReactionsRouter from './spaceReactionsRouter';
import spacesRouter from './spacesRouter';
import thoughtReactionsRouter from './thoughtReactionsRouter';
import thoughtsRouter from './thoughtsRouter';
import deleteUserData from '../handlers/deleteUserData';

const router = express.Router();

router.delete('/delete-user-data', deleteUserData);

router.use('/event-reactions', eventReactionsRouter);
router.use('/events', eventsRouter);
router.use('/moment-reactions', momentReactionsRouter);
router.use('/moments', momentsRouter);
router.use('/space-reactions', spaceReactionsRouter);
router.use('/spaces', spacesRouter);
router.use('/thought-reactions', thoughtReactionsRouter);
router.use('/thoughts', thoughtsRouter);

export default router;
