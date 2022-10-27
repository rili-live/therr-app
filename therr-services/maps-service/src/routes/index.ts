import * as express from 'express';
import momentsRouter from './momentsRouter';
import spacesRouter from './spacesRouter';
import deleteUserData from '../handlers/deleteUserData';

const router = express.Router();

router.delete('/delete-user-data', deleteUserData);

router.use('/moments', momentsRouter);
router.use('/spaces', spacesRouter);

export default router;
