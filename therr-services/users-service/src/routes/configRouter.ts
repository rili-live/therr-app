import * as express from 'express';
import {
    getConfigByKey,
} from '../handlers/config';

const router = express.Router();

// READ
router.get('/:key', getConfigByKey);

export default router;
