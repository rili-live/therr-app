import { Content } from 'therr-js-utilities/constants';
import { getDistanceInMeters } from 'therr-js-utilities/location';

/**
 * The rules for Drops — a note or photo left at a place for one connection, which opens only
 * once that person goes there (docs/DROPS.md). Kept free of Express and the database so the
 * decisions that matter (who may see what, and when a drop may be opened) are unit-tested
 * directly.
 */

/**
 * The smallest unlock radius a sender may choose. Phone GPS is routinely 20–50m off, more
 * indoors or between tall buildings, so the 20m used for space check-ins would leave a recipient
 * standing on the spot unable to open what they came for.
 */
export const DROP_MIN_UNLOCK_RADIUS_METERS = 75;
export const DROP_DEFAULT_UNLOCK_RADIUS_METERS = 100;
/** Beyond this a drop stops being "at a place" and becomes "somewhere in the neighbourhood". */
export const DROP_MAX_UNLOCK_RADIUS_METERS = 500;

/**
 * How much of the device's own reported inaccuracy is forgiven on top of the radius. Capped,
 * because the accuracy figure comes from the client and an uncapped allowance would let any
 * request claim a 10km error bar and open everything.
 */
export const DROP_MAX_ACCURACY_ALLOWANCE_METERS = 50;

export const DROP_LIFETIME_DAYS = 30;
export const DROP_MAX_RECIPIENTS = 10;
export const DROP_MAX_MESSAGE_LENGTH = 500;
export const DROP_MAX_PLACE_NAME_LENGTH = 120;
/** Rows (one per recipient) a sender may create per rolling 24 hours. */
export const DROP_MAX_PER_SENDER_PER_DAY = 30;

export type DropStatus = 'locked' | 'opened' | 'expired';

export interface IDropRow {
    id: string;
    brandVariation: string;
    batchId: string;
    fromUserId: string;
    toUserId: string;
    message: string;
    mediaPath: string | null;
    mediaType: string | null;
    latitude: number;
    longitude: number;
    unlockRadiusMeters: number;
    placeName: string | null;
    spaceId: string | null;
    expiresAt: Date | string;
    openedAt: Date | string | null;
    recipientDismissedAt: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
}

export interface IDropUserSummary {
    id: string;
    userName: string;
    firstName?: string;
    lastName?: string;
    media?: any;
}

export interface ISerializedDrop {
    id: string;
    status: DropStatus;
    isSender: boolean;
    fromUser: IDropUserSummary | null;
    toUser: IDropUserSummary | null;
    latitude: number;
    longitude: number;
    unlockRadiusMeters: number;
    placeName: string | null;
    spaceId: string | null;
    createdAt: string;
    expiresAt: string;
    openedOn: string | null;
    message: string | null;
    hasMedia: boolean;
    mediaUrl: string | null;
}

const toDate = (value: Date | string): Date => (value instanceof Date ? value : new Date(value));

const toIso = (value: Date | string): string => toDate(value).toISOString();

export const clampUnlockRadius = (requested: unknown): number => {
    const parsed = Number(requested);
    if (!Number.isFinite(parsed)) {
        return DROP_DEFAULT_UNLOCK_RADIUS_METERS;
    }
    return Math.round(Math.min(DROP_MAX_UNLOCK_RADIUS_METERS, Math.max(DROP_MIN_UNLOCK_RADIUS_METERS, parsed)));
};

export const isValidCoordinatePair = (latitude: unknown, longitude: unknown): boolean => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    return latitude !== null && latitude !== undefined && latitude !== ''
        && longitude !== null && longitude !== undefined && longitude !== ''
        && Number.isFinite(lat) && Number.isFinite(lng)
        && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
        // (0, 0) is in the Gulf of Guinea and is what an unset location serializes to.
        && !(lat === 0 && lng === 0);
};

export const getDropExpiry = (now: Date = new Date()): Date => new Date(now.getTime() + DROP_LIFETIME_DAYS * 24 * 60 * 60 * 1000);

