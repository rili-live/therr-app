import * as express from 'express';
import {
    updateAndCreateUserAchievements,
    getUserAchievements,
} from '../handlers/userAchievements';

const router = express.Router();

// CREATE
router.post('/', updateAndCreateUserAchievements);

// READ
router.get('/', getUserAchievements);

export default router;
