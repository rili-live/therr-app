import { Content } from 'therr-js-utilities/constants';

const VIDEO_TYPES = [
    Content.mediaTypes.USER_VIDEO_PUBLIC,
    Content.mediaTypes.USER_VIDEO_PRIVATE,
];
const IMAGE_TYPES = [
    Content.mediaTypes.USER_IMAGE_PUBLIC,
    Content.mediaTypes.USER_IMAGE_PRIVATE,
];

interface IMediaEntry {
    type?: string;
    path?: string;
    isLivePhoto?: boolean;
    [key: string]: any;
}

/**
 * Pure helpers for the Live Moments media pairing. A live moment stores a still image
 * (medias[0]) alongside a short muted video clip as a sibling medias[] entry. These helpers
 * isolate that selection logic so display + capture code (and unit tests) share one source
 * of truth and remain backward compatible with image-only moments.
 */
export const getStillMedia = (medias?: IMediaEntry[]): IMediaEntry | undefined => {
    if (!medias?.length) {
        return undefined;
    }

    // Prefer an explicit image entry; fall back to the first entry (legacy/all-image moments).
    return medias.find((m) => m?.type && IMAGE_TYPES.includes(m.type)) || medias[0];
};

export const getVideoMedia = (medias?: IMediaEntry[]): IMediaEntry | undefined => {
    if (!medias?.length) {
        return undefined;
    }

    return medias.find((m) => m?.type && VIDEO_TYPES.includes(m.type));
};

export const getIsLiveMoment = (medias?: IMediaEntry[]): boolean => !!getVideoMedia(medias);

export default {
    getStillMedia,
    getVideoMedia,
    getIsLiveMoment,
};
