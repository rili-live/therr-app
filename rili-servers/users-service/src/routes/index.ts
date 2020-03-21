import * as express from 'express';
import authRouter from './authRouter';
import usersRouter from './usersRouter';
import userConnectionsRouter from './userConnectionsRouter';

const router = express.Router();

router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/users/connections', userConnectionsRouter);

export default router;
