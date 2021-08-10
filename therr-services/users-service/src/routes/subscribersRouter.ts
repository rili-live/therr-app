import * as express from 'express';
import {
    createSubscriber,
} from '../handlers/subscribers';

const router = express.Router();

// CREATE
router.post('/signup', createSubscriber);

export default router;
