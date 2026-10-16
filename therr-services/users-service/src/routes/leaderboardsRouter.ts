import * as express from 'express';
import { getLeaderboard, acknowledgeLeaderboardPeriod, recordAppOpen } from '../handlers/leaderboards';

const router = express.Router();

router.get('/', getLeaderboard);

// The client opened the app; the first few opens of a day earn a little XP.
router.post('/app-opens', recordAppOpen);

// The user has seen their placement for a closed period. `periodStart` (YYYY-MM-DD, the
// Monday of the week) is the period id.
router.post('/periods/:periodStart/acknowledge', acknowledgeLeaderboardPeriod);

export default router;
