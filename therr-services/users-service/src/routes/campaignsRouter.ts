import * as express from 'express';
import {
    createCampaign,
    searchMyCampaigns,
} from '../handlers/campaigns';

const router = express.Router();

// CREATE
router.post('/', createCampaign);
router.post('/search/me', searchMyCampaigns);

export default router;
