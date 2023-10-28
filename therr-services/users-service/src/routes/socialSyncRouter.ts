import * as express from 'express';
import {
    getSocialSyncs,
    createUpdateSocialSyncs,
    facebookAppAuth,
    instagramAppAuth,
    tiktokAppAuth,
} from '../handlers/socialSync';

const router = express.Router();

router.get('/oauth2-facebook', facebookAppAuth);
router.get('/oauth2-dashboard-facebook', facebookAppAuth);
router.get('/oauth2-instagram', instagramAppAuth);
router.get('/oauth2-tiktok', tiktokAppAuth);
router.get('/:userId', getSocialSyncs);

router.post('/', createUpdateSocialSyncs);

export default router;
