import { isTestAccount } from 'therr-js-utilities/http';

/**
 * Store-review / QA accounts (AccessLevels.TEST_ACCOUNT — e.g. the login handed to Google Play
 * review) post real-looking test content. Forcing it private keeps it off the map and out of
 * every other user's feed while the author still sees it on their own map and profile, so the
 * review passes. users-service's test account cleanup worker purges it later
 * (DELETE /test-account-content). Called at the top of every create/update handler that takes
 * `isPublic` from the request body, before anything reads it.
 */
const keepTestAccountContentPrivate = (req: { headers: { [key: string]: any }; body?: { [key: string]: any } }) => {
    if (req.body && isTestAccount(req.headers)) {
        req.body.isPublic = false;
    }
};

export default keepTestAccountContentPrivate;
