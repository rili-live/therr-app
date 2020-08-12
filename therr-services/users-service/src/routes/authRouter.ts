import * as express from 'express';
import {
    login,
    logout,
    verifyToken,
} from '../handlers/auth';

const router = express.Router();

// Authenticate user
router.post('/', login);

// Logout user
router.post('/logout', logout);

// Verify user token (after login)
router.post('/user-token/validate', verifyToken);

export default router;
