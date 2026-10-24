import * as express from 'express';
import { getMyReferralReward } from '../handlers/referralRewards';

const router = express.Router();

// READ
router.get('/', getMyReferralReward);

export default router;
