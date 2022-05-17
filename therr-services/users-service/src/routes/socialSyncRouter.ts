import * as express from 'express';
import {
    createUpdateSocialSyncs,
} from '../handlers/socialSync';

const router = express.Router();

// Twitter
router.post('/', createUpdateSocialSyncs);

export default router;
