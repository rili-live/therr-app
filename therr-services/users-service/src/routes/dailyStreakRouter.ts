import * as express from 'express';
import {
    getMyDailyStreak,
    getMyDailyStreakCalendar,
    markDailyStreakCelebrated,
    evaluateAllDailyStreaksHandler,
} from '../handlers/dailyStreak';

const router = express.Router();

// INTERNAL — not registered in the API gateway, so unreachable from the public internet.
// Fired by the internal scheduler (hourly is the intended cadence) and by the daily habits
// digest. See handlers/dailyStreak.ts.
router.post('/evaluate-all', evaluateAllDailyStreaksHandler);

// READ
router.get('/me', getMyDailyStreak);
router.get('/me/calendar', getMyDailyStreakCalendar);

// UPDATE
router.post('/me/celebrated', markDailyStreakCelebrated);

export default router;
