import * as express from 'express';
import locationProcessingRouter from './locationProcessingRouter';

const router = express.Router();

router.use('/location', locationProcessingRouter);

export default router;
