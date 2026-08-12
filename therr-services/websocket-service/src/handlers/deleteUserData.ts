import jwt from 'jsonwebtoken';
import { hasValidStandardClaims } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import redisSessions from '../store/redisSessions';

/**
 * Resolves the caller's own user id from the bearer token, or null if the request is not
 * authenticated as a specific user.
 *
 * Unlike the maps/reactions/messages `delete-user-data` endpoints, this one CANNOT trust
 * `x-userid` on its own. Those services have no ingress rule and are only reachable inside
 * the cluster, but websocket-service is published at `websocket-service.therr.com` with a
 * catch-all `/?(.*)` path (k8s/prod/ingress-service.yaml) so that browsers can open sockets
 * against it. Every express route on this app is therefore internet-facing, and a header is
 * something any client can set — without this check, `DELETE /delete-user-data` with
 * `x-userid: <victim>` would let an unauthenticated caller drop any user's live session at
 * will, repeatedly.
 *
 * The internal caller already forwards the deleting user's own token: the gateway copies
 * `authorization` through in `handleServiceRequest`, and `internalRestRequest` lists it as a
 * forwarded header, so requiring it costs the legitimate fan-out nothing.
 */
const getAuthenticatedUserId = (req): string | null => {
    const [scheme, token] = `${req.headers?.authorization || ''}`.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return null;
    }

    try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET || '');

        // Mirrors the gateway and the socket handshake: a mismatched iss/aud signals a
        // forged or foreign token, while legacy tokens carrying neither still pass.
        if (!hasValidStandardClaims(decoded)) {
            return null;
        }

        return decoded?.id ? `${decoded.id}` : null;
    } catch (err) {
        return null;
    }
};

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
    const authenticatedUserId = getAuthenticatedUserId(req);

    // Self-service only. A user may tear down their own session; the header alone never
    // grants the right to tear down someone else's.
    if (!userId || !authenticatedUserId || authenticatedUserId !== `${userId}`) {
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
