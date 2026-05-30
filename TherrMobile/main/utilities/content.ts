import { Dimensions } from 'react-native';
import { MapsService } from 'therr-react/services';
import getConfig from './getConfig';

const { width: screenWidth } = Dimensions.get('window');

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

// Live Moments: build the streamed/transcoded MP4 URL for a paired video clip.
// ImageKit transcodes and adaptively serves the clip; we cap quality to keep the
// feed light. No `c-at_least` (image-only) param — video uses its own sizing.
const getUserVideoUri = (media, height = screenWidth, width = screenWidth) => {
    const maxHeight = Math.ceil((height * 1.25) / 100) * 100;
    const maxWidth = Math.ceil((width * 1.25) / 100) * 100;

    return `${BASE_ENDPOINT}${media?.path}?tr=h-${maxHeight},w-${maxWidth},q-70`;
};

// Live Moments: derive a still poster frame from the clip via ImageKit's video
// thumbnail endpoint. Used as a fallback when a moment has a clip but no paired
// still image (e.g. clips captured via the video picker path).
const getLiveMomentPosterUri = (media, height = screenWidth, width = screenWidth) => {
    const minImageHeight = Math.ceil((height * 1.25) / 100) * 100;
    const minImageWidth = Math.ceil((width * 1.25) / 100) * 100;

    return `${BASE_ENDPOINT}${media?.path}/ik-thumbnail.jpg?tr=h-${minImageHeight},w-${minImageWidth},f-auto,q-85,c-at_least`;
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
    getUserContentUri,
    getUserVideoUri,
    getLiveMomentPosterUri,
    getUserImageUri,
    isMyContent,
    signImageUrl,
};
