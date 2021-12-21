import { Platform } from 'react-native';
import uuid from 'react-native-uuid';

const getImagePreviewPath = (imageURI) => {
    if (!imageURI) {
        return '';
    }
    let fullImagePath = imageURI.replace('file:///', '').replace('file:/', '');
    if (Platform.OS !== 'ios') {
        fullImagePath = `file:///${fullImagePath}`;
    }

    return `${fullImagePath}?cachebust=${uuid.v4()}`;
};

export {
    getImagePreviewPath,
};
