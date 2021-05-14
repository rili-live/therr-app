import { Content } from 'therr-js-utilities/constants';

export default (type) => {
    switch (type) {
        case Content.mediaTypes.USER_IMAGE_PUBLIC:
            return process.env.BUCKET_PUBLIC_USER_DATA;
        case Content.mediaTypes.USER_IMAGE_PRIVATE:
            return process.env.BUCKET_PRIVATE_USER_DATA;
        default:
            console.log('getBucket.ts: Unrecognized media type. Defaulting to public bucket.');
            return process.env.BUCKET_PUBLIC_USER_DATA;
    }
};
