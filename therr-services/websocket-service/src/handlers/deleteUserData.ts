import logSpan from 'therr-js-utilities/log-or-update-span';
import redisSessions from '../store/redisSessions';

// DELETE
/**
 * When a user is deleted, this endpoint is requested to tear down their socket session.
 *
 * The session keys (`users:<id>` and `userSockets:<socketId>`) carry a TTL, so a stale
 * session does expire on its own — but until it does, the deleted account still resolves
 * to an active socket for presence lookups and DM delivery, which is both a privacy leak
 * and a source of pushes addressed to an account that no longer exists.
 *
 * A user with no live session is a success, not an error: account deletion is far more
 * likely to happen from a web session than with a socket open, and the caller fans this
 * out alongside several other services that must not be failed by a no-op here.
 */
const deleteUserData = (req, res) => {
    const userId = req.headers['x-userid'];

    if (!userId) {
        return res.status(401).send({ message: 'Unauthorized' });
    }

    return redisSessions.getUserById(userId)
        .then((session) => {
            if (!session?.socketId) {
                return res.status(202).send({ sessionsRemoved: 0 });
            }

            return redisSessions.remove(session.socketId)
                .then(() => res.status(202).send({ sessionsRemoved: 1 }));
        })
        .catch((err) => {
            logSpan({
                level: 'error',
                messageOrigin: 'SOCKET_IO_LOGS',
                messages: ['Failed to delete user socket session'],
                traceArgs: {
                    'error.message': err?.message,
                    'user.id': userId,
                },
            });

            return res.status(500).send({ message: 'Failed to delete user socket session' });
        });
};

export default deleteUserData;