export const getDropStatus = (drop: Pick<IDropRow, 'openedAt' | 'expiresAt'>, now: Date = new Date()): DropStatus => {
    if (drop.openedAt) {
        return 'opened';
    }
    return toDate(drop.expiresAt).getTime() <= now.getTime() ? 'expired' : 'locked';
};

/**
 * A media path the sender may attach. Private media resolves to a deterministic URL, so a path
 * is as good as the image behind it: accepting someone else's path would let a sender forward
 * an image they were never shown. Only objects under the sender's own `<userId>/` prefix pass.
 */
export const isOwnMediaPath = (path: unknown, userId: string): boolean => typeof path === 'string'
    && !!userId
    && path.startsWith(`${userId}/`)
    && !path.includes('..')
    && path.length <= 512;

export const DROP_MEDIA_TYPE = Content.mediaTypes.USER_IMAGE_PRIVATE;

export type OpenDropRefusal = 'notFound' | 'expired' | 'tooFar' | 'invalidLocation';

export interface IOpenDropDecision {
    allowed: boolean;
    refusal?: OpenDropRefusal;
    /** Rounded to the nearest 10m; reported back on a `tooFar` refusal so the app can say how far. */
    distanceMeters?: number;
}

/**
 * May this user open this drop from where they say they are?
 *
 * Only the recipient may open a drop, and an already-opened drop stays open (re-opening it
 * needs no location, so a recipient can read it again from home). A sender asking is answered
 * `notFound`, the same as a stranger: the sender already holds the content and has no reason to
 * "open" it, and a distinct answer would only confirm the row exists to someone probing ids.
 */
export const decideOpenDrop = (
    drop: IDropRow | null | undefined,
    requesterUserId: string,
    location: { latitude: unknown; longitude: unknown; accuracy?: unknown },
    now: Date = new Date(),
): IOpenDropDecision => {
    if (!drop || String(drop.toUserId) !== String(requesterUserId) || drop.recipientDismissedAt) {
        return { allowed: false, refusal: 'notFound' };
    }

    const status = getDropStatus(drop, now);
    if (status === 'opened') {
        return { allowed: true };
    }
    if (status === 'expired') {
        return { allowed: false, refusal: 'expired' };
    }

    if (!isValidCoordinatePair(location.latitude, location.longitude)) {
        return { allowed: false, refusal: 'invalidLocation' };
    }

    const distance = getDistanceInMeters(
        Number(location.latitude),
        Number(location.longitude),
        Number(drop.latitude),
        Number(drop.longitude),
    );
    const reportedAccuracy = Number(location.accuracy);
    const allowance = Number.isFinite(reportedAccuracy) && reportedAccuracy > 0
        ? Math.min(reportedAccuracy, DROP_MAX_ACCURACY_ALLOWANCE_METERS)
        : 0;

    if (!Number.isFinite(distance) || distance > Number(drop.unlockRadiusMeters) + allowance) {
        return {
            allowed: false,
            refusal: 'tooFar',
            distanceMeters: Number.isFinite(distance) ? Math.round(distance / 10) * 10 : undefined,
        };
    }

    return { allowed: true };
};

/**
 * The calendar day a drop was opened, and nothing finer. Telling the sender the exact time would
 * tell them where the recipient was at that minute; the day is enough to close the loop.
 */
export const toOpenedOn = (openedAt: Date | string | null): string | null => (openedAt ? toIso(openedAt).slice(0, 10) : null);

/**
 * Shape a drop for whoever is asking. Returns null for anyone who is neither its sender nor its
 * (non-dismissed) recipient, so a caller cannot leak a row by forgetting an ownership check.
 *
 * The recipient sees where the drop is, who left it and what they called the place — enough to
 * go there — but not the message or photo until it is opened. The sender always sees their own
 * content.
 */
