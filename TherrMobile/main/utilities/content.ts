import { Dimensions } from 'react-native';
import { MapsService } from 'therr-react/services';
import { Content } from 'therr-js-utilities/constants';
import getConfig from './getConfig';

const { width: screenWidth } = Dimensions.get('window');

// Moments may include up to this many photos (single photo or a multi-photo carousel).
const MAX_MOMENT_PHOTOS = 5;

const IMAGE_MEDIA_TYPES = [
    Content.mediaTypes.USER_IMAGE_PUBLIC,
    Content.mediaTypes.USER_IMAGE_PRIVATE,
];

const globalConfig = getConfig();
const BASE_ENDPOINT = globalConfig.baseImageKitEndpoint ? globalConfig.baseImageKitEndpoint : `${globalConfig.baseApiGatewayRoute}/user-files/`;

const isMyContent = (content, user) => {
    return String(content.fromUserId) === String(user.details.id);
};

const getUserContentUri = (media, height = screenWidth, width = screenWidth, autocrop = false) => {
    // 25 increase for higher quality resolution
    // Round to 100s increase odds of device overlap being cached
    const minImageHeight = Math.ceil((height * 1.25) / 100) * 100;
    const minImageWidth = Math.ceil((width * 1.25) / 100) * 100;
    // Use lower quality for small thumbnails where compression artifacts are not visible
    const quality = (height <= 200 && width <= 200) ? 75 : 85;

    let url = `${BASE_ENDPOINT}${media?.path}`;
    url = `${url}?tr=h-${minImageHeight},w-${minImageWidth},f-auto,q-${quality}`;
    if (!autocrop) {
        // Preserve original image dimensions
        url = `${url},c-at_least`;
    }
    return url;
};

const isImageMedia = (media): boolean => !!media?.type && IMAGE_MEDIA_TYPES.includes(media.type);

// Resolve display URIs for every image in a moment (single photo or multi-photo carousel),
// capped at MAX_MOMENT_PHOTOS. Public images use the cacheable ImageKit URL; private images
// fall back to the signed URL already cached in Redux (`mediaMap[path]`).
const getMomentImageUris = (medias, mediaMap, height = screenWidth, width = screenWidth): string[] => {
    if (!medias?.length) {
        return [];
    }

    return medias
        .filter(isImageMedia)
        .slice(0, MAX_MOMENT_PHOTOS)
        .map((media) => (media.type === Content.mediaTypes.USER_IMAGE_PUBLIC
            ? getUserContentUri(media, height, width)
            : (mediaMap?.[media.path] || getUserContentUri(media, height, width))));
};

const getUserImageUri = (user, size = screenWidth) => {
    if (user.details?.media?.profilePicture) {
        /**
         * In the max-size crop strategy, whole image content is preserved (no cropping),
         * the aspect ratio is preserved, but one of the dimensions (height or width) is adjusted.
         */
        return `${BASE_ENDPOINT}${user.details.media.profilePicture.path}?tr=h-${size},w-${size},f-auto,q-90`;
    }

    return `https://robohash.org/${user.details?.id}?set=set5&size=${size}x${size}`;
};

const signImageUrl = (isPublic: boolean, {
    action,
    filename,
}) => {
    const signUrl = isPublic ? MapsService.getSignedUrlPublicBucket : MapsService.getSignedUrlPrivateBucket;

    // TODO: This is too slow
    // Use public method for public moments
    return signUrl({
        action,
        filename: filename,
    });
};

export {
    MAX_MOMENT_PHOTOS,
    getUserContentUri,
    getMomentImageUris,
    isImageMedia,
    getUserImageUri,
    isMyContent,
    signImageUrl,
};
