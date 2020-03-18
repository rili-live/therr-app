import * as express from 'express';
import {
    authenticateUserTokenValidation,
    authenticateUserValidation,
    logoutUserValidation,
} from '../validation/auth';
import {
    validate,
} from '../validation';
import {
    login,
    logout,
    verifyToken,
} from '../handlers/auth';

const router = express.Router();

// Authenticate user
router.post('/', authenticateUserValidation, validate, login);

// Logout user
router.post('/logout', logoutUserValidation, validate, logout);

// Verify user token (after login)
router.post('/user-token/validate', authenticateUserTokenValidation, validate, verifyToken);

export default router;
