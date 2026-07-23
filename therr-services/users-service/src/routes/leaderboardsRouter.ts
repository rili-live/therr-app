import * as express from 'express';
import { getLeaderboard } from '../handlers/leaderboards';

const router = express.Router();

router.get('/', getLeaderboard);

export default router;
