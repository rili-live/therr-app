import * as express from 'express';
import {
    getLifetimeOffer,
    verifyLifetimePurchase,
} from '../handlers/habitsLifetime';

const router = express.Router();

// READ
router.get('/', getLifetimeOffer);

// CREATE
router.post('/verify', verifyLifetimePurchase);

export default router;
