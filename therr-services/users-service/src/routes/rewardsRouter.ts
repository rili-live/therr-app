import * as express from 'express';
import {
    requestRewardsExchange,
    getCurrentExchangeRate,
    transferCoins,
} from '../handlers/rewards';
// import {
//     verifyEmail,
// } from '../handlers/email';

const router = express.Router();

router.post('/', requestRewardsExchange);
router.get('/exchange-rate', getCurrentExchangeRate);
router.post('/transfer-coins', transferCoins);

export default router;
