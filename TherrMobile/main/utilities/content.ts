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

    let url = `${BASE_ENDPOINT}${media.path}`;
    url = `${url}?tr=h-${minImageHeight},w-${minImageWidth}`;
    if (!autocrop) {
        // Preserve original image dimensions
        url = `${url},c-at_least`;
    }
    return url;
};

const getUserImageUri = (user, size = screenWidth) => {
    if (user.details?.media?.profilePicture) {
        /**
         * In the max-size crop strategy, whole image content is preserved (no cropping),
         * the aspect ratio is preserved, but one of the dimensions (height or width) is adjusted.
         */
        return `${BASE_ENDPOINT}${user.details.media.profilePicture.path}?tr=h-${size},w-${size}`;
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
    getUserImageUri,
    isMyContent,
    signImageUrl,
};
