import { randomUUID } from 'crypto';
import { RequestHandler } from 'express';
import { ErrorCodes, Notifications } from 'therr-js-utilities/constants';
import { getBrandContext, parseHeaders } from 'therr-js-utilities/http';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { storage } from '../api/aws';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import notifyUserOfUpdate from '../utilities/notifyUserOfUpdate';
import {
    DROP_MAX_PER_SENDER_PER_DAY,
    DROP_MEDIA_TYPE,
    IDropRow,
    IDropUserSummary,
    decideOpenDrop,
    getDropExpiry,
    serializeDrop,
    validateCreateDrop,
} from '../utilities/drops';

/**
 * Drops — a note or photo left at a place for one connection, which opens only once that
 * person goes there. See docs/DROPS.md; the rules themselves live in utilities/drops.ts.
 */

const USER_SUMMARY_COLUMNS = ['id', 'userName', 'firstName', 'lastName', 'media'];

/**
 * Private media resolves to a deterministic ImageKit URL, so this service turns a drop's path
 * into a URL itself, and only for a caller allowed to see the content. Handing the path to the
 * client for maps-service `createMediaUrls` would not work anyway: that endpoint only resolves
 * someone else's private path when a moment, space or event references it.
 */
const getPrivateMediaBaseUrl = (): string | undefined => process.env.IMAGE_KIT_URL_PRIVATE || undefined;

const loadUsers = async (ids: string[]): Promise<Record<string, IDropUserSummary>> => {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (!uniqueIds.length) {
        return {};
    }
    const rows = await Store.users.findUsers({ ids: uniqueIds }, USER_SUMMARY_COLUMNS);
    return rows.reduce((acc: Record<string, IDropUserSummary>, row: any) => {
        acc[row.id] = {
            id: row.id,
            userName: row.userName,
            firstName: row.firstName,
            lastName: row.lastName,
            media: row.media,
        };
        return acc;
    }, {});
};

const serializeMany = async (rows: IDropRow[], userId: string) => {
    const users = await loadUsers(rows.flatMap((row) => [row.fromUserId, row.toUserId]));
    const privateMediaBaseUrl = getPrivateMediaBaseUrl();
    return rows
        .map((row) => serializeDrop(row, userId, { users, privateMediaBaseUrl }))
        .filter(Boolean);
};

/**
 * Remove a drop's photo from the private bucket once no row references it. A drop left for
 * several friends shares one upload, so deleting one copy keeps the photo while another remains.
 * Only a sender's delete calls this: a recipient's dismissal leaves the sender's copy intact.
 */
export const deleteDropMediaIfUnreferenced = async (brandVariation: string, mediaPath: string): Promise<boolean> => {
    const remaining = await Store.drops.countByMediaPath(brandVariation, mediaPath);
    const bucketName = process.env.BUCKET_PRIVATE_USER_DATA;
    if (remaining > 0 || !bucketName) {
        return false;
    }
    await storage.bucket(bucketName).file(mediaPath).delete({ ignoreNotFound: true });
    return true;
};

const notFound = (res, locale: string) => handleHttpError({
    res,
    message: translate(locale, 'errorMessages.drops.notFound'),
    statusCode: 404,
    errorCode: ErrorCodes.NOT_FOUND,
});

