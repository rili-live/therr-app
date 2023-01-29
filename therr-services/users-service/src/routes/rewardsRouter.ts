import * as express from 'express';
import {
    requestRewardsExchange,
    getCurrentExchangeRate,
} from '../handlers/rewards';
// import {
//     verifyEmail,
// } from '../handlers/email';

const router = express.Router();

router.post('/', requestRewardsExchange);
router.get('/exchange-rate', getCurrentExchangeRate);

export default router;
