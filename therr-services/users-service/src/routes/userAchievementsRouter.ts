import * as express from 'express';
import {
    updateAndCreateUserAchievements,
    getUserAchievements,
    getPublicUserAchievements,
    claimAchievement,
} from '../handlers/userAchievements';

const router = express.Router();

// PRIVATE
router.post('/', updateAndCreateUserAchievements);

// PUBLIC
router.get('/', getUserAchievements);
router.get('/:userId/public', getPublicUserAchievements);
router.post('/:id/claim', claimAchievement);

export default router;
