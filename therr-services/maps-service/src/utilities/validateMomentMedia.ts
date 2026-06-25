import { Content } from 'therr-js-utilities/constants';

const IMAGE_TYPES = [
    Content.mediaTypes.USER_IMAGE_PUBLIC,
    Content.mediaTypes.USER_IMAGE_PRIVATE,
];

// Moments may include up to this many photos (single photo or a multi-photo carousel).
export const MAX_MOMENT_PHOTOS = 5;

interface IValidationResult {
    isValid: boolean;
    message?: string;
}

/**
 * Guards the moment create/update media payload for the photo / multi-photo model:
 *   - at most MAX_MOMENT_PHOTOS photos per moment (perf/storage guard)
 *   - every media entry must be an image (the dedicated video type is deferred)
 * Empty / single-photo payloads always pass.
 */
const validateMomentMedia = (media?: Array<{ type?: string }>): IValidationResult => {
    if (!media || !media.length) {
        return { isValid: true };
    }

    const nonImage = media.find((m) => !m?.type || !IMAGE_TYPES.includes(m.type));
    if (nonImage) {
        return { isValid: false, message: 'Moments currently support photos only.' };
    }

    if (media.length > MAX_MOMENT_PHOTOS) {
        return { isValid: false, message: `A moment may include at most ${MAX_MOMENT_PHOTOS} photos.` };
    }

    return { isValid: true };
};

export default validateMomentMedia;
