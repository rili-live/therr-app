import * as express from 'express';
import momentsRouter from './momentsRouter';
import spacesRouter from './spacesRouter';

const router = express.Router();

router.use('/moments', momentsRouter);
router.use('/spaces', spacesRouter);

export default router;