// CREATE
const createDrop: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { brandVariation } = getBrandContext(req.headers);

    const { value, error } = validateCreateDrop(req.body, userId);
    if (!value) {
        return handleHttpError({
            res,
            message: translate(locale, `errorMessages.drops.${error}`),
            statusCode: 400,
            errorCode: ErrorCodes.BAD_REQUEST,
        });
    }

    try {
        const [liveConnectionIds, recipientRows, sentToday] = await Promise.all([
            Store.userConnections.getLiveConnectionUserIdsAmong(userId, value.recipientIds),
            Store.users.findUsers({ ids: value.recipientIds }, ['id', 'blockedUsers']),
            Store.drops.countSentSince(brandVariation, userId, new Date(Date.now() - 24 * 60 * 60 * 1000)),
        ]);

        // Connections only, in both directions: a stranger cannot leave something at your door,
        // and someone you have blocked cannot reach you this way either.
        const live = new Set(liveConnectionIds);
        const blockersOfSender = new Set(recipientRows
            .filter((row: any) => Array.isArray(row.blockedUsers) && row.blockedUsers.includes(userId))
            .map((row: any) => row.id));
        const isEveryRecipientAllowed = value.recipientIds.every((id) => live.has(id) && !blockersOfSender.has(id));
        if (!isEveryRecipientAllowed) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.drops.notConnected'),
                statusCode: 403,
                errorCode: ErrorCodes.ACCESS_DENIED,
            });
        }

        if (sentToday + value.recipientIds.length > DROP_MAX_PER_SENDER_PER_DAY) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.drops.tooManyToday'),
                statusCode: 429,
                errorCode: ErrorCodes.NOT_PERMITTED,
            });
        }

        const batchId = randomUUID();
        const expiresAt = getDropExpiry();
        const created = await Store.drops.createMany(brandVariation, value.recipientIds.map((toUserId) => ({
            batchId,
            fromUserId: userId,
            toUserId,
            message: value.message,
            mediaPath: value.mediaPath,
            mediaType: value.mediaPath ? DROP_MEDIA_TYPE : null,
            latitude: value.latitude,
            longitude: value.longitude,
            unlockRadiusMeters: value.unlockRadiusMeters,
            placeName: value.placeName,
            spaceId: value.spaceId,
            expiresAt,
        })));

        const users = await loadUsers([userId, ...value.recipientIds]);
        const sender = users[userId];

        // Inline, not queued: the recipient hearing about it is the whole point of leaving it.
        created.forEach((drop) => {
            notifyUserOfUpdate(req.headers, {
                userId: drop.toUserId,
                type: Notifications.Types.DROP_RECEIVED,
                associationId: drop.id,
                isUnread: true,
                messageLocaleKey: drop.placeName
                    ? Notifications.MessageKeys.DROP_RECEIVED
                    : `${Notifications.MessageKeys.DROP_RECEIVED}NoPlace`,
                messageParams: {
                    dropId: drop.id,
                    userName: sender?.userName || '',
                    fromUserName: sender?.userName || '',
                    placeName: drop.placeName || '',
                },
            }, {
                toUserId: drop.toUserId,
                fromUser: {
                    id: userId,
                    userName: sender?.userName || '',
                    name: sender?.userName || '',
                },
            }, {
                shouldCreateDBNotification: true,
                shouldSendPushNotification: true,
                shouldSendEmail: false,
            }).catch((err) => {
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: ['Error while notifying the recipient of a drop'],
                    traceArgs: {
                        'error.message': err?.message,
                        'drop.id': drop.id,
                    },
                });
            });
        });

        const privateMediaBaseUrl = getPrivateMediaBaseUrl();
        return res.status(201).send({
            batchId,
            drops: created.map((drop) => serializeDrop(drop, userId, { users, privateMediaBaseUrl })),
        });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:DROPS_ROUTES:ERROR' });
    }
};

// READ
const getReceivedDrops: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { brandVariation } = getBrandContext(req.headers);

    try {
        const rows = await Store.drops.listReceived(brandVariation, userId);
        return res.status(200).send({ drops: await serializeMany(rows, userId) });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:DROPS_ROUTES:ERROR' });
    }
};

const getSentDrops: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { brandVariation } = getBrandContext(req.headers);

    try {
        const rows = await Store.drops.listSent(brandVariation, userId);
        return res.status(200).send({ drops: await serializeMany(rows, userId) });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:DROPS_ROUTES:ERROR' });
    }
};

const getDrop: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { brandVariation } = getBrandContext(req.headers);

    try {
        const row = await Store.drops.getForParticipant(brandVariation, req.params.id, userId);
        const [drop] = row ? await serializeMany([row], userId) : [];
        if (!drop) {
            return notFound(res, locale);
        }
        return res.status(200).send({ drop });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:DROPS_ROUTES:ERROR' });
    }
};

