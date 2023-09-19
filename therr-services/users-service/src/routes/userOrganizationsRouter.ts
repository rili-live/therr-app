import * as express from 'express';
import {
    getUserOrganizations,
} from '../handlers/userOrganizations';

const router = express.Router();

// READ
router.get('/', getUserOrganizations);

export default router;
