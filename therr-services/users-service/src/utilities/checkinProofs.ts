import { Content } from 'therr-js-utilities/constants';

/**
 * Serialization for check-in proof media, and the ownership rule that guards it.
 *
 * Proof rows have been written since the check-in flow shipped and never read:
 * `ProofsStore.getByCheckinId` existed uncalled, no route exposed it, and the
 * only trace that ever reached a client was the `hasProof` boolean. The images
 * were uploaded to GCS, indexed in `habits.proofs`, and then unreachable.
 * `GET /habits/checkins/:id/proofs` is the read path; this module is the part
 * of it worth testing without standing up Express.
 */

export interface IProofRow {
    id: string;
    checkinId: string;
    mediaType: string;
    mediaPath: string;
    thumbnailPath?: string | null;
    createdAt: Date | string;
    capturedAt?: Date | string | null;
    verificationStatus?: string;
}

export interface ISerializedProof {
    id: string;
    checkinId: string;
    mediaType: string;
    /**
     * The path, plus the media *type* the maps-service media endpoint expects —
     * not `mediaType`, which is 'image' | 'video'.
     *
     * `getBucket` keys on `Content.mediaTypes.*` to decide which bucket a path
     * lives in, so a client handing it 'image' would silently fall through to
     * the default branch and resolve the URL against the PUBLIC bucket, where
     * the object does not exist. Emitting the resolved type here means the
     * client passes `medias` straight through to `MapsService.fetchMedia`
     * without knowing where proofs are stored.
     */
    path: string;
    type: string;
    thumbnailPath: string | null;
    createdAt: string;
    capturedAt: string | null;
    verificationStatus: string | null;
}

/**
 * Proofs are always private-bucket objects.
 *
 * Both mobile upload sites call `signImageUrl(false, …)` — Dashboard and
 * HabitDetail — and `habits.proofs` has no column recording which bucket a row
 * landed in, so this is derived rather than stored. If a public-bucket proof
 * path is ever introduced, that column has to come first: guessing here would
 * point the client at the wrong bucket, and the failure is a broken image with
 * no error anywhere.
 */
export const PROOF_MEDIA_TYPE = Content.mediaTypes.USER_IMAGE_PRIVATE;

const toIso = (value: Date | string | null | undefined): string | null => {
    if (!value) {
        return null;
    }

    return typeof value === 'string' ? value : value.toISOString();
};

/**
 * May this user read this check-in's proofs?
 *
 * Deliberately the same rule as `getCheckin` and nothing looser. A proof path
 * is the whole access control story for the image behind it: private media
 * resolves to a deterministic ImageKit URL rather than a signed one (see
 * maps-service `createMediaUrls`), so revealing the path reveals the image.
 * Pact partners are NOT granted access here — a partner can see *that* someone
 * checked in, which is the accountability signal, and nothing in the product
 * has yet asked them to see the photo.
 */
export const canReadProofs = (
    checkin: { userId: string } | null | undefined,
    requesterUserId: string,
): { allowed: boolean; error?: 'notFound' | 'forbidden' } => {
    if (!checkin) {
        return { allowed: false, error: 'notFound' };
    }

    if (String(checkin.userId) !== String(requesterUserId)) {
        return { allowed: false, error: 'forbidden' };
    }

    return { allowed: true };
};

/**
 * Rows that cannot be rendered are dropped rather than returned empty-pathed.
 * A proof with no `mediaPath` is not a thing the schema allows (the column is
 * NOT NULL), but the client renders whatever it is handed, and one broken tile
 * in a day sheet reads as data loss.
 */
export const serializeProofs = (rows: IProofRow[]): ISerializedProof[] => (rows || [])
    .filter((row) => row && row.mediaPath)
    .map((row) => ({
        id: row.id,
        checkinId: row.checkinId,
        mediaType: row.mediaType === 'video' ? 'video' : 'image',
        path: row.mediaPath,
        type: PROOF_MEDIA_TYPE,
        thumbnailPath: row.thumbnailPath || null,
        createdAt: toIso(row.createdAt) as string,
        capturedAt: toIso(row.capturedAt),
        verificationStatus: row.verificationStatus || null,
    }));
