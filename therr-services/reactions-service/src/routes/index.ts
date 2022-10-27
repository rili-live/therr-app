import * as express from 'express';
import momentReactionsRouter from './momentReactionsRouter';
import momentsRouter from './momentsRouter';
import spaceReactionsRouter from './spaceReactionsRouter';
import spacesRouter from './spacesRouter';
import deleteUserData from '../handlers/deleteUserData';

const router = express.Router();

router.delete('/delete-user-data', deleteUserData);

router.use('/moment-reactions', momentReactionsRouter);
router.use('/space-reactions', spaceReactionsRouter);
router.use('/moments', momentsRouter);
router.use('/spaces', spacesRouter);

export default router;
