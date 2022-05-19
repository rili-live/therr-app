import * as express from 'express';
import {
    getSocialSyncs,
    createUpdateSocialSyncs,
} from '../handlers/socialSync';

const router = express.Router();

router.get('/:userId', getSocialSyncs);

router.post('/', createUpdateSocialSyncs);

export default router;
