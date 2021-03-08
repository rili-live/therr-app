import * as express from 'express';
import momentReactionsRouter from './momentReactionsRouter';

const router = express.Router();

router.use('/moment-reactions', momentReactionsRouter);

export default router;
