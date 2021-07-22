import * as express from 'express';
import momentsRouter from './momentsRouter';

const router = express.Router();

router.use('/moments', momentsRouter);

export default router;
