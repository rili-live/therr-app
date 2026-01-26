import * as express from 'express';
import {
    getStreak,
    getUserStreaks,
    getActiveStreaks,
    getStreakByHabit,
    getPactStreaks,
    getStreakHistory,
    getMilestones,
    getTopStreaks,
    useGraceDay,
} from '../handlers/streaks';

const router = express.Router();

// READ
router.get('/active', getActiveStreaks);
router.get('/milestones', getMilestones);
router.get('/top', getTopStreaks);
router.get('/habit/:habitGoalId', getStreakByHabit);
router.get('/pact/:pactId', getPactStreaks);
router.get('/:id/history', getStreakHistory);
router.get('/:id', getStreak);
router.get('/', getUserStreaks);

// UPDATE
router.put('/:id/grace', useGraceDay);

export default router;
