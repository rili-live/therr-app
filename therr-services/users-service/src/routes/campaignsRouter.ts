import * as express from 'express';
import {
    createCampaign,
    getCampaign,
    searchMyCampaigns,
    searchAllCampaigns,
    updateCampaign,
    updateCampaignStatus,
} from '../handlers/campaigns';

const router = express.Router();

// CREATE
router.post('/', createCampaign);
router.get('/:id', getCampaign);
router.post('/search/me', searchMyCampaigns);
router.post('/search/all', searchAllCampaigns);
router.put('/:id', updateCampaign);
router.put('/:id/status', updateCampaignStatus);

export default router;
