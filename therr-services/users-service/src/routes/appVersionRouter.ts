import * as express from 'express';
import {
    getAppVersionPolicy,
} from '../handlers/appVersion';

const router = express.Router();

// READ — public at the gateway: a signed-out install must still learn it is too old to use.
router.get('/policy', getAppVersionPolicy);

export default router;
