import { isTestAccount } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';

// DELETE
/**
 * Internal-only (not proxied by the gateway). Called by users-service's test account cleanup
 * worker for each store-review / QA account (AccessLevels.TEST_ACCOUNT): deletes the direct and
 * forum messages it sent, and hides then deletes the forums it authored, for anything created
 * before `createdBefore`. Only messages the test account *sent* are touched — a real user's
 * message to it stays in that user's history.
 *
 * Refuses unless the forwarded access levels mark the user as a test account, so a
 * mis-addressed call can never reach a real user's messages.
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

    return Store.directMessages.deleteTestAccountContent(userId, createdBefore)
        .then((directMessages) => Store.forumMessages.deleteTestAccountContent(userId, createdBefore)
            .then((forumMessages) => Store.forums.purgeTestAccountForums(userId, createdBefore)
                .then((forums) => res.status(202).send({
                    directMessages: { deleted: directMessages },
                    forumMessages: { deleted: forumMessages },
                    forums,
                }))))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:TEST_ACCOUNT_CONTENT:ERROR' }));
};

export default deleteTestAccountContent;
