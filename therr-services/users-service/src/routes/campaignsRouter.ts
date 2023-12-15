import * as express from 'express';
import {
    createCampaign,
    getCampaign,
    searchMyCampaigns,
    searchAllCampaigns,
    updateCampaign,
} from '../handlers/campaigns';

const router = express.Router();

// CREATE
router.post('/', createCampaign);
router.get('/:id', getCampaign);
router.post('/search/me', searchMyCampaigns);
router.post('/search/all', searchAllCampaigns);
router.put('/:id', updateCampaign);

export default router;
