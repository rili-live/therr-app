import * as express from 'express';
import {
    searchActiveMoments,
} from '../handlers/moments';

const router = express.Router();

// POST
router.post('/active/search', searchActiveMoments);

export default router;
