import { isTestAccount } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';

// DELETE
/**
 * Internal-only (not proxied by the gateway). Called by users-service's test account cleanup
 * worker for each store-review / QA account (AccessLevels.TEST_ACCOUNT): hides everything the
 * account posted and deletes moments and events created before `createdBefore`. Spaces are only
 * hidden — see SpacesStore.hideTestAccountSpaces.
 *
 * Refuses unless the forwarded access levels mark the user as a test account. The caller is
 * trusted, but this endpoint deletes content, and that check is what keeps a mis-addressed
 * call from ever reaching a real user's posts.
 */
const deleteTestAccountContent = (req, res) => {
    const userId = req.headers['x-userid'];
    const createdBefore = new Date(req.body?.createdBefore);

    if (!userId || !isTestAccount(req.headers)) {
        return handleHttpError({ res, message: 'Forbidden', statusCode: 403 });
    }

    if (Number.isNaN(createdBefore.getTime())) {
        return handleHttpError({ res, message: 'createdBefore must be a date', statusCode: 400 });
    }

    // Moments before spaces, as in deleteUserData: a moment may point at a space.
    return Store.moments.purgeTestAccountContent(userId, createdBefore)
        .then((moments) => Store.events.purgeTestAccountContent(userId, createdBefore)
            .then((events) => Store.spaces.hideTestAccountSpaces(userId)
                .then((spacesHidden) => res.status(202).send({
                    moments,
                    events,
                    spaces: { hidden: spacesHidden, deleted: 0 },
                }))))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:TEST_ACCOUNT_CONTENT:ERROR' }));
};

export default deleteTestAccountContent;
