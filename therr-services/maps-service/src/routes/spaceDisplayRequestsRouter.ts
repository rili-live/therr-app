import * as express from 'express';
import {
    createSpaceDisplayRequest,
    listSpaceDisplayRequests,
} from '../handlers/spaceDisplayRequests';

const router = express.Router();

// CREATE
router.post('/', createSpaceDisplayRequest);

// LIST (admin only)
router.get('/', listSpaceDisplayRequests);

export default router;
