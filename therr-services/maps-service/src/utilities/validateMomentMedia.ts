import { Content } from 'therr-js-utilities/constants';

const VIDEO_TYPES = [
    Content.mediaTypes.USER_VIDEO_PUBLIC,
    Content.mediaTypes.USER_VIDEO_PRIVATE,
];
const IMAGE_TYPES = [
    Content.mediaTypes.USER_IMAGE_PUBLIC,
    Content.mediaTypes.USER_IMAGE_PRIVATE,
];

interface IValidationResult {
    isValid: boolean;
    message?: string;
}

/**
 * Live Moments store a still image (medias[0]) paired with a short muted video clip.
 * This guards the create/update payload so the pairing stays well-formed:
 *   - at most one paired video per moment (perf/storage guard)
 *   - a video entry must have a sibling still image to fall back to
 * Non-live payloads (image-only, or empty) always pass.
 */
const validateLiveMomentMedia = (media?: Array<{ type?: string }>): IValidationResult => {
    if (!media || !media.length) {
        return { isValid: true };
    }

    const videoCount = media.filter((m) => m?.type && VIDEO_TYPES.includes(m.type)).length;

    if (videoCount === 0) {
        return { isValid: true };
    }

    if (videoCount > 1) {
        return { isValid: false, message: 'A moment may include at most one Live video clip.' };
    }

    const hasStill = media.some((m) => m?.type && IMAGE_TYPES.includes(m.type));
    if (!hasStill) {
        return { isValid: false, message: 'A Live video clip must be paired with a still image.' };
    }

    return { isValid: true };
};

export default validateLiveMomentMedia;
