import * as express from 'express';
import {
    createCampaign,
    getCampaign,
    searchMyCampaigns,
} from '../handlers/campaigns';

const router = express.Router();

// CREATE
router.post('/', createCampaign);
router.get('/:id', getCampaign);
router.post('/search/me', searchMyCampaigns);

export default router;
