import * as express from 'express';
import {
    createCampaign,
    getCampaign,
    searchMyCampaigns,
    updateCampaign,
} from '../handlers/campaigns';

const router = express.Router();

// CREATE
router.post('/', createCampaign);
router.get('/:id', getCampaign);
router.post('/search/me', searchMyCampaigns);
router.put('/:id', updateCampaign);

export default router;
