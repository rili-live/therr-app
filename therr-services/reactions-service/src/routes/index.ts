import * as express from 'express';
import momentReactionsRouter from './momentReactionsRouter';
import momentsRouter from './momentsRouter';
import spaceReactionsRouter from './spaceReactionsRouter';
import spacesRouter from './spacesRouter';

const router = express.Router();

router.use('/moment-reactions', momentReactionsRouter);

router.use('/space-reactions', spaceReactionsRouter);

router.use('/moments', momentsRouter);

router.use('/spaces', spacesRouter);

export default router;
