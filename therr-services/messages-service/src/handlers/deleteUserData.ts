import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import { SUPER_ADMIN_ID } from '../constants';

// DELETE
/**
 * When a user is deleted, this endpoint is requested to delete all user related data.
 *
 * Direct messages and the user's own forum messages are removed outright. Forums they
 * created are reassigned to the super admin instead, so the other members' conversations
 * survive — the same trade-off maps-service makes for spaces.
 *
 * Forum messages are deleted before the forums are reassigned so that a failure part-way
 * leaves orphaned ownership rather than orphaned message content; a retry is safe either
 * way, since both operations are idempotent once the rows are gone.
 */
const deleteUserData = (req, res) => {
    const userId = req.headers['x-userid'];

    if (!userId) {
        return handleHttpError({ res, message: 'Unauthorized', statusCode: 401 });
    }

    return Store.directMessages.deleteByUserId(userId)
        .then((directMessages) => Store.forumMessages.deleteByUserId(userId)
            .then((forumMessages) => Store.forums.reassignByAuthorId(userId, SUPER_ADMIN_ID)
                .then((forums) => res.status(202).send({
                    directMessages,
                    forumMessages,
                    forums,
                }))))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MESSAGES_ROUTES:ERROR' }));
};

export default deleteUserData;
