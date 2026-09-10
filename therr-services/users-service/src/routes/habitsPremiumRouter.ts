import * as express from 'express';
import {
    getPremiumOffer,
    verifyPremiumPurchase,
} from '../handlers/habitsPremium';

const router = express.Router();

// READ
router.get('/', getPremiumOffer);

// CREATE
router.post('/verify', verifyPremiumPurchase);

export default router;