// OPEN
const openDrop: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { brandVariation } = getBrandContext(req.headers);
    const {
        latitude,
        longitude,
        accuracy,
        shouldNotifySender,
    } = req.body || {};

    try {
        const row = await Store.drops.getForParticipant(brandVariation, req.params.id, userId);
        const decision = decideOpenDrop(row, userId, { latitude, longitude, accuracy });

        if (!decision.allowed || !row) {
            if (decision.refusal === 'notFound' || !row) {
                return notFound(res, locale);
            }
            return res.status(decision.refusal === 'expired' ? 410 : 403).send({
                statusCode: decision.refusal === 'expired' ? 410 : 403,
                errorCode: decision.refusal,
                distanceMeters: decision.distanceMeters,
                message: translate(locale, `errorMessages.drops.${decision.refusal}`),
            });
        }

        // Only the request that flips openedAt notifies; a re-read of an opened drop updates nothing.
        const justOpened = row.openedAt ? undefined : await Store.drops.markOpened(brandVariation, row.id, userId);
        // Lost a race to a concurrent open (a double tap, a retry): `row` predates that write and
        // still reads as locked, so re-read it rather than answer a successful open with no content.
        const current = justOpened
            || (row.openedAt ? row : await Store.drops.getForParticipant(brandVariation, row.id, userId))
            || row;

        if (justOpened && shouldNotifySender !== false) {
            const users = await loadUsers([userId]);
            const opener = users[userId];
            notifyUserOfUpdate(req.headers, {
                userId: current.fromUserId,
                type: Notifications.Types.DROP_OPENED,
                associationId: current.id,
                isUnread: true,
                messageLocaleKey: current.placeName
                    ? Notifications.MessageKeys.DROP_OPENED
                    : `${Notifications.MessageKeys.DROP_OPENED}NoPlace`,
                messageParams: {
                    dropId: current.id,
                    userName: opener?.userName || '',
                    fromUserName: opener?.userName || '',
                    placeName: current.placeName || '',
                },
            }, {
                toUserId: current.fromUserId,
                fromUser: {
                    id: userId,
                    userName: opener?.userName || '',
                    name: opener?.userName || '',
                },
            }, {
                shouldCreateDBNotification: true,
                shouldSendPushNotification: true,
                shouldSendEmail: false,
            }).catch((err) => {
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: ['Error while notifying the sender that a drop was opened'],
                    traceArgs: {
                        'error.message': err?.message,
                        'drop.id': current.id,
                    },
                });
            });
        }

        const [drop] = await serializeMany([current], userId);
        return res.status(200).send({ drop, justOpened: !!justOpened });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:DROPS_ROUTES:ERROR' });
    }
};

// DELETE
/**
 * The sender deletes the drop outright; the recipient only hides their own copy. One route for
 * both, decided by which side of the row the caller is on, so the client never has to know.
 */
const deleteDrop: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { brandVariation } = getBrandContext(req.headers);

    try {
        const row = await Store.drops.getForParticipant(brandVariation, req.params.id, userId);
        if (!row) {
            return notFound(res, locale);
        }

        if (String(row.fromUserId) === String(userId)) {
            await Store.drops.deleteForSender(brandVariation, row.id, userId);
            if (row.mediaPath) {
                // Best effort: a photo left behind is a storage leak, not a reason to fail the delete.
                await deleteDropMediaIfUnreferenced(brandVariation, row.mediaPath).catch((err) => {
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: ['Error while deleting a deleted drop\'s photo'],
                        traceArgs: {
                            'error.message': err?.message,
                            'drop.id': row.id,
                        },
                    });
                });
            }
            return res.status(200).send({ id: row.id, deleted: true });
        }

        await Store.drops.dismissForRecipient(brandVariation, row.id, userId);
        return res.status(200).send({ id: row.id, dismissed: true });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:DROPS_ROUTES:ERROR' });
    }
};

export {
    createDrop,
    deleteDrop,
    getDrop,
    getReceivedDrops,
    getSentDrops,
    openDrop,
};
