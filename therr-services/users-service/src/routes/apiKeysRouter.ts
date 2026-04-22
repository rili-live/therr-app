import * as express from 'express';
import {
    createApiKey,
    listApiKeys,
    revokeApiKey,
    revokeAllApiKeys,
    validateApiKey,
} from '../handlers/apiKeys';

const router = express.Router();

// Create a new API key (requires JWT auth + dashboard subscription)
router.post('/', createApiKey);

// List all API keys for the authenticated user
router.get('/', listApiKeys);

// Revoke a specific API key
router.delete('/:id', revokeApiKey);

// Revoke all API keys for the authenticated user
router.delete('/', revokeAllApiKeys);

// Internal-only: Validate an API key (called by API gateway)
router.post('/validate', validateApiKey);

export default router;