export const serializeDrop = (
    drop: IDropRow,
    requesterUserId: string,
    {
        users = {},
        privateMediaBaseUrl,
        now = new Date(),
    }: {
        users?: Record<string, IDropUserSummary>;
        privateMediaBaseUrl?: string;
        now?: Date;
    } = {},
): ISerializedDrop | null => {
    const isSender = String(drop.fromUserId) === String(requesterUserId);
    const isRecipient = String(drop.toUserId) === String(requesterUserId) && !drop.recipientDismissedAt;
    if (!isSender && !isRecipient) {
        return null;
    }

    const status = getDropStatus(drop, now);
    const canSeeContent = isSender || status === 'opened';
    const hasMedia = !!drop.mediaPath;

    return {
        id: drop.id,
        status,
        isSender,
        fromUser: users[drop.fromUserId] || null,
        toUser: users[drop.toUserId] || null,
        latitude: Number(drop.latitude),
        longitude: Number(drop.longitude),
        unlockRadiusMeters: Number(drop.unlockRadiusMeters),
        placeName: drop.placeName || null,
        spaceId: drop.spaceId || null,
        createdAt: toIso(drop.createdAt),
        expiresAt: toIso(drop.expiresAt),
        openedOn: toOpenedOn(drop.openedAt),
        message: canSeeContent ? (drop.message || '') : null,
        hasMedia,
        mediaUrl: canSeeContent && hasMedia && privateMediaBaseUrl
            ? `${privateMediaBaseUrl}${drop.mediaPath}`
            : null,
    };
};

export interface IValidatedCreateDrop {
    recipientIds: string[];
    message: string;
    mediaPath: string | null;
    latitude: number;
    longitude: number;
    unlockRadiusMeters: number;
    placeName: string | null;
    spaceId: string | null;
}

export type CreateDropValidationError = 'noRecipients'
    | 'tooManyRecipients'
    | 'cannotDropForSelf'
    | 'emptyDrop'
    | 'messageTooLong'
    | 'invalidLocation'
    | 'invalidMedia';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Normalize a create request, or say why it cannot be one. Connection checks and the daily cap
 * need the database and happen in the handler; everything that can be decided from the body
 * alone is decided here.
 */
export const validateCreateDrop = (
    body: any,
    senderUserId: string,
): { value?: IValidatedCreateDrop; error?: CreateDropValidationError } => {
    const recipientIds: string[] = Array.from(new Set<string>(
        (Array.isArray(body?.recipientIds) ? body.recipientIds : [])
            .filter((id: unknown) => typeof id === 'string' && UUID_PATTERN.test(id)),
    ));

    if (!recipientIds.length) {
        return { error: 'noRecipients' };
    }
    if (recipientIds.length > DROP_MAX_RECIPIENTS) {
        return { error: 'tooManyRecipients' };
    }
    if (recipientIds.includes(String(senderUserId))) {
        return { error: 'cannotDropForSelf' };
    }

    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (message.length > DROP_MAX_MESSAGE_LENGTH) {
        return { error: 'messageTooLong' };
    }

    let mediaPath: string | null = null;
    if (body?.media) {
        if (!isOwnMediaPath(body.media.path, senderUserId)) {
            return { error: 'invalidMedia' };
        }
        mediaPath = body.media.path;
    }

    if (!message && !mediaPath) {
        return { error: 'emptyDrop' };
    }

    if (!isValidCoordinatePair(body?.latitude, body?.longitude)) {
        return { error: 'invalidLocation' };
    }

    const placeName = typeof body?.placeName === 'string' && body.placeName.trim()
        ? body.placeName.trim().slice(0, DROP_MAX_PLACE_NAME_LENGTH)
        : null;
    const spaceId = typeof body?.spaceId === 'string' && UUID_PATTERN.test(body.spaceId) ? body.spaceId : null;

    return {
        value: {
            recipientIds,
            message,
            mediaPath,
            latitude: Number(body.latitude),
            longitude: Number(body.longitude),
            unlockRadiusMeters: clampUnlockRadius(body?.unlockRadiusMeters),
            placeName,
            spaceId,
        },
    };
};
