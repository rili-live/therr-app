import * as express from 'express';
import {
    updateAndCreateUserAchievements,
    getUserAchievements,
    claimAchievement,
} from '../handlers/userAchievements';

const router = express.Router();

// PRIVATE
router.post('/', updateAndCreateUserAchievements);

// PUBLIC
router.get('/', getUserAchievements);
router.post('/:id/claim', claimAchievement);

export default router;
