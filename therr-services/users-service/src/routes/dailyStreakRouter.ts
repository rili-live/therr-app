import * as express from 'express';
import {
    getMyDailyStreak,
    markDailyStreakCelebrated,
    evaluateAllDailyStreaksHandler,
} from '../handlers/dailyStreak';
import { openDailyRewardChest } from '../handlers/rewardChests';

const router = express.Router();

// INTERNAL — not registered in the API gateway, so unreachable from the public internet.
// Fired by the internal scheduler (hourly is the intended cadence) and by the daily habits
// digest. See handlers/dailyStreak.ts.
router.post('/evaluate-all', evaluateAllDailyStreaksHandler);

// READ
router.get('/me', getMyDailyStreak);

// UPDATE
router.post('/me/celebrated', markDailyStreakCelebrated);
router.post('/me/reward-chest', openDailyRewardChest);

export default router;
