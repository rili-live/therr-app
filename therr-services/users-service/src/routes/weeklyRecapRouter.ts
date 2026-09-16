import * as express from 'express';
import { getMyWeeklyRecap } from '../handlers/weeklyRecap';

const router = express.Router();

// READ
router.get('/me', getMyWeeklyRecap);

export default router;
