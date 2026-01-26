import * as express from 'express';
import {
    createHabitGoal,
    getHabitGoal,
    getUserHabitGoals,
    getTemplates,
    getPublicGoals,
    searchHabitGoals,
    updateHabitGoal,
    deleteHabitGoal,
} from '../handlers/habitGoals';

const router = express.Router();

// PUBLIC - Templates and public goals
router.get('/templates', getTemplates);
router.get('/public', getPublicGoals);
router.get('/search', searchHabitGoals);

// PRIVATE - User's own goals
router.post('/', createHabitGoal);
router.get('/', getUserHabitGoals);
router.get('/:id', getHabitGoal);
router.put('/:id', updateHabitGoal);
router.delete('/:id', deleteHabitGoal);

export default router;
