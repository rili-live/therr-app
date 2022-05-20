import * as express from 'express';
import {
    getSocialSyncs,
    createUpdateSocialSyncs,
    instagramAppAuth,
} from '../handlers/socialSync';

const router = express.Router();

router.get('/:userId', getSocialSyncs);
router.get('/oauth2-instagram', instagramAppAuth);

router.post('/', createUpdateSocialSyncs);

export default router;
