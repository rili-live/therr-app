import * as express from 'express';
import { getLeaderboard, acknowledgeLeaderboardPeriod } from '../handlers/leaderboards';

const router = express.Router();

router.get('/', getLeaderboard);

// The user has seen their placement for a closed period. `periodStart` (YYYY-MM-DD, the
// Monday of the week) is the period id.
router.post('/periods/:periodStart/acknowledge', acknowledgeLeaderboardPeriod);

export default router;
