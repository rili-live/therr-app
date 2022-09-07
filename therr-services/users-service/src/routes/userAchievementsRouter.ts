import * as express from 'express';
import {
    updateAndCreateUserAchievements,
    getUserAchievements,
    claimAchievement,
} from '../handlers/userAchievements';

const router = express.Router();

// CREATE
router.post('/', updateAndCreateUserAchievements);

// READ
router.get('/', getUserAchievements);

// UPDATE
router.post('/:id/claim', claimAchievement);

export default router;
