import * as express from 'express';
import momentReactionsRouter from './momentReactionsRouter';
import momentsRouter from './momentsRouter';

const router = express.Router();

router.use('/moment-reactions', momentReactionsRouter);

router.use('/moments', momentsRouter);

export default router;
