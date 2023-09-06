import * as express from 'express';
import {
    createCampaign,
} from '../handlers/campaigns';

const router = express.Router();

// CREATE
router.post('/', createCampaign);

export default router;
