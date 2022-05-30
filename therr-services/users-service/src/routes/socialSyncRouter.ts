import * as express from 'express';
import {
    getSocialSyncs,
    createUpdateSocialSyncs,
    instagramAppAuth,
} from '../handlers/socialSync';

const router = express.Router();

router.get('/oauth2-instagram', instagramAppAuth);
router.get('/:userId', getSocialSyncs);

router.post('/', createUpdateSocialSyncs);

export default router;
