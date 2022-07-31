import * as express from 'express';
import {
    createUserAchievement,
    getUserAchievements,
    updateUserAchievement,
} from '../handlers/userAchievements';

const router = express.Router();

// CREATE
router.post('/', createUserAchievement);

// READ
router.get('/', getUserAchievements);

// UPDATE
router.put('/:id', updateUserAchievement);

export default router;
