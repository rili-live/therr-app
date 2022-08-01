import * as express from 'express';
import {
    createOrUpdateUserAchievement,
    getUserAchievements,
    updateUserAchievement,
} from '../handlers/userAchievements';

const router = express.Router();

// CREATE
router.post('/', createOrUpdateUserAchievement);

// READ
router.get('/', getUserAchievements);

// UPDATE
router.put('/:id', updateUserAchievement);

export default router;
