import * as express from 'express';
import {
    getUserIdentities,
    getIdentityByHabit,
    setIdentityLabel,
    createReflection,
    getReflections,
    getPartnerIdentity,
} from '../handlers/habitIdentity';

const router = express.Router();

// READ
router.get('/habit/:habitGoalId/reflections', getReflections);
router.get('/habit/:habitGoalId/partner/:partnerUserId', getPartnerIdentity);
router.get('/habit/:habitGoalId', getIdentityByHabit);
router.get('/', getUserIdentities);

// CREATE
router.post('/habit/:habitGoalId/reflections', createReflection);

// UPDATE
router.put('/habit/:habitGoalId/label', setIdentityLabel);

export default router;
